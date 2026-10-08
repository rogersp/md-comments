import { test, expect } from './fixtures/vscodeFixture';
import { navigationWorkspace, openNavigationPreview } from './fixtures/navigationHelpers';
import type { FrameLocator } from '@playwright/test';

test.use(navigationWorkspace);

function imageLoaded(frame: FrameLocator, alt: string): Promise<boolean> {
  return frame.getByAltText(alt, { exact: true }).evaluate((el) => {
    const img = el as HTMLImageElement;
    return img.complete && img.naturalWidth > 0;
  });
}

test.describe('Comment preview relative images', () => {
  test('markdown and HTML images load from next to the document', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await expect.poll(() => imageLoaded(frame, 'Square')).toBe(true);
    await expect.poll(() => imageLoaded(frame, 'Square from HTML')).toBe(true);
  });

  test('images and links resolve from the new folder after following a link', async ({
    vscode,
  }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.getByRole('link', { name: 'Nested file' }).click();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Nested fixture');
    await expect.poll(() => imageLoaded(frame, 'Diagram from parent')).toBe(true);
    await frame.getByRole('link', { name: 'the index' }).click();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Navigation fixture');
  });
});
