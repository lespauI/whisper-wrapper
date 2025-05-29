export interface TabTestData {
  tabName: 'upload' | 'record' | 'transcription';
  displayText: string;
  icon: string;
}

export interface ModelTestData {
  value: string;
  displayName: string;
  testDescription: string;
}

export interface SettingsTestData {
  language: string;
  threads: string;
  translate: boolean;
  description: string;
}

export const TAB_TEST_DATA: TabTestData[] = [
  { tabName: 'upload', displayText: '📁 Upload File', icon: '📁' },
  { tabName: 'record', displayText: '🎙️ Record Audio', icon: '🎙️' },
  { tabName: 'transcription', displayText: '📝 Transcription', icon: '📝' }
];

export const MODEL_TEST_DATA: ModelTestData[] = [
  { value: 'tiny', displayName: 'Tiny', testDescription: 'smallest and fastest model' },
  { value: 'base', displayName: 'Base', testDescription: 'balanced model for general use' },
  { value: 'small', displayName: 'Small', testDescription: 'higher accuracy model' },
  { value: 'medium', displayName: 'Medium', testDescription: 'professional quality model' },
  { value: 'large', displayName: 'Large', testDescription: 'highest accuracy model' },
  { value: 'turbo', displayName: 'Turbo', testDescription: 'optimized large model' }
];

export const SETTINGS_TEST_DATA: SettingsTestData[] = [
  { language: 'en', threads: '4', translate: false, description: 'English with 4 threads, no translation' },
  { language: 'fr', threads: '8', translate: true, description: 'French with 8 threads, with translation' },
  { language: 'es', threads: '2', translate: false, description: 'Spanish with 2 threads, no translation' }
];

export const SUPPORTED_FORMATS = [
  'MP3', 'WAV', 'M4A', 'FLAC', 'OGG', 'MP4', 'MOV', 'AVI', 'MKV', 'WEBM'
];

export const TABLE_HEADERS = [
  'Model', 'Parameters', 'VRAM Required', 'Relative Speed', 'Best For', 'Languages'
];

export const FEATURE_LIST = [
  'Auto-save as you type',
  'Undo/Redo support', 
  'Find & Replace',
  'Multiple export formats',
  'Keyboard shortcuts'
];