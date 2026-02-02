# Settings Service Documentation

## Overview

The `SettingsService` is a global configuration management system that stores and manages application-wide settings. It ensures consistent configuration across the entire application without needing to pass parameters through multiple function calls.

## Architecture

### Main Process

- **File**: `src/main/services/SettingsService.ts`
- **Storage**: `settings.json` in app's userData directory
- **Responsibility**: Persist settings to file and provide access to main process

### IPC Handlers

- **Location**: `src/main/index.ts`
- **Handlers**:
  - `get-settings` - Retrieve current settings
  - `update-settings` - Update multiple settings
  - `update-setting` - Update a single setting
  - `reset-settings` - Reset to default values

### Renderer Process

- **File**: `src/renderer/src/services/SettingsService.ts`
- **Responsibility**: Provide type-safe access to settings from renderer process

## Default Settings

```typescript
{
  directory: "",                    // Working directory (same used for logs)
  pollingInterval: 5000,           // Polling interval in ms
  rotationDegrees: 180,            // Rotation degrees for image processing
  initialScale: 3,                 // PDF initial scale
  enableRotation: true             // Enable rotation attempts
}
```

## Settings File Location

- **Windows**: `C:\Users\<username>\AppData\Roaming\<appname>\settings.json`
- **macOS**: `~/Library/Application Support/<appname>/settings.json`
- **Linux**: `~/.config/<appname>/settings.json`

## Usage

### In Components

```typescript
import { settingsService } from '@/renderer/src/services/SettingsService';

// Get all settings
const settings = await settingsService.getSettings();

// Update specific setting
await settingsService.setDirectory('/path/to/directory');

// Update multiple settings
await settingsService.updateSettings({
  initialScale: 2,
  enableRotation: false,
});

// Reset to defaults
await settingsService.resetSettings();
```

### In Scanner Handlers

```typescript
// Scanner handlers automatically use global settings
const settingsService = getSettingsService();
const settings = settingsService.getSettings();

// Directory from settings used for logs
if (settings.directory) {
  const logService = new LogService(settings.directory);
  await logService.logFileProcess(result);
}

// Config from settings merged with explicit overrides
const mergedConfig = {
  initialScale: config.initialScale ?? settings.initialScale,
  enableRotation: config.enableRotation ?? settings.enableRotation,
  rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
};
```

## Key Features

✅ **Persistent Storage** - Settings saved to file and restored on app restart
✅ **Global Access** - Settings available across entire application
✅ **Type Safety** - TypeScript interfaces ensure type-safe access
✅ **IPC Bridge** - Secure communication between main and renderer processes
✅ **Auto-save** - Changes saved immediately
✅ **Default Values** - Fallback to sensible defaults

## Integration Points

### 1. Directory Selection
When user selects directory via ScannerExample:
```typescript
// Directory picker
const selected = await window.electronAPI.selectDirectory();
if (selected) {
  setDirPath(selected);
  // Auto-save to global settings
  await settingsService.setDirectory(selected);
}
```

### 2. Configuration Changes
When user modifies scanner config:
```typescript
// Update config and save to settings
await settingsService.updateSettings({
  initialScale: newValue,
  enableRotation: newValue,
  rotationDegrees: newValue,
});
```

### 3. Scan Operations
Scan handlers use global settings automatically:
```typescript
// No logsDirectory parameter needed anymore
await scannerService.scanFile('/path/to/file.pdf');
// Logs saved to settings.directory automatically
```

## Workflow

```
User Opens App
    ↓
ScannerExample mounts
    ↓
Load settings from SettingsService
    ↓
Set config and dirPath from global settings
    ↓
User selects directory
    ↓
Save directory to global settings
    ↓
User modifies config (scale, rotation)
    ↓
Save config changes to global settings
    ↓
User initiates scan
    ↓
Scanner handlers read from global settings
    ↓
Config merged with global settings
    ↓
Logs saved to settings.directory automatically
```

## File Structure

```
settings.json (in app's userData directory):
{
  "directory": "/path/to/pdf/folder",
  "pollingInterval": 5000,
  "rotationDegrees": 180,
  "initialScale": 3,
  "enableRotation": true
}
```

## API Reference

### Main Process (SettingsService)

#### Constructor
```typescript
new SettingsService()
```

#### loadSettings()
```typescript
async loadSettings(): Promise<AppSettings>
```
Load settings from file. Returns defaults if file doesn't exist.

#### saveSettings()
```typescript
async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>
```
Save settings to file. Merges with existing settings.

#### getSettings()
```typescript
getSettings(): AppSettings
```
Get current settings in memory (synchronous).

#### updateSetting()
```typescript
async updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<AppSettings>
```
Update a single setting.

#### getSetting()
```typescript
getSetting<K extends keyof AppSettings>(key: K): AppSettings[K]
```
Get a specific setting value (synchronous).

#### resetToDefaults()
```typescript
async resetToDefaults(): Promise<AppSettings>
```
Reset all settings to default values.

### Renderer Process (SettingsService)

#### getSettings()
```typescript
async getSettings(): Promise<AppSettings>
```
Get all settings from main process.

#### updateSettings()
```typescript
async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>
```
Update multiple settings at once.

#### updateSetting()
```typescript
async updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<AppSettings>
```
Update a single setting.

#### setDirectory()
```typescript
async setDirectory(directory: string): Promise<AppSettings>
```
Convenience method to set the working directory.

#### getDirectory()
```typescript
async getDirectory(): Promise<string>
```
Convenience method to get the working directory.

#### resetSettings()
```typescript
async resetSettings(): Promise<AppSettings>
```
Reset all settings to defaults.

## Error Handling

### File Not Found
- If settings.json doesn't exist, defaults are used
- File is created on first save

### Invalid JSON
- If settings.json is corrupted, warning logged
- Defaults used for this session
- File is overwritten on next save

### Permission Errors
- Error logged to console
- Thrown to caller for handling
- Doesn't affect current session settings

## Best Practices

1. **Load on Startup** - Load settings when app initializes
2. **Auto-save Changes** - Save immediately when settings change
3. **Use Global Settings** - Don't pass config as function parameters
4. **Fallback to Defaults** - Always have sensible defaults
5. **Validate User Input** - Validate before saving to settings
6. **Error Boundaries** - Catch and log errors appropriately

## Example: Complete Scan Workflow

```typescript
// 1. Load settings on component mount
useEffect(() => {
  const appSettings = await settingsService.getSettings();
  setConfig({
    initialScale: appSettings.initialScale,
    enableRotation: appSettings.enableRotation,
    rotationDegrees: appSettings.rotationDegrees,
  });
}, []);

// 2. User selects directory
const handleSelectDirectory = async () => {
  const selected = await window.electronAPI.selectDirectory();
  if (selected) {
    await settingsService.setDirectory(selected);
  }
};

// 3. User modifies config
const handleConfigChange = (newConfig) => {
  updateConfigAndSettings(newConfig);
};

// 4. User initiates scan
const handleScan = async () => {
  await scannerService.scanDirectory(dirPath);
  // Results automatically logged to settings.directory
};
```

## Integration with Scanner Service

The scanner handlers have been updated to use global settings:

```typescript
// Before: Required logsDirectory parameter
await scannerService.scanDirectory(dirPath, config, logsDirectory);

// After: Uses global settings automatically
await scannerService.scanDirectory(dirPath, config);
// Logs saved to settings.directory
```

## Migration Guide

If updating existing code:

### Old Pattern
```typescript
const logsDir = '/path/to/logs';
const config = { initialScale: 3 };
await scannerService.scanFile(filePath, config, logsDir);
```

### New Pattern
```typescript
// Set directory once via settings
await settingsService.setDirectory('/path/to/logs');
// Pass only config, directory handled globally
await scannerService.scanFile(filePath);
```

## Related Files

- `src/main/services/SettingsService.ts` - Main process implementation
- `src/renderer/src/services/SettingsService.ts` - Renderer process wrapper
- `src/main/index.ts` - IPC handler registration
- `src/renderer/src/components/ScannerExample.tsx` - Integration example
- `src/main/scanner.ts` - Scanner handlers using global settings
