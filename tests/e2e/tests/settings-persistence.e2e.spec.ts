import { test, expect, Page } from '@playwright/test';
import { SettingsPage } from '../pages';

/**
 * E2E tests guarding the Settings panel against state-loading regressions.
 *
 * The renderer is served at localhost:3000 with no Electron IPC available, so
 * we install a stateful mock of `window.electronAPI` via `addInitScript` and
 * drive the real SettingsController against it.
 *
 * The motivating bug: `loadAIRefinementSettings` used to read
 * `aiSettings.enabled` directly from the IPC response, but the handler
 * returns `{ success, settings }`. The checkbox therefore loaded as
 * unchecked every time, silently disabling AI Refinement on the next save.
 */

type ConfigState = {
  whisper: {
    defaultModel: string;
    defaultLanguage: string;
    defaultThreads: number;
    translate: boolean;
    useInitialPrompt: boolean;
    initialPrompt: string;
    useGpu: boolean;
    flashAttn: boolean;
    gpuDevice: number;
    availableModels: { name: string; size: string; description: string }[];
  };
  aiRefinement: {
    enabled: boolean;
    endpoint: string;
    model: string;
    timeoutSeconds: number;
    defaultTemplateId: string | null;
  };
  meetingNotes: {
    defaultProvider: string;
    claudeModel: string;
    cliTimeoutSeconds: number;
  };
};

const DEFAULT_STATE: ConfigState = {
  whisper: {
    defaultModel: 'base',
    defaultLanguage: 'en',
    defaultThreads: 4,
    translate: false,
    useInitialPrompt: false,
    initialPrompt: '',
    useGpu: false,
    flashAttn: false,
    gpuDevice: 0,
    availableModels: [
      { name: 'tiny', size: '39M', description: 'Tiny model' },
      { name: 'base', size: '74M', description: 'Base model' }
    ]
  },
  aiRefinement: {
    enabled: true,
    endpoint: 'http://localhost:11434',
    model: 'gemma3:12b',
    timeoutSeconds: 300,
    defaultTemplateId: null
  },
  meetingNotes: {
    defaultProvider: 'claude',
    claudeModel: 'claude-sonnet-4-20250514',
    cliTimeoutSeconds: 600
  }
};

async function installElectronApiMock(page: Page, initial: ConfigState) {
  await page.addInitScript((state) => {
    // Stateful in-page mock of the Electron IPC bridge.
    const w = window as unknown as {
      __mockState: ConfigState;
      __mockCalls: { name: string; args: unknown[] }[];
      electronAPI: Record<string, unknown>;
    };
    w.__mockState = JSON.parse(JSON.stringify(state));
    w.__mockCalls = [];
    const record = (name: string, args: unknown[]) => {
      w.__mockCalls.push({ name, args });
    };
    w.electronAPI = {
      getConfig: () => {
        record('getConfig', []);
        const s = w.__mockState;
        return Promise.resolve({
          model: s.whisper.defaultModel,
          language: s.whisper.defaultLanguage,
          threads: s.whisper.defaultThreads,
          translate: s.whisper.translate,
          useInitialPrompt: s.whisper.useInitialPrompt,
          initialPrompt: s.whisper.initialPrompt,
          useGpu: s.whisper.useGpu,
          flashAttn: s.whisper.flashAttn,
          gpuDevice: s.whisper.gpuDevice,
          whisper: { availableModels: s.whisper.availableModels }
        });
      },
      setConfig: (settings: Record<string, unknown>) => {
        record('setConfig', [settings]);
        Object.assign(w.__mockState.whisper, {
          defaultModel: settings.model ?? w.__mockState.whisper.defaultModel,
          defaultLanguage: settings.language ?? w.__mockState.whisper.defaultLanguage,
          defaultThreads: settings.threads ?? w.__mockState.whisper.defaultThreads,
          translate: settings.translate ?? w.__mockState.whisper.translate,
          useInitialPrompt: settings.useInitialPrompt ?? w.__mockState.whisper.useInitialPrompt,
          initialPrompt: settings.initialPrompt ?? w.__mockState.whisper.initialPrompt,
          useGpu: settings.useGpu ?? w.__mockState.whisper.useGpu,
          flashAttn: settings.flashAttn ?? w.__mockState.whisper.flashAttn,
          gpuDevice: settings.gpuDevice ?? w.__mockState.whisper.gpuDevice
        });
        return Promise.resolve({ success: true });
      },
      // Match the real refinementHandlers contract: { success, settings }.
      getAIRefinementSettings: () => {
        record('getAIRefinementSettings', []);
        return Promise.resolve({
          success: true,
          settings: { ...w.__mockState.aiRefinement }
        });
      },
      saveAIRefinementSettings: (settings: Record<string, unknown>) => {
        record('saveAIRefinementSettings', [settings]);
        Object.assign(w.__mockState.aiRefinement, settings);
        return Promise.resolve({
          success: true,
          changed: true,
          settings: { ...w.__mockState.aiRefinement }
        });
      },
      getOllamaModels: () => {
        record('getOllamaModels', []);
        return Promise.resolve({
          success: true,
          models: [{ name: 'gemma3:12b', size: '7GB' }]
        });
      },
      testOllamaConnection: () => Promise.resolve({ success: true, message: 'ok' }),
      testWhisper: () => Promise.resolve({
        success: true,
        message: 'ok',
        details: { availableModels: w.__mockState.whisper.availableModels }
      }),
      detectGpuBackend: () => Promise.resolve({
        success: true,
        expectedBackend: 'cpu',
        platform: 'linux'
      }),
      debugAIRefinementSettings: () => Promise.resolve({
        success: true,
        configSettings: w.__mockState.aiRefinement,
        ollamaSettings: {},
        ollamaEnabled: w.__mockState.aiRefinement.enabled
      }),
      meetingNotes: {
        getConfig: () => Promise.resolve({
          success: true,
          config: { ...w.__mockState.meetingNotes }
        }),
        saveConfig: (payload: { settings: Record<string, unknown> }) => {
          record('meetingNotes.saveConfig', [payload]);
          Object.assign(w.__mockState.meetingNotes, payload.settings);
          return Promise.resolve({ success: true });
        },
        getTemplates: () => Promise.resolve({ success: true, templates: [] })
      },
      onTranscriptionProgress: () => {},
      onRecordingUpdate: () => {},
      onModelDownloadProgress: () => {},
      onRefinementProgress: () => {},
      onRefinementStream: () => {},
      removeAllListeners: () => {}
    };
  }, initial);
}

async function getMockCalls(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __mockCalls: { name: string; args: unknown[] }[] }).__mockCalls
  );
}

async function getMockState(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __mockState: ConfigState }).__mockState
  );
}

// Local helper: install mock, navigate, and return a SettingsPage object.
// We can't use the shared `settingsPage` fixture because it navigates before
// `addInitScript` would have a chance to install the IPC mock.
async function bootSettings(page: Page, state: ConfigState = DEFAULT_STATE) {
  await installElectronApiMock(page, state);
  const settingsPage = new SettingsPage(page);
  await settingsPage.goto();
  return settingsPage;
}

test.describe('Settings panel — AI Refinement persistence', () => {
  test('checkbox reflects saved enabled=true on open', async ({ page }) => {
    const settingsPage = await bootSettings(page);

    await settingsPage.openSettings();

    await expect(settingsPage.aiRefinementEnabledCheckbox).toBeChecked();
  });

  test('checkbox reflects saved enabled=false on open', async ({ page }) => {
    const state: ConfigState = JSON.parse(JSON.stringify(DEFAULT_STATE));
    state.aiRefinement.enabled = false;
    const settingsPage = await bootSettings(page, state);

    await settingsPage.openSettings();

    await expect(settingsPage.aiRefinementEnabledCheckbox).not.toBeChecked();
  });

  test('saving unrelated changes (language) preserves enabled=true', async ({ page }) => {
    const settingsPage = await bootSettings(page);

    await settingsPage.openSettings();
    await expect(settingsPage.aiRefinementEnabledCheckbox).toBeChecked();

    // Change language only — the AI Refinement checkbox must be left alone.
    await settingsPage.configureSettings({ language: 'es' });
    await settingsPage.saveSettings();

    const calls = await getMockCalls(page);
    const saveCall = calls.find(c => c.name === 'saveAIRefinementSettings');
    expect(saveCall).toBeTruthy();
    expect((saveCall!.args[0] as { enabled: boolean }).enabled).toBe(true);

    const state = await getMockState(page);
    expect(state.aiRefinement.enabled).toBe(true);

    // Re-open: checkbox should still be checked.
    await settingsPage.openSettings();
    await expect(settingsPage.aiRefinementEnabledCheckbox).toBeChecked();
  });

  test('checkbox state survives close/reopen without saving', async ({ page }) => {
    const settingsPage = await bootSettings(page);

    await settingsPage.openSettings();
    await expect(settingsPage.aiRefinementEnabledCheckbox).toBeChecked();
    await settingsPage.cancelSettings();

    await settingsPage.openSettings();
    await expect(settingsPage.aiRefinementEnabledCheckbox).toBeChecked();
  });

  test('toggling the checkbox off and saving persists enabled=false', async ({ page }) => {
    const settingsPage = await bootSettings(page);

    await settingsPage.openSettings();
    // The styled-checkbox is opacity:0; toggle via the underlying input.
    await settingsPage.aiRefinementEnabledCheckbox.setChecked(false, { force: true });
    await settingsPage.saveSettings();

    const state = await getMockState(page);
    expect(state.aiRefinement.enabled).toBe(false);

    await settingsPage.openSettings();
    await expect(settingsPage.aiRefinementEnabledCheckbox).not.toBeChecked();
  });
});
