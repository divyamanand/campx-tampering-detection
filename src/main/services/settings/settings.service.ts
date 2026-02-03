import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';

export interface AppSettings {
  directory: string;
  pollingInterval: number;
  rotationDegrees: number;
  initialScale: number;
  enableRotation: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  directory: '',
  pollingInterval: 5000,
  rotationDegrees: 180,
  initialScale: 3,
  enableRotation: true,
};

/**
 * SettingsService - Manages global application settings
 *
 * Persists settings to settings.json in the app's userData directory
 */
export class SettingsService {
  private settingsFilePath: string;
  private settings: AppSettings;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsFilePath = path.join(userDataPath, 'settings.json');
    this.settings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Load settings from file
   */
  async loadSettings(): Promise<AppSettings> {
    try {
      const fileContent = await fs.readFile(this.settingsFilePath, 'utf-8');
      const loadedSettings = JSON.parse(fileContent);
      this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
      return this.settings;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.settings;
      }
      console.warn(`Warning: settings.json is invalid, using defaults: ${error}`);
      return this.settings;
    }
  }

  /**
   * Save settings to file
   */
  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    try {
      this.settings = { ...this.settings, ...settings };

      const userDataPath = app.getPath('userData');
      await fs.mkdir(userDataPath, { recursive: true });

      await fs.writeFile(
        this.settingsFilePath,
        JSON.stringify(this.settings, null, 2),
        'utf-8'
      );
      return this.settings;
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error(
        `Failed to save settings: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get current settings
   */
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Update a single setting
   */
  async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<AppSettings> {
    return this.saveSettings({ [key]: value });
  }

  /**
   * Get a specific setting value
   */
  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults(): Promise<AppSettings> {
    return this.saveSettings(DEFAULT_SETTINGS);
  }
}

/**
 * Global singleton instance
 */
let settingsServiceInstance: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new SettingsService();
  }
  return settingsServiceInstance;
}

export async function initializeSettings(): Promise<AppSettings> {
  const service = getSettingsService();
  return service.loadSettings();
}
