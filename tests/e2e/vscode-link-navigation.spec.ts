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
});
