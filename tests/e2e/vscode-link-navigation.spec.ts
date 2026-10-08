import { test, expect } from './fixtures/vscodeFixture';
import { byId, navigationWorkspace, openNavigationPreview } from './fixtures/navigationHelpers';

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
});
