import * as path from 'path';
import * as vscode from 'vscode';
import { executeCommentAction, type CommentActionMessage } from './commentActions';
import { renderMarkdownWithComments, renderMarkdownInitialLoading } from './markdownRender';
import { escapeHtml } from '../../shared/html';
import { logDebug, logError } from './logger';
import { isMarkdownPath, opensNewPanel, resolveLink } from './links';

const VIEW_TYPE = 'mdComments.commentPreview';

/** Where a freshly rendered document should open: at a fragment, or at a scroll offset. */
export interface NavTarget {
  fragment?: string;
  scrollTop?: number;
}

/** Messages from navigation.js. They bypass the comment action queue. */
type NavMessage = { action: 'nav-open-link'; href: string; newPanel?: boolean; scrollTop?: number };

function isNavMessage(msg: CommentActionMessage | NavMessage): msg is NavMessage {
  return typeof msg?.action === 'string' && msg.action.startsWith('nav-');
}

function titleFor(uri: vscode.Uri): string {
  return `Comments: ${vscode.workspace.asRelativePath(uri)}`;
}

export class CommentPreviewPanel {
  private static panels = new Set<CommentPreviewPanel>();

  private static forUri(uri: vscode.Uri): CommentPreviewPanel[] {
    const key = uri.toString();
    return [...CommentPreviewPanel.panels].filter((p) => p.mdUri.toString() === key);
  }

  static show(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    column?: vscode.ViewColumn
  ): void {
    const existing = CommentPreviewPanel.forUri(document.uri)[0];
    if (existing) {
      existing.panel.reveal(column);
      void existing.refresh(true); // Fetch remote comments on panel open
      return;
    }
    new CommentPreviewPanel(extensionUri, document, column);
  }

  static refreshForUri(uri: vscode.Uri, forceRemote = false): void {
    for (const panelObj of CommentPreviewPanel.forUri(uri)) {
      void panelObj.refresh(forceRemote);
    }
  }

  static refreshAll(forceRemote = false): void {
    for (const panelObj of CommentPreviewPanel.panels) {
      void panelObj.refresh(forceRemote);
    }
  }

  static isOpenForUri(uri: vscode.Uri): boolean {
    return CommentPreviewPanel.forUri(uri).length > 0;
  }

  static closeForUri(uri: vscode.Uri): void {
    for (const panelObj of CommentPreviewPanel.forUri(uri)) {
      panelObj.panel.dispose();
    }
  }

  static closeAll(): void {
    for (const panelObj of [...CommentPreviewPanel.panels]) {
      panelObj.panel.dispose();
    }
    CommentPreviewPanel.panels.clear();
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private mdUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];
  private isHtmlInitialized = false;
  private lastMarkdownContent = '';
  private lastBodyHtml = '';
  private actionQueue: Promise<void> = Promise.resolve();

  private constructor(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    column?: vscode.ViewColumn,
    initial: NavTarget = {}
  ) {
    this.extensionUri = extensionUri;
    this.mdUri = document.uri;

    this.panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      titleFor(document.uri),
      column ?? vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableCommandUris: true,
        localResourceRoots: [extensionUri],
      }
    );

    CommentPreviewPanel.panels.add(this);

    this.panel.webview.onDidReceiveMessage(
      (msg: CommentActionMessage | NavMessage) => {
        if (isNavMessage(msg)) {
          void this.handleNavMessage(msg);
          return;
        }
        logDebug('CommentPreviewPanel webview message received:', msg);
        // Bind the action to the file shown when it was sent, not when the queue reaches it.
        const mdUri = this.mdUri;
        this.actionQueue = this.actionQueue
          .then(async () => {
            const isManualRefresh = msg.action === 'refresh';
            const executed = await executeCommentAction(mdUri, msg);
            if (!executed) {
              logDebug('CommentPreviewPanel action cancelled or skipped:', msg.action);
              return;
            }
            await this.refresh(isManualRefresh);
            if (isManualRefresh) {
              try {
                await vscode.commands.executeCommand('mdComments.refreshPreview');
              } catch (err) {
                logError('Failed to execute mdComments.refreshPreview:', err);
              }
            }
            try {
              await vscode.commands.executeCommand('markdown.preview.refresh');
            } catch {
              // ignore if native preview is not active
            }
          })
          .catch((err) => {
            logError('Failed processing webview action in queue:', err);
          });
      },
      undefined,
      this.disposables
    );

    this.panel.onDidChangeViewState(
      (e) => {
        if (e.webviewPanel.visible) {
          logDebug(`CommentPreviewPanel became visible for ${this.mdUri.toString()}`);
          void this.refresh(false);
        }
      },
      null,
      this.disposables
    );

    const pollInterval = setInterval(() => {
      if (this.panel.visible) {
        logDebug(`CommentPreviewPanel background poll for ${this.mdUri.toString()}`);
        void this.refresh(false);
      }
    }, 30000);
    this.disposables.push(new vscode.Disposable(() => clearInterval(pollInterval)));

    this.panel.onDidDispose(
      () => {
        logDebug('CommentPreviewPanel disposed for:', this.mdUri.toString());
        CommentPreviewPanel.panels.delete(this);
        while (this.disposables.length) {
          this.disposables.pop()?.dispose();
        }
      },
      null,
      this.disposables
    );

    // Render immediate initial document with loading skeleton so comments panel is not blank or empty
    try {
      const initialMd = document.getText();
      const initialHtml = renderMarkdownInitialLoading(initialMd, this.mdUri);
      this.setHtml(initialHtml, initialMd, initial);
    } catch (err) {
      logDebug('CommentPreviewPanel initial loading render fallback:', err);
    }

    void this.refresh(true); // Fetch remote comments on initial panel open
  }

  async refresh(forceRemote = false): Promise<void> {
    const uri = this.mdUri;
    logDebug(
      `CommentPreviewPanel.refresh invoked for ${uri.toString()}, forceRemote=${forceRemote}`
    );
    const doc = await vscode.workspace.openTextDocument(uri);
    const markdownContent = doc.getText();
    const bodyHtml = await renderMarkdownWithComments(markdownContent, uri, forceRemote);
    if (uri.toString() !== this.mdUri.toString()) {
      return;
    }

    if (this.isHtmlInitialized && this.lastMarkdownContent === markdownContent) {
      if (this.lastBodyHtml !== bodyHtml) {
        this.lastBodyHtml = bodyHtml;
        logDebug(
          `CommentPreviewPanel sending in-place comments update for ${this.mdUri.toString()}`
        );
        void this.panel.webview.postMessage({
          type: 'updateComments',
          bodyHtml: bodyHtml,
        });
      }
      return;
    }

    this.setHtml(bodyHtml, markdownContent);
  }

  private async handleNavMessage(msg: NavMessage): Promise<void> {
    if (msg.action === 'nav-open-link') {
      await this.openLink(msg.href, !!msg.newPanel);
    }
  }

  private async openLink(href: string, modifier: boolean): Promise<void> {
    const root =
      vscode.workspace.getWorkspaceFolder(this.mdUri)?.uri ?? vscode.Uri.joinPath(this.mdUri, '..');
    const link = resolveLink(path.posix.relative(root.path, this.mdUri.path), href);
    if (link.kind === 'invalid') {
      void vscode.window.showWarningMessage(`Markdown Comments: ${link.reason}`);
      return;
    }
    if (link.kind === 'external') {
      await vscode.env.openExternal(vscode.Uri.parse(link.url));
      return;
    }
    const target = vscode.Uri.joinPath(root, link.relPath);
    if (!isMarkdownPath(link.relPath)) {
      try {
        await vscode.workspace.fs.stat(target);
      } catch {
        this.warnCannotOpen(target);
        return;
      }
      await vscode.commands.executeCommand('vscode.open', target);
      return;
    }
    const setting = vscode.workspace
      .getConfiguration('mdComments')
      .get<string>('openLinks', 'inPanel');
    if (opensNewPanel(setting, modifier)) {
      const doc = await this.openDocument(target);
      if (doc) {
        new CommentPreviewPanel(this.extensionUri, doc, vscode.ViewColumn.Beside, {
          fragment: link.fragment,
        });
      }
      return;
    }
    await this.showDocument(target, { fragment: link.fragment });
  }

  // Renders `uri` in this panel. Returns false, after warning, when it cannot be opened.
  private async showDocument(uri: vscode.Uri, target: NavTarget): Promise<boolean> {
    if (uri.toString() === this.mdUri.toString()) {
      void this.panel.webview.postMessage({ type: 'navScrollTo', ...target });
      return true;
    }
    const doc = await this.openDocument(uri);
    if (!doc) {
      return false;
    }
    this.mdUri = uri;
    this.panel.title = titleFor(uri);
    const markdown = doc.getText();
    this.setHtml(renderMarkdownInitialLoading(markdown, uri), markdown, target);
    void this.refresh(true);
    return true;
  }

  private async openDocument(uri: vscode.Uri): Promise<vscode.TextDocument | undefined> {
    try {
      return await vscode.workspace.openTextDocument(uri);
    } catch {
      this.warnCannotOpen(uri);
      return undefined;
    }
  }

  private warnCannotOpen(uri: vscode.Uri): void {
    void vscode.window.showWarningMessage(
      `Markdown Comments: cannot open ${vscode.workspace.asRelativePath(uri)}`
    );
  }

  private setHtml(bodyHtml: string, markdownContent: string, target: NavTarget = {}): void {
    this.lastMarkdownContent = markdownContent;
    this.lastBodyHtml = bodyHtml;
    this.isHtmlInitialized = true;
    const nonce = String(Date.now());
    const cssUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'preview.css')
    );
    const mdCssUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'vscode-markdown.css')
    );
    const anchorsScriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'inlineAnchors.js')
    );
    const sidebarScriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'previewSidebar.js')
    );
    const actionsScriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'previewActions.js')
    );
    const mentionScriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'mentionAutocomplete.js')
    );
    const avatarScriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'avatarFallback.js')
    );
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'preview-webview.js')
    );
    const navCssUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'navigation.css')
    );
    const navModelScriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'navModel.js')
    );
    const navigationScriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'navigation.js')
    );
    const mdPath = this.mdUri.fsPath;

    const themeKind = vscode.window.activeColorTheme.kind;
    const themeClass =
      themeKind === vscode.ColorThemeKind.Light
        ? 'vscode-light'
        : themeKind === vscode.ColorThemeKind.HighContrastLight
          ? 'vscode-high-contrast vscode-high-contrast-light'
          : themeKind === vscode.ColorThemeKind.HighContrast
            ? 'vscode-high-contrast vscode-high-contrast-dark'
            : 'vscode-dark';

    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https://avatars.githubusercontent.com; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <link rel="stylesheet" href="${mdCssUri}">
  <link rel="stylesheet" href="${navCssUri}">
  <style>body { margin: 0; padding: 0; }</style>
</head>
<body class="${themeClass}" data-md-webview="true" data-md-md-path="${escapeHtml(mdPath)}" data-md-nav-fragment="${escapeHtml(target.fragment ?? '')}" data-md-nav-scroll="${target.scrollTop ?? ''}">
  ${bodyHtml}
  <script nonce="${nonce}" src="${anchorsScriptUri}"></script>
  <script nonce="${nonce}" src="${sidebarScriptUri}"></script>
  <script nonce="${nonce}" src="${actionsScriptUri}"></script>
  <script nonce="${nonce}" src="${mentionScriptUri}"></script>
  <script nonce="${nonce}" src="${avatarScriptUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
  <script nonce="${nonce}" src="${navModelScriptUri}"></script>
  <script nonce="${nonce}" src="${navigationScriptUri}"></script>
</body>
</html>`;
  }
}
