import fs from 'node:fs';
import path from 'node:path';
import { expect, type FrameLocator, type Locator } from '@playwright/test';
import type { VSCodeTestContext } from './vscodeFixture';

const fixtureDir = path.resolve(process.cwd(), 'tests/fixtures/navigation');

export const navigationWorkspace = {
  workspaceFiles: Object.fromEntries(
    ['index.md', 'other.md', 'diagram.svg', 'images/square.svg', 'sub/nested.md'].map((name) => [
      name,
      fs.readFileSync(path.join(fixtureDir, name), 'utf8'),
    ])
  ),
  openDoc: 'index.md',
};

export async function openNavigationPreview(vscode: VSCodeTestContext): Promise<FrameLocator> {
  await vscode.openCommentPreview();
  const frame = vscode.getCommentPreviewFrame();
  await expect(frame.locator('.md-comments-document h1')).toHaveText('Navigation fixture', {
    timeout: 20000,
  });
  // The h1 exists once the parser reaches it, before the scripts at the end of <body> have run.
  // A click in that window goes to VS Code's own link handler instead of navigation.js.
  await expect
    .poll(() => frame.locator('body').evaluate(() => !!(window as any).mdCommentsNav))
    .toBe(true);
  return frame;
}

// Heading ids can start with a digit, which is not a valid CSS id selector.
export function byId(frame: FrameLocator, id: string): Locator {
  return frame.locator(`[id="${id}"]`);
}

export function scrollY(frame: FrameLocator): Promise<number> {
  return frame.locator('body').evaluate(() => Math.round(window.scrollY));
}
