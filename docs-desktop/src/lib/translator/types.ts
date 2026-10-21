export type TranslationModelStatus =
  | "not-downloaded"
  | "downloading"
  | "ready"
  | "translating"
  | "error";

export interface TranslationTask {
  id: string;
  text: string;
  hash: string;
}

export interface TranslationResult {
  id: string;
  originalText: string;
  translatedText: string;
  hash: string;
}

export interface TranslationModelProgress {
  status: TranslationModelStatus;
  percent: number;
  message?: string;
  totalBytes?: number;
  downloadedBytes?: number;
}

export interface TranslationPreferences {
  enabled: boolean;
  autoTranslate: boolean;
  showToggleInHeader: boolean;
}

export const DEFAULT_TRANSLATION_PREFS: TranslationPreferences = {
  enabled: true,
  autoTranslate: false,
  showToggleInHeader: true,
};
