# SettingsPanel Component Guide

## Overview

The **SettingsPanel** is a dedicated settings configuration page that appears when the application starts. It allows users to review and update all global settings before proceeding to PDF scanning.

## Features

✅ **Directory Selection** - Browse and select working directory for PDFs and logs
✅ **PDF Processing Settings** - Configure initial scale and rotation options
✅ **Advanced Settings** - Fine-tune polling interval
✅ **Real-time Saving** - Changes saved immediately to global settings
✅ **Visual Feedback** - Success/error messages for user actions
✅ **Settings Summary** - Current configuration displayed clearly
✅ **Reset Option** - Restore default settings with confirmation
✅ **Validation** - Directory required before proceeding to scanner

## Application Flow

```
App Starts
    ↓
App.tsx mounts
    ↓
Load settings from SettingsService
    ↓
Show SettingsPanel
    ↓
User reviews/modifies settings
    ↓
Settings auto-save to global store
    ↓
User clicks "Continue to Scanner"
    ↓
Navigate to ScannerExample
    ↓
ScannerExample uses global settings
    ↓
User scans PDFs
    ↓
Results logged to settings.directory
```

## Component Structure

```typescript
<SettingsPanel>
├── Header
│   ├── Title: "⚙️ Application Settings"
│   └── Subtitle: "Configure your PDF scanning preferences"
│
├── Messages
│   ├── Error messages (if any)
│   └── Success messages (when settings saved)
│
├── Info Box
│   └── Helpful tip about settings
│
├── Sections
│   ├── 📁 Working Directory
│   │   ├── Current directory display
│   │   └── Browse button
│   │
│   ├── 🖼️ PDF Processing
│   │   ├── Initial Scale input
│   │   ├── Enable Rotation checkbox
│   │   └── Rotation Degrees input (conditional)
│   │
│   └── ⚡ Advanced
│       └── Polling Interval input
│
├── Summary Section
│   └── Current settings overview
│
└── Footer
    ├── Reset to Defaults button
    └── Continue to Scanner button
```

## Settings Explained

### 📁 Working Directory
**What it is:** The folder where PDF files are located and where logs.json will be saved
**How to set:** Click "📂 Browse Directory" button to open directory picker
**Required:** Yes - must be set before proceeding to scanner
**Impact:** All scan results logged to `{directory}/logs.json`

### 🖼️ Initial Scale
**What it is:** Scaling factor for PDF rendering (1-5)
**Range:** 1 (lowest quality, fastest) to 5 (highest quality, slowest)
**Default:** 3 (balanced)
**Impact:** Higher values = better quality for barcode/QR detection but slower processing
**Recommendation:** Keep at 3 unless experiencing detection issues

### Enable Rotation
**What it is:** Whether to attempt rotating images to improve barcode detection
**Default:** true (enabled)
**Impact:** When enabled, images rotated by specified degrees if needed
**Note:** Increases processing time slightly but improves detection accuracy
**When to disable:** If you have perfectly aligned barcodes/QR codes

### Rotation Degrees
**What it is:** Angle (0-360°) to rotate images if rotation is enabled
**Default:** 180 (flip/rotate 180°)
**Common values:**
- 90° - Rotate 90° clockwise
- 180° - Flip/rotate 180°
- 270° - Rotate 90° counter-clockwise
**Note:** Only visible when "Enable Rotation" is checked

### Polling Interval
**What it is:** How often to check for file changes (milliseconds)
**Range:** 100ms to 60000ms (100ms to 60 seconds)
**Default:** 5000ms (5 seconds)
**Impact:** Lower = more responsive but uses more CPU
**Recommendation:** Keep default (5000ms) for most use cases

## User Interactions

### Setting a Directory
```
1. Click "📂 Browse Directory" button
2. Native file browser opens
3. Select folder containing PDFs
4. Directory path appears in display area
5. Changes saved automatically to global settings
6. Success message shown briefly
```

### Modifying Configuration
```
1. Change Initial Scale input
2. Settings saved immediately
3. Change enables/disables Rotation Degrees input
4. User can adjust Rotation Degrees if enabled
5. Changes saved immediately
6. Current values shown below inputs
```

### Resetting to Defaults
```
1. Click "Reset to Defaults" button
2. Confirmation dialog appears
3. If confirmed:
   - All settings reset to defaults
   - Success message shown
   - Directory field cleared (requires selection again)
4. If cancelled:
   - Settings unchanged
   - Dialog closes
```

### Proceeding to Scanner
```
1. User reviews settings summary
2. Clicks "Continue to Scanner →" button
3. Button disabled if no directory selected
4. App.tsx switches view to ScannerExample
5. ScannerExample loads settings and renders
6. User can now scan PDFs
```

## Props

```typescript
interface SettingsPanelProps {
  onSettingsConfirmed?: () => void;  // Called when user confirms and proceeds
}
```

**onSettingsConfirmed:**
- Callback function triggered when "Continue to Scanner" is clicked
- Used by App.tsx to navigate from settings to scanner
- Optional (defaults to no-op)

## Styling

The component uses inline styles with:
- **Color Scheme:** Indigo primary (#6366f1), gray secondary
- **Responsive Layout:** Flexbox for proper alignment
- **Visual Hierarchy:** Different section backgrounds and borders
- **Status Indicators:** Green for success, red for errors
- **Accessibility:** Proper labels and descriptions for all inputs

## Validation Rules

| Setting | Validation | Error Handling |
|---------|-----------|-----------------|
| Directory | Required before scanner | "Continue" button disabled |
| Initial Scale | 1-5 | Input restricted with min/max |
| Rotation Degrees | 0-360 | Input restricted with min/max |
| Polling Interval | 100-60000ms | Input restricted with min/max |

## Error Handling

### Directory Selection Error
```
User attempts to select directory
    ↓
Error occurs (permission denied, etc)
    ↓
Error message displayed: "Failed to select directory"
    ↓
Settings unchanged
    ↓
User can try again
```

### Settings Save Error
```
User modifies setting
    ↓
IPC call to main process
    ↓
Save fails (filesystem error, etc)
    ↓
Error message displayed
    ↓
Settings in memory reverted
    ↓
User can try again
```

### Settings Load Error
```
App starts
    ↓
Load settings fails
    ↓
App.tsx shows error state
    ↓
Error page displayed with message
    ↓
User must check console and retry
```

## Integration with Global Settings

The SettingsPanel:
1. **Reads** settings on mount via `settingsService.getSettings()`
2. **Saves** changes immediately via `settingsService.updateSetting(key, value)`
3. **Updates** all settings via `settingsService.updateSettings(settings)`
4. **Resets** via `settingsService.resetSettings()`

All changes automatically persist to `settings.json` in app's userData directory.

## Integration with Scanner

After user confirms settings in SettingsPanel:
1. App.tsx calls `onSettingsConfirmed()`
2. View switches from 'settings' to 'scanner'
3. ScannerExample renders
4. ScannerExample loads settings independently (defensive)
5. Config populated from global settings
6. Directory from global settings used for logs

**Result:** All PDF scans use the exact settings configured in SettingsPanel

## Visual Example

```
┌─────────────────────────────────────────────────┐
│ ⚙️ Application Settings                         │
│ Configure your PDF scanning preferences         │
├─────────────────────────────────────────────────┤
│                                                 │
│ 💡 Tip: Configure these settings once...      │
│                                                 │
│ ┌──── 📁 Working Directory ─────────────────┐  │
│ │ Directory for PDF files and logs          │  │
│ │                                            │  │
│ │ [/path/to/directory..................]   │  │
│ │ [📂 Browse Directory]                    │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌──── 🖼️ PDF Processing ────────────────────┐  │
│ │ Initial Scale: [3] (higher = better)      │  │
│ │ [✓] Enable Rotation Attempts              │  │
│ │ Rotation Degrees: [180]°                  │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌──── ⚡ Advanced ──────────────────────────┐  │
│ │ Polling Interval (ms): [5000]             │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ ┌──── 📋 Settings Summary ──────────────────┐  │
│ │ Directory: /path/to/directory             │  │
│ │ Initial Scale: 3x                         │  │
│ │ Rotation: Enabled (180°)                  │  │
│ │ Polling Interval: 5000ms                  │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ [Reset to Defaults]  [Continue to Scanner →]  │
└─────────────────────────────────────────────────┘
```

## Key Benefits

1. **Clear UI** - All settings visible and editable in one place
2. **Immediate Feedback** - See changes saved instantly
3. **Validation** - Prevents proceeding without required directory
4. **Documentation** - Each setting has description and current value
5. **Easy Reset** - One-click restore to defaults
6. **Professional Look** - Clean, organized layout
7. **Non-intrusive** - Can modify settings anytime

## Related Files

- `src/renderer/src/components/SettingsPanel.tsx` - Component implementation
- `src/renderer/src/App.tsx` - App navigation to SettingsPanel
- `src/renderer/src/services/SettingsService.ts` - Settings access
- `src/main/services/SettingsService.ts` - Backend settings
- `SETTINGS_SERVICE.md` - API documentation

## Common Scenarios

### First Time User
1. App starts
2. SettingsPanel shown (settings loaded from defaults)
3. User clicks "Browse Directory" to select PDF folder
4. User reviews other settings (can accept defaults)
5. Clicks "Continue to Scanner"
6. Proceeds to scanning

### Returning User
1. App starts
2. SettingsPanel shown
3. Previous settings loaded (directory, scale, rotation, etc.)
4. User can verify or modify settings
5. Clicks "Continue to Scanner"
6. Proceeds to scanning

### Changing Settings Mid-session
1. User changes initial scale in SettingsPanel
2. Change saved to global settings
3. User proceeds to scanner
4. Next scan uses new scale setting

## Troubleshooting

### "Continue to Scanner" button disabled
**Cause:** No directory selected
**Solution:** Click "Browse Directory" and select a folder

### Directory selection not working
**Cause:** Permission issues or dialog error
**Possible solutions:**
- Check folder permissions
- Try different folder
- Check console for error details

### Settings not saving
**Cause:** Filesystem or IPC error
**Possible solutions:**
- Check app has write permissions
- Restart app
- Check console for error details

### Settings reverted after app restart
**Cause:** Settings.json file missing or corrupted
**Solution:** Delete settings.json and reconfigure (will use defaults)

## Future Enhancements

Possible improvements:
- Settings profiles (save/load multiple configurations)
- Advanced section with more options
- Tooltips for each setting
- Settings validation with error messages
- Import/export settings as JSON
- Settings history/undo
- Keyboard shortcuts
- Hotkeys for quick actions
