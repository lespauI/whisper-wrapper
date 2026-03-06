import { test, expect } from '@playwright/test';
import { LibraryPage, TabNavigationPage } from '../pages';

/**
 * E2E tests for the Transcription Library tab.
 *
 * Note: these tests run against the renderer served at localhost:3000.
 * window.electronAPI is not available in that context (no Electron IPC),
 * so tests focus on UI rendering, navigation, and client-side interactions.
 * Store round-trips are covered by the integration test suite.
 */
test.describe('Library Tab — E2E', () => {
    let libraryPage: LibraryPage;
    let tabNav: TabNavigationPage;

    test.beforeEach(async ({ page }) => {
        libraryPage = new LibraryPage(page);
        tabNav = new TabNavigationPage(page);
        await libraryPage.goto();
    });

    test.describe('Navigation', () => {
        test('Library tab is visible and clickable', async () => {
            await expect(libraryPage.libraryTab).toBeVisible();
            await expect(libraryPage.libraryTab).toBeEnabled();
        });

        test('switching to Library tab shows the library panel', async () => {
            await libraryPage.switchToLibrary();
            await expect(libraryPage.libraryPanel).toBeVisible();
        });

        test('Library tab becomes active on click', async () => {
            await libraryPage.switchToLibrary();
            await expect(libraryPage.libraryTab).toHaveClass(/active/);
        });

        test('can switch back from Library to other tabs', async () => {
            await libraryPage.switchToLibrary();
            await tabNav.switchToTab('upload');
            await expect(libraryPage.libraryTab).not.toHaveClass(/active/);
            await expect(libraryPage.libraryPanel).not.toBeVisible();
        });
    });

    test.describe('UI elements', () => {
        test.beforeEach(async () => {
            await libraryPage.switchToLibrary();
        });

        test('search controls are all visible', async () => {
            await libraryPage.verifySearchControlsVisible();
        });

        test('search input accepts text', async () => {
            await libraryPage.searchInput.fill('hello world');
            await expect(libraryPage.searchInput).toHaveValue('hello world');
        });

        test('clear button empties search input', async () => {
            await libraryPage.searchInput.fill('something');
            await libraryPage.clear();
            await expect(libraryPage.searchInput).toHaveValue('');
        });

        test('detail panel shows placeholder when nothing selected', async () => {
            await libraryPage.verifyDetailPlaceholder();
        });

        test('date range inputs are present and editable', async () => {
            await libraryPage.dateFrom.fill('2026-01-01');
            await libraryPage.dateTo.fill('2026-12-31');
            await expect(libraryPage.dateFrom).toHaveValue('2026-01-01');
            await expect(libraryPage.dateTo).toHaveValue('2026-12-31');
        });
    });

    test.describe('Empty state', () => {
        test.beforeEach(async () => {
            await libraryPage.switchToLibrary();
        });

        test('shows empty state message on initial load', async () => {
            await libraryPage.verifyEmptyState();
        });

        test('shows empty state after searching with no results', async () => {
            await libraryPage.search('zzz_no_results_expected');
            await libraryPage.verifyEmptyState();
        });
    });

    test.describe('Reindex button', () => {
        test('reindex button is visible and enabled', async () => {
            await libraryPage.switchToLibrary();
            await expect(libraryPage.reindexBtn).toBeVisible();
            await expect(libraryPage.reindexBtn).toBeEnabled();
        });

        test('reindex button does not throw a JS error when clicked (no Electron)', async ({ page }) => {
            await libraryPage.switchToLibrary();
            const errors: string[] = [];
            page.on('pageerror', e => errors.push(e.message));
            await libraryPage.reindexBtn.click();
            await page.waitForTimeout(300);
            const fatalErrors = errors.filter(e => !e.includes('electronAPI') && !e.includes('Cannot read properties of undefined'));
            expect(fatalErrors).toHaveLength(0);
        });
    });
});
