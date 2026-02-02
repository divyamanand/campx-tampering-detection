# Global Settings Implementation Summary

## Overview

A comprehensive global settings system has been implemented to store and manage application configuration centrally. This eliminates the need to pass configuration parameters through multiple function calls and ensures all parts of the application use consistent settings.

## What Changed

### 1. New Files Created

#### Main Process Settings Service
- **File**: `src/main/services/SettingsService.ts`
- **Purpose**: Handles reading/writing settings.json, manages in-memory settings
- **Features**:
  - Singleton pattern for global access
  - Automatic file creation on first save
  - Graceful handling of missing/corrupted files
  - JSON file storage in app's userData directory

#### Renderer Process Settings Service
- **File**: `src/renderer/src/services/SettingsService.ts`
- **Purpose**: Type-safe wrapper for IPC calls to main process
- **Provides**: Async methods to read/update settings from renderer

#### Documentation
- **File**: `SETTINGS_SERVICE.md` - Comprehensive API and usage guide
- **File**: `GLOBAL_SETTINGS_IMPLEMENTATION.md` - This file

### 2. Files Modified

#### Main Process IPC Handlers
- **File**: `src/main/index.ts`
- **Changes**:
  - Added import for SettingsService
  - Added IPC handlers:
    - `get-settings`: Retrieve current settings
    - `update-settings`: Update multiple settings
    - `update-setting`: Update single setting
    - `reset-settings`: Reset to defaults
  - Initialize settings on app startup

#### Scanner Handlers
- **File**: `src/main/scanner.ts`
- **Changes**:
  - All three handlers (`scan-pdf-file`, `scan-pdf-batch`, `scan-directory`) updated
  - Removed `logsDirectory` parameter
  - Now read directory from global settings
  - Merge provided config with global settings:
    ```typescript
    const mergedConfig = {
      initialScale: config.initialScale ?? settings.initialScale,
      enableRotation: config.enableRotation ?? settings.enableRotation,
      rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
    };
    ```
  - Use `settings.directory` for logging automatically

#### Scanner Service
- **File**: `src/renderer/src/services/ScannerService.ts`
- **Changes**:
  - Removed `logsDirectory` parameter from all methods
  - Updated JSDoc to indicate automatic logging
  - Simplified method signatures:
    ```typescript
    // Before
    async scanSingleFile(filePath, config, logsDirectory)

    // After
    async scanSingleFile(filePath, config)
    ```

#### ScannerExample Component
- **File**: `src/renderer/src/components/ScannerExample.tsx`
- **Changes**:
  - Added `useEffect` to load settings on component mount
  - Load config and directory from global settings
  - Added `updateConfigAndSettings()` function
  - All config changes now save to global settings
  - Directory selection auto-saves to global settings
  - Added loading state while settings are being loaded

### 3. Settings Structure

```typescript
interface AppSettings {
  directory: string;           // Working directory (used for logs)
  pollingInterval: number;    // Polling interval in milliseconds
  rotationDegrees: number;    // Rotation degrees for image processing
  initialScale: number;       // PDF initial scale factor
  enableRotation: boolean;    // Enable rotation attempts
}

// Default values
{
  directory: "",
  pollingInterval: 5000,
  rotationDegrees: 180,
  initialScale: 3,
  enableRotation: true
}
```

## Key Improvements

### Before: Multiple Parameters
```typescript
const logsDir = '/path/to/logs';
const config = { initialScale: 3, enableRotation: true };
await scannerService.scanFile(filePath, config, logsDir);
await scannerService.scanDirectory(dirPath, config, logsDir);
await scannerService.scanBatch(files, config, logsDir);
```

### After: Global Settings
```typescript
// Set once
await settingsService.setDirectory('/path/to/logs');
await settingsService.updateSettings({ initialScale: 3, enableRotation: true });

// Use everywhere - no parameters needed
await scannerService.scanFile(filePath);
await scannerService.scanDirectory(dirPath);
await scannerService.scanBatch(files);
```

## How It Works

### 1. Initialization Flow
```
App Starts
    ↓
app.whenReady() triggers
    ↓
initializeSettings() called
    ↓
SettingsService loads settings.json
    ↓
Settings available globally
```

### 2. Component Mounting
```
ScannerExample mounts
    ↓
useEffect runs
    ↓
settingsService.getSettings() called
    ↓
Config and directory loaded
    ↓
Component state updated
```

### 3. Directory Selection
```
User clicks directory picker
    ↓
handleSelectDirectory()
    ↓
settingsService.setDirectory(path) called
    ↓
IPC: 'update-setting' -> main process
    ↓
settings.json updated
```

### 4. Scan Operation
```
User clicks "Scan"
    ↓
scannerService.scanDirectory(dirPath, config)
    ↓
IPC: 'scan-directory' -> main process
    ↓
Scanner handler reads global settings
    ↓
Merges provided config with global settings
    ↓
Uses settings.directory for logging
    ↓
Results logged to logs.json
```

## IPC Communication

### New IPC Channels

1. **get-settings**
   - Direction: Renderer → Main
   - Returns: Current AppSettings
   - Used by: SettingsService.getSettings()

2. **update-settings**
   - Direction: Renderer → Main
   - Parameters: Partial<AppSettings>
   - Returns: Updated AppSettings
   - Used by: SettingsService.updateSettings()

3. **update-setting**
   - Direction: Renderer → Main
   - Parameters: key (string), value (any)
   - Returns: Updated AppSettings
   - Used by: SettingsService.updateSetting()

4. **reset-settings**
   - Direction: Renderer → Main
   - Returns: Default AppSettings
   - Used by: SettingsService.resetSettings()

## File Locations

### Settings Storage
- **Windows**: `C:\Users\<username>\AppData\Roaming\<appname>\settings.json`
- **macOS**: `~/Library/Application Support/<appname>/settings.json`
- **Linux**: `~/.config/<appname>/settings.json`

### Example settings.json
```json
{
  "directory": "/home/user/pdf-documents",
  "pollingInterval": 5000,
  "rotationDegrees": 180,
  "initialScale": 3,
  "enableRotation": true
}
```

## Benefits

1. **Centralized Configuration** - All settings in one place
2. **Persistent Storage** - Settings survive app restart
3. **No Parameter Passing** - Clean function signatures
4. **Type Safety** - TypeScript interfaces prevent errors
5. **Auto-save** - Changes saved immediately
6. **Global Access** - Any component can read/modify settings
7. **Graceful Fallbacks** - Defaults used if file missing
8. **Error Handling** - Corrupted files don't crash app

## Usage Examples

### Load Settings (Component Mount)
```typescript
useEffect(() => {
  const loadSettings = async () => {
    const appSettings = await settingsService.getSettings();
    setConfig({
      initialScale: appSettings.initialScale,
      enableRotation: appSettings.enableRotation,
      rotationDegrees: appSettings.rotationDegrees,
    });
  };
  loadSettings();
}, []);
```

### Save Directory
```typescript
const handleSelectDirectory = async () => {
  const selected = await window.electronAPI.selectDirectory();
  if (selected) {
    await settingsService.setDirectory(selected);
  }
};
```

### Update Multiple Settings
```typescript
await settingsService.updateSettings({
  initialScale: 2,
  rotationDegrees: 90,
  enableRotation: false,
});
```

### Update Single Setting
```typescript
await settingsService.updateSetting('pollingInterval', 3000);
```

### Reset to Defaults
```typescript
await settingsService.resetSettings();
```

## Integration with Logging

The global directory setting is automatically used for logging:

```typescript
// In scanner handlers
if (settings.directory) {
  const logService = new LogService(settings.directory);
  await logService.logFileProcess(result);
}
```

This means:
- User selects directory once
- Selected directory automatically used for logs
- No separate logs directory parameter needed
- logs.json created in same directory as PDFs

## Testing the Implementation

### 1. Verify Settings File Created
```
1. Open app
2. Select a directory
3. Check app data folder for settings.json
4. Verify directory is saved
```

### 2. Test Persistence
```
1. Set directory and config in app
2. Close and restart app
3. Verify settings loaded on startup
4. Check config matches saved values
```

### 3. Test Auto-logging
```
1. Set directory in app
2. Scan a PDF
3. Check directory for logs.json
4. Verify results logged
```

## Future Enhancements

Possible future additions:
- Settings UI panel to modify all settings
- Export/import settings
- Multiple configuration profiles
- Settings validation
- Change notifications to all listeners

## Troubleshooting

### Settings not persisting
- Check app has write permissions to userData directory
- Verify settings.json exists and is valid JSON
- Check console for error messages

### Settings not loading on startup
- Verify initializeSettings() called in app.whenReady()
- Check userData directory location
- Look for corrupted settings.json

### Logging not working with global settings
- Verify directory is set in settings
- Check directory exists and is writable
- Verify LogService receives correct directory from settings

## Related Documentation

- `SETTINGS_SERVICE.md` - Complete API reference
- `LOG_SERVICE.md` - Logging integration
- `src/main/services/SettingsService.ts` - Implementation
- `src/renderer/src/services/SettingsService.ts` - Renderer wrapper
