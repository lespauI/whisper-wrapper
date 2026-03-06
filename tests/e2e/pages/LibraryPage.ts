import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LibraryPage extends BasePage {
    readonly libraryTab: Locator;
    readonly libraryPanel: Locator;
    readonly searchInput: Locator;
    readonly searchBtn: Locator;
    readonly clearBtn: Locator;
    readonly reindexBtn: Locator;
    readonly dateFrom: Locator;
    readonly dateTo: Locator;
    readonly results: Locator;
    readonly detailEmpty: Locator;
    readonly detailContent: Locator;

    constructor(page: Page) {
        super(page);
        this.libraryTab = page.locator('[data-tab="library"]');
        this.libraryPanel = page.locator('#library-tab');
        this.searchInput = page.locator('#library-search-input');
        this.searchBtn = page.locator('#library-search-btn');
        this.clearBtn = page.locator('#library-clear-btn');
        this.reindexBtn = page.locator('#library-reindex-btn');
        this.dateFrom = page.locator('#library-date-from');
        this.dateTo = page.locator('#library-date-to');
        this.results = page.locator('#library-results');
        this.detailEmpty = page.locator('#library-detail-empty');
        this.detailContent = page.locator('#library-detail-content');
    }

    async switchToLibrary(): Promise<void> {
        await this.libraryTab.click();
        await expect(this.libraryTab).toHaveClass(/active/);
        await expect(this.libraryPanel).toBeVisible();
    }

    async search(query: string): Promise<void> {
        await this.searchInput.fill(query);
        await this.searchBtn.click();
    }

    async clear(): Promise<void> {
        await this.clearBtn.click();
    }

    async verifyEmptyState(): Promise<void> {
        await expect(this.results).toContainText('No transcriptions found');
    }

    async verifyDetailPlaceholder(): Promise<void> {
        await expect(this.detailEmpty).toBeVisible();
        await expect(this.detailContent).toHaveClass(/hidden/);
    }

    async verifySearchControlsVisible(): Promise<void> {
        await expect(this.searchInput).toBeVisible();
        await expect(this.searchBtn).toBeVisible();
        await expect(this.clearBtn).toBeVisible();
        await expect(this.reindexBtn).toBeVisible();
        await expect(this.dateFrom).toBeVisible();
        await expect(this.dateTo).toBeVisible();
    }
}
