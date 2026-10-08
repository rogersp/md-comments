import { test, expect } from './fixtures/vscodeFixture';
import { byId, navigationWorkspace, openNavigationPreview } from './fixtures/navigationHelpers';
import type { FrameLocator } from '@playwright/test';

test.use(navigationWorkspace);

function outlineItems(frame: FrameLocator) {
  return frame.locator('#md-comments-outline .md-comments-outline-item');
}

async function openOutline(frame: FrameLocator) {
  await frame.locator('.md-comments-outline-toggle').click();
  await expect(frame.locator('#md-comments-outline')).toBeVisible();
}

test.describe('Comment preview outline', () => {
  test('lists headings to H3 by default and follows the depth selector', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await expect(frame.locator('#md-comments-outline')).toBeHidden();
    await openOutline(frame);
    await expect(outlineItems(frame).filter({ hasText: '5.10 Sender identities' })).toHaveCount(1);
    await expect(outlineItems(frame).filter({ hasText: 'Deep detail' })).toHaveCount(0);
    await frame.locator('.md-comments-outline-depth').selectOption('6');
    await expect(outlineItems(frame).filter({ hasText: 'Deep detail' })).toHaveCount(1);
    await frame.locator('.md-comments-outline-depth').selectOption('2');
    await expect(outlineItems(frame).filter({ hasText: '5.10 Sender identities' })).toHaveCount(0);
  });

  test('the filter searches every level', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await openOutline(frame);
    await frame.locator('.md-comments-outline-filter').fill('deep');
    await expect(outlineItems(frame)).toHaveCount(1);
    await expect(outlineItems(frame).first()).toHaveText(/5\.10\.1 Deep detail/);
  });

  test('clicking an entry jumps to it, marks it active and enables Back', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await openOutline(frame);
    await outlineItems(frame).filter({ hasText: '5.10 Sender identities' }).click();
    await expect(byId(frame, '510-sender-identities-and-signatures')).toBeInViewport();
    await expect(frame.locator('.md-comments-outline-item.is-active')).toHaveText(
      /5\.10 Sender identities/
    );
    await expect(frame.locator('.md-comments-outline-link[aria-current="location"]')).toHaveText(
      /5\.10 Sender identities/
    );
    await expect(frame.locator('.md-comments-outline-link[aria-current]')).toHaveCount(1);
    await expect(frame.locator('#md-comments-navbar [data-nav="back"]')).toBeEnabled();
  });

  test('keeps its list in place when the sidebar changes without new counts', async ({
    vscode,
  }) => {
    const frame = await openNavigationPreview(vscode);
    await openOutline(frame);
    await frame.locator('.md-comments-outline-depth').selectOption('6');
    // Let the initial comment load settle so only the mutation below reaches the outline.
    await vscode.page.waitForTimeout(1000);
    // Put an early entry in the active state, so a rebuild would scroll the list back to it.
    await frame.locator('body').evaluate(() => window.scrollTo(0, 200));
    await expect(frame.locator('.md-comments-outline-item.is-active')).toHaveCount(1);
    const scrolled = await frame
      .locator('#md-comments-outline .md-comments-outline-list')
      .evaluate((list) => {
        // Eight entries fit the panel, so shrink the list until it scrolls.
        (list as HTMLElement).style.flex = 'none';
        (list as HTMLElement).style.height = '60px';
        list.scrollTop = list.scrollHeight;
        (window as any).__lastEntry = list.lastElementChild;
        return list.scrollTop;
      });
    expect(scrolled).toBeGreaterThan(0);
    const after = await frame.locator('body').evaluate(async () => {
      const sidebar = document.getElementById('md-comments-sidebar')!;
      const probe = document.createElement('span');
      sidebar.appendChild(probe);
      probe.remove();
      await new Promise((resolve) => setTimeout(resolve, 600));
      const list = document.querySelector('#md-comments-outline .md-comments-outline-list')!;
      return {
        scrollTop: list.scrollTop,
        sameEntry: (window as any).__lastEntry.isConnected,
      };
    });
    expect(after).toEqual({ scrollTop: scrolled, sameEntry: true });
  });

  test('the o key toggles the outline', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await frame.locator('.md-comments-nav-title').click();
    await vscode.page.keyboard.press('o');
    await expect(frame.locator('#md-comments-outline')).toBeVisible();
    await vscode.page.keyboard.press('o');
    await expect(frame.locator('#md-comments-outline')).toBeHidden();
  });

  test('stays open when the panel follows a link to another file', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await openOutline(frame);
    // The outline and the comments sidebar together leave no room for the document at the e2e panel width.
    await frame.locator('#md-comments-sidebar').getByRole('button', { name: /close/i }).click();
    await frame.getByRole('link', { name: 'Top of other file' }).click();
    await expect(frame.locator('.md-comments-document h1')).toHaveText('Other fixture');
    await expect(outlineItems(frame).filter({ hasText: 'S2 · Second scenario' })).toHaveCount(1);
  });

  test('counts open inline threads per section, subsections included', async ({ vscode }) => {
    const frame = await openNavigationPreview(vscode);
    await openOutline(frame);
    // No comment backend in e2e, so mark a block and add a matching card by hand. The card goes
    // straight into the sidebar, where a background refresh of the sidebar body cannot drop it.
    await frame.locator('body').evaluate(() => {
      const heading = document.querySelector('[id="510-sender-identities-and-signatures"]')!;
      const block = heading.nextElementSibling!;
      block.setAttribute('data-md-comment-id', 'fake-thread');
      const list = document.createElement('div');
      list.id = 'inline-threads';
      const card = document.createElement('div');
      card.className = 'md-comments-card';
      card.setAttribute('data-md-type', 'inline');
      card.setAttribute('data-md-comment-id', 'fake-thread');
      list.appendChild(card);
      document.getElementById('md-comments-sidebar')!.appendChild(list);
    });
    const count = (text: string) =>
      outlineItems(frame).filter({ hasText: text }).locator('.md-comments-outline-count');
    await expect(count('5.10 Sender identities')).toHaveText('1');
    await expect(count('5. Recommendation')).toHaveText('1');
    await expect(count('1. Overview')).toHaveCount(0);
  });
});
