import { test as base } from '@playwright/test';
import {
  BasePage,
  SettingsPage,
  ModelComparisonPage,
  FileUploadPage,
  TranscriptionPage
} from '../pages';

type PageFixtures = {
  basePage: BasePage;
  settingsPage: SettingsPage;
  modelComparisonPage: ModelComparisonPage;
  fileUploadPage: FileUploadPage;
  transcriptionPage: TranscriptionPage;
};

export const test = base.extend<PageFixtures>({
  basePage: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await basePage.goto();
    await use(basePage);
  },

  settingsPage: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await basePage.goto();
    const settingsPage = new SettingsPage(page);
    await use(settingsPage);
  },

  modelComparisonPage: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await basePage.goto();
    const modelComparisonPage = new ModelComparisonPage(page);
    await use(modelComparisonPage);
  },

  fileUploadPage: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await basePage.goto();
    const fileUploadPage = new FileUploadPage(page);
    await fileUploadPage.ensureUploadTabActive();
    await use(fileUploadPage);
  },

  transcriptionPage: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await basePage.goto();
    const transcriptionPage = new TranscriptionPage(page);
    await transcriptionPage.ensureTranscriptionTabActive();
    await use(transcriptionPage);
  }
});

export { expect } from '@playwright/test';