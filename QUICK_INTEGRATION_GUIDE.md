# Quick Integration Guide - Global Settings

## For Developers

Quick reference for using global settings in your code.

## Using Settings in Components

### Load Settings on Mount
```typescript
import { settingsService } from '@/renderer/src/services/SettingsService';
import { useEffect, useState } from 'react';

export const MyComponent = () => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await settingsService.getSettings();
      setConfig(settings);
    };
    loadSettings();
  }, []);

  return <div>{/* Use config */}</div>;
};
```

### Update Directory
```typescript
const handleDirectorySelect = async () => {
  const dir = await window.electronAPI.selectDirectory();
  if (dir) {
    await settingsService.setDirectory(dir);
  }
};
```

### Update Config
```typescript
const handleConfigChange = async (newConfig) => {
  await settingsService.updateSettings(newConfig);
};
```

### Update Single Setting
```typescript
await settingsService.updateSetting('initialScale', 2);
await settingsService.updateSetting('pollingInterval', 3000);
```

## Using Settings in Scanner Handlers

### Read Settings
```typescript
import { getSettingsService } from './services/SettingsService';

const settingsService = getSettingsService();
const settings = settingsService.getSettings();

// Access directory
const logsDir = settings.directory;

// Access config
const scale = settings.initialScale;
const rotation = settings.enableRotation;
```

### Merge Config with Global Settings
```typescript
const mergedConfig: PDFManagerConfig = {
  initialScale: config.initialScale ?? settings.initialScale,
  enableRotation: config.enableRotation ?? settings.enableRotation,
  rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
};

const pdfManager = new PDFManager(mergedConfig);
```

### Use Directory for Logging
```typescript
if (settings.directory) {
  const logService = new LogService(settings.directory);
  await logService.logFileProcess(result);
}
```

## Available Methods

### Renderer Process
```typescript
import { settingsService } from '@/renderer/src/services/SettingsService';

// Get all settings
const settings = await settingsService.getSettings();

// Update multiple settings
await settingsService.updateSettings({
  initialScale: 3,
  enableRotation: true,
});

// Update single setting
await settingsService.updateSetting('directory', '/path');

// Convenience methods
await settingsService.setDirectory('/path/to/dir');
const dir = await settingsService.getDirectory();

// Reset to defaults
await settingsService.resetSettings();
```

### Main Process
```typescript
import { getSettingsService } from './services/SettingsService';

const settings = getSettingsService();

// Get all settings (synchronous)
const allSettings = settings.getSettings();

// Get specific setting (synchronous)
const scale = settings.getSetting('initialScale');

// Save settings (async)
await settings.saveSettings({ initialScale: 2 });

// Update single setting (async)
await settings.updateSetting('directory', '/path');

// Reset to defaults (async)
await settings.resetToDefaults();
```

## Settings Object

```typescript
interface AppSettings {
  directory: string;              // Working directory (for PDFs and logs)
  pollingInterval: number;       // Polling interval in ms (default: 5000)
  rotationDegrees: number;       // Rotation degrees (default: 180)
  initialScale: number;          // PDF scale (default: 3)
  enableRotation: boolean;       // Enable rotation (default: true)
}
```

## Common Patterns

### Pattern 1: Load and Use in Component
```typescript
export const MyComponent = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    settingsService.getSettings().then(setSettings);
  }, []);

  if (!settings) return <div>Loading...</div>;

  return (
    <div>
      <input
        value={settings.initialScale}
        onChange={(e) =>
          settingsService.updateSetting('initialScale', parseInt(e.target.value))
        }
      />
    </div>
  );
};
```

### Pattern 2: Auto-Save on Change
```typescript
const updateConfigAndSettings = async (newConfig) => {
  // Update local state immediately
  setConfig(newConfig);

  // Save to global settings
  await settingsService.updateSettings(newConfig)
    .catch(err => console.error('Failed to save:', err));
};
```

### Pattern 3: Save Directory on Selection
```typescript
const handleSelectDirectory = async () => {
  const selected = await window.electronAPI.selectDirectory();
  if (selected) {
    setDirPath(selected);
    await settingsService.setDirectory(selected);
  }
};
```

### Pattern 4: Handler Using Global Settings
```typescript
ipcMain.handle('scan-pdf', async (_event, filePath, config = {}) => {
  const settings = getSettingsService().getSettings();

  // Merge config with global settings
  const mergedConfig = {
    initialScale: config.initialScale ?? settings.initialScale,
    enableRotation: config.enableRotation ?? settings.enableRotation,
  };

  // Use settings.directory for logging
  const pdfManager = new PDFManager(mergedConfig);
  const result = await pdfManager.processBuffer(buffer);

  if (settings.directory) {
    const logService = new LogService(settings.directory);
    await logService.logFileProcess(result);
  }

  return result;
});
```

## Error Handling

### Try-Catch
```typescript
try {
  await settingsService.setDirectory('/path');
} catch (error) {
  console.error('Failed to save directory:', error);
}
```

### Promise Catch
```typescript
settingsService.updateSettings(config)
  .catch(err => console.error('Failed to update:', err));
```

## Debugging

### Check Current Settings
```typescript
const settings = await settingsService.getSettings();
console.log('Current settings:', settings);
```

### Find Settings File
```
Windows: C:\Users\<username>\AppData\Roaming\<appname>\settings.json
macOS: ~/Library/Application Support/<appname>/settings.json
Linux: ~/.config/<appname>/settings.json
```

### Verify File Contents
```bash
# Open the settings.json file in your editor to check values
```

## Troubleshooting

### Settings Not Loading
```typescript
// Check if settings are being initialized on app startup
// Look for: await initializeSettings(); in app.whenReady()
```

### Changes Not Persisting
```typescript
// Verify directory has write permissions
// Check console for error messages
// Ensure settings.json file exists
```

### Default Values Not Used
```typescript
// Check if settings.json file is corrupted
// Delete the file to reset to defaults
// File will be recreated on next save
```

## Migration from Old API

### Old Way (Passing parameters)
```typescript
await scannerService.scanFile(filePath, config, logsDirectory);
```

### New Way (Using global settings)
```typescript
// Set once at startup
await settingsService.setDirectory(logsDirectory);

// Use everywhere without parameters
await scannerService.scanFile(filePath);
```

## Type Safety

Settings service is fully typed with TypeScript:

```typescript
// ✅ Correct - property exists
await settingsService.updateSetting('directory', '/path');

// ❌ Error - property doesn't exist
await settingsService.updateSetting('invalidKey', 'value');

// ✅ Type-safe with interface
interface AppSettings {
  directory: string;
  pollingInterval: number;
  rotationDegrees: number;
  initialScale: number;
  enableRotation: boolean;
}
```

## Performance Notes

- Settings loaded once on app startup
- Subsequent reads are from in-memory cache
- File I/O only happens on save operations
- No performance impact on scanning

## Security Notes

- Settings stored in app's userData directory (user-specific)
- File permissions inherited from OS
- IPC handlers use secure preload bridge
- No sensitive data stored by default

---

For complete documentation, see **SETTINGS_SERVICE.md**
