/**
 * SettingsService - Renderer process wrapper for settings IPC
 *
 * Provides type-safe access to global application settings
 */

export interface AppSettings {
  directory: string;
  pollingInterval: number;
  rotationDegrees: number;
  initialScale: number;
  enableRotation: boolean;
}

class SettingsService {
  /**
   * Get current settings from main process
   */
  async getSettings(): Promise<AppSettings> {
    return window.electronAPI.invoke('get-settings');
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return window.electronAPI.invoke('update-settings', settings);
  }

  /**
   * Update a single setting
   */
  async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<AppSettings> {
    return window.electronAPI.invoke('update-setting', key, value);
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<AppSettings> {
    return window.electronAPI.invoke('reset-settings');
  }

  /**
   * Convenience method to set the directory
   */
  async setDirectory(directory: string): Promise<AppSettings> {
    return this.updateSetting('directory', directory);
  }

  /**
   * Convenience method to get the directory
   */
  async getDirectory(): Promise<string> {
    const settings = await this.getSettings();
    return settings.directory;
  }
}

// Export singleton instance
export const settingsService = new SettingsService();
