import { test, expect } from './fixtures/vscodeFixture';
import {
  byId,
  navigationWorkspace,
  openNavigationPreview,
  pressMouseSideButton,
  scrollY,
} from './fixtures/navigationHelpers';

test.use(navigationWorkspace);

test.describe('Comment preview link navigation', () => {
  test('headings carry GitHub-style ids', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await expect(frame.locator('.md-comments-document h3').first()).toHaveAttribute(
      'id',
      '11-background'
    );
  });

  test('a link to a numbered heading scrolls to it', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await expect(byId(frame, '510-sender-identities-and-signatures')).not.toBeInViewport();
    await frame.getByRole('link', { name: 'Numbered section' }).click();
    await expect(byId(frame, '510-sender-identities-and-signatures')).toBeInViewport();
  });

  test('a link to an explicit anchor still scrolls to it', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Explicit anchor' }).click();
    await expect(byId(frame, 'q1')).toBeInViewport();
  });

  test('a link to another markdown file follows it in the same panel', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Section in other file' }).click();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Other fixture');
    await expect(byId(frame, 's2--second-scenario')).toBeInViewport();
    await expect(vscode.page.getByRole('tab', { name: /Comments: other\.md/ })).toBeVisible();
    await expect(vscode.page.locator('iframe.webview')).toHaveCount(1);
  });

  test('a self link written with a path scrolls within the file', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Self link with path' }).click();
    await expect(byId(frame, '10-open-questions')).toBeInViewport();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Navigation fixture');
  });

  test('a self link without a fragment scrolls to the top', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    const link = frame.getByRole('link', { name: 'the top of this file' });
    await link.scrollIntoViewIfNeeded();
    expect(await scrollY(frame)).toBeGreaterThan(0);
    await link.click();
    await expect.poll(() => scrollY(frame)).toBe(0);
    await expect(frame.locator('#md-comments-navbar [data-nav="back"]')).toBeEnabled();
  });

  test('a relative link clicked before navigation is ready does nothing', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.locator('body').evaluate(() => {
      const w = window as any;
      w.__savedNav = w.mdCommentsNav;
      delete w.mdCommentsNav;
    });
    await frame.getByRole('link', { name: 'Top of other file' }).click();
    await vscode.page.waitForTimeout(1000);
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Navigation fixture');
    await expect(vscode.page.locator('.monaco-dialog-box')).toHaveCount(0);
    await frame.locator('body').evaluate(() => {
      const w = window as any;
      w.mdCommentsNav = w.__savedNav;
    });
  });

  test('a scroll restore cancels the hold from an earlier jump', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Numbered section' }).click();
    await expect(byId(frame, '510-sender-identities-and-signatures')).toBeInViewport();
    // Back from outside the webview (Command Palette) brings no user input that would end the
    // jump's hold, so stand in for the host's restore message, then reflow the document.
    const y = await frame.locator('body').evaluate(async () => {
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      window.postMessage({ type: 'navScrollTo', scrollTop: 0 }, '*');
      await wait(50);
      const filler = document.createElement('div');
      filler.style.height = '2000px';
      document.querySelector('.md-comments-document')!.appendChild(filler);
      await wait(300);
      return Math.round(window.scrollY);
    });
    expect(y).toBe(0);
  });

  test('a modifier click opens the linked file in a new panel', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame
      .getByRole('link', { name: 'Section in other file' })
      .click({ modifiers: ['ControlOrMeta'] });
    await expect(vscode.page.locator('iframe.webview')).toHaveCount(2, { timeout: 15000 });
    await expect(vscode.page.getByRole('tab', { name: /Comments: other\.md/ })).toBeVisible();
    await expect(vscode.page.getByRole('tab', { name: /Comments: index\.md/ })).toBeVisible();
  });

  test('a link to a non-markdown file opens it in an editor', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Diagram' }).click();
    await expect(vscode.page.getByRole('tab', { name: /diagram\.svg/ })).toBeVisible();
  });

  test('a link to a missing file shows a warning', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Missing file' }).click();
    await expect(vscode.page.locator('.notifications-toasts')).toContainText(
      'cannot open missing.md'
    );
  });

  test('Back returns from a heading jump and Forward repeats it', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    const back = frame.locator('#md-comments-navbar [data-nav="back"]');
    const forward = frame.locator('#md-comments-navbar [data-nav="forward"]');
    await expect(back).toBeDisabled();
    await frame.getByRole('link', { name: 'Numbered section' }).click();
    await expect(byId(frame, '510-sender-identities-and-signatures')).toBeInViewport();
    await expect(back).toBeEnabled();
    await back.click();
    await expect.poll(() => scrollY(frame)).toBe(0);
    await expect(forward).toBeEnabled();
    await forward.click();
    await expect(byId(frame, '510-sender-identities-and-signatures')).toBeInViewport();
  });

  test('Back returns across files to the same scroll position', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    const link = frame.getByRole('link', { name: 'the second scenario' });
    await link.scrollIntoViewIfNeeded();
    const before = await scrollY(frame);
    expect(before).toBeGreaterThan(0);
    await link.click();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Other fixture');
    await expect(frame.locator('.md-comments-nav-title')).toHaveText('other.md');
    await frame.locator('#md-comments-navbar [data-nav="back"]').click();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Navigation fixture');
    await expect.poll(async () => Math.abs((await scrollY(frame)) - before)).toBeLessThan(5);
  });

  test('the keyboard shortcut goes back', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Top of other file' }).click();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Other fixture');
    await frame.locator('.md-comments-nav-title').click();
    await vscode.page.keyboard.press(
      process.platform === 'darwin' ? 'Control+Minus' : 'Alt+ArrowLeft'
    );
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Navigation fixture');
  });

  test('the mouse back and forward buttons navigate the panel', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Top of other file' }).click();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Other fixture');
    await pressMouseSideButton(vscode.page, 'back');
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Navigation fixture');
    await pressMouseSideButton(vscode.page, 'forward');
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Other fixture');
    // VS Code's own editor history must not have moved: the panel is still the active tab.
    // Every editor group has a `.tab.active`, so scope to the active group.
    await expect(vscode.page.locator('.editor-group-container.active .tab.active')).toContainText(
      'Comments: other.md'
    );
  });
});
