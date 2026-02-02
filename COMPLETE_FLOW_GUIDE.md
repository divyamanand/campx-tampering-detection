# Complete Application Flow Guide - Settings Panel Integration

## Overview

The application now has a complete, professional workflow:
1. **App Startup** → Load global settings
2. **Settings Panel** → User reviews/configures settings
3. **Scanner Panel** → User scans PDFs using configured settings
4. **Automatic Logging** → Results logged to configured directory

## Full Application Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER LAUNCHES APP                       │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │   App.tsx Component Mounts    │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  useEffect: Initialize App    │
        │  Load settings from Service   │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  IPC: get-settings            │
        │  Main process returns         │
        │  settings from settings.json  │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  Settings loaded successfully │
        │  setView('settings')          │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────────────────────────┐
        │    SettingsPanel Component Renders               │
        │  (User sees configuration screen on startup)    │
        └──────────────┬─────────────────────────────────┘
                       ↓
     ┌─────────────────────────────────────────────┐
     │        USER INTERACTIONS                     │
     ├─────────────────────────────────────────────┤
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Option 1: Select Directory          │   │
     │  │ - Click "📂 Browse Directory"       │   │
     │  │ - Dialog opens                       │   │
     │  │ - User selects folder                │   │
     │  │ - IPC: update-setting               │   │
     │  │ - settings.json updated              │   │
     │  │ - Success message shown              │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Option 2: Modify Scale              │   │
     │  │ - Change Initial Scale input        │   │
     │  │ - IPC: update-setting               │   │
     │  │ - settings.json updated              │   │
     │  │ - Value shown in summary             │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Option 3: Toggle Rotation           │   │
     │  │ - Check/uncheck Enable Rotation    │   │
     │  │ - IPC: update-setting               │   │
     │  │ - settings.json updated              │   │
     │  │ - Rotation Degrees shown/hidden      │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Option 4: Reset to Defaults         │   │
     │  │ - Click "Reset to Defaults"         │   │
     │  │ - Confirmation dialog               │   │
     │  │ - IPC: reset-settings               │   │
     │  │ - All settings reset                │   │
     │  │ - Success message shown              │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Option 5: Proceed to Scanner        │   │
     │  │ - Click "Continue to Scanner →"     │   │
     │  │ - Validates directory is set        │   │
     │  │ - handleSettingsConfirmed() called  │   │
     │  │ - setView('scanner')                │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     └─────────────────────────────────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  App.tsx: View = 'scanner'    │
        │  ScannerExample renders       │
        └──────────────┬────────────────┘
                       ↓
        ┌──────────────────────────────────────────────────┐
        │  ScannerExample Component Renders                 │
        │  - Loads settings independently (useEffect)      │
        │  - Config populated from global settings         │
        │  - Directory loaded from global settings         │
        │  - UI shows scan interface                        │
        └──────────────┬─────────────────────────────────┘
                       ↓
     ┌─────────────────────────────────────────────┐
     │        PDF SCANNING WORKFLOW                 │
     ├─────────────────────────────────────────────┤
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Single File Scan                    │   │
     │  │ - Select file via browser           │   │
     │  │ - Click "Scan File"                 │   │
     │  │ - PDFManager processes with scale  │   │
     │  │ - Rotation applied if enabled       │   │
     │  │ - Results returned                  │   │
     │  │ - LogService logs to dir            │   │
     │  │ - logs.json updated                 │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Directory Scan                      │   │
     │  │ - Select directory via browser      │   │
     │  │ - Click "Scan Directory"            │   │
     │  │ - All PDFs in dir processed         │   │
     │  │ - Progress shown for each file      │   │
     │  │ - Results accumulated               │   │
     │  │ - LogService logs all to dir        │   │
     │  │ - logs.json updated with all        │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Batch Scan                          │   │
     │  │ - Select multiple files             │   │
     │  │ - Click "Scan Batch"                │   │
     │  │ - All files processed sequentially  │   │
     │  │ - Results accumulated               │   │
     │  │ - LogService logs all to dir        │   │
     │  │ - logs.json updated with all        │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     │  ┌─────────────────────────────────────┐   │
     │  │ Automatic Logging                   │   │
     │  │ - Results logged to global dir      │   │
     │  │ - logs.json created if missing      │   │
     │  │ - Results appended to existing      │   │
     │  │ - Timestamps added                  │   │
     │  │ - File keyed by filename            │   │
     │  └─────────────────────────────────────┘   │
     │                                              │
     └─────────────────────────────────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  User sees results in UI      │
        │  Can view logs.json in dir    │
        │  Can configure new settings   │
        │  Can start new scan           │
        └──────────────────────────────┘
```

## Component Hierarchy

```
App.tsx (Main Entry Point)
├── State: view ('loading' | 'error' | 'settings' | 'scanner')
├── useEffect: Load settings on mount
└── Conditional Rendering:
    ├── 'loading' → Loading message
    ├── 'error' → Error message
    ├── 'settings' → SettingsPanel Component
    │   ├── State: settings, loading, saving, error, successMessage
    │   ├── useEffect: Load settings on mount
    │   ├── UI Elements:
    │   │   ├── Header (title, subtitle)
    │   │   ├── Messages (error, success)
    │   │   ├── 📁 Working Directory section
    │   │   │   ├── Directory display
    │   │   │   └── Browse button → IPC: select-directory
    │   │   ├── 🖼️ PDF Processing section
    │   │   │   ├── Initial Scale input → IPC: update-setting
    │   │   │   ├── Enable Rotation checkbox → IPC: update-setting
    │   │   │   └── Rotation Degrees input → IPC: update-setting
    │   │   ├── ⚡ Advanced section
    │   │   │   └── Polling Interval input → IPC: update-setting
    │   │   ├── Settings Summary section
    │   │   └── Footer
    │   │       ├── Reset button → IPC: reset-settings
    │   │       └── Continue button → onSettingsConfirmed()
    │   └── Methods:
    │       ├── handleSelectDirectory()
    │       ├── updateSetting()
    │       ├── handleResetToDefaults()
    │
    └── 'scanner' → ScannerExample Component
        ├── State: config, filePath, dirPath, settings, loadingSettings
        ├── useEffect: Load settings on mount
        ├── Tabs: Single File | Directory
        │   ├── Single File Tab:
        │   │   ├── File path input
        │   │   ├── Browse button → IPC: select-file
        │   │   ├── Scan File button → IPC: scan-pdf-file
        │   │   └── Results display
        │   └── Directory Tab:
        │       ├── Directory path input
        │       ├── Browse button → IPC: select-directory
        │       ├── Scan Directory button → IPC: scan-directory
        │       └── Progress & results display
        ├── Configuration section:
        │   ├── Initial Scale input → updateConfigAndSettings()
        │   ├── Enable Rotation checkbox → updateConfigAndSettings()
        │   └── Rotation Degrees input → updateConfigAndSettings()
        └── Methods:
            ├── handleSelectFile()
            ├── handleSelectDirectory()
            ├── handleSingleFileScan()
            ├── handleDirectoryScan()
            └── updateConfigAndSettings()
```

## Data Flow

### Settings Data Flow
```
User Action
    ↓
SettingsPanel Component
    ↓
settingsService.updateSetting(key, value)
    ↓
IPC: 'update-setting' → Main Process
    ↓
Main SettingsService.updateSetting()
    ↓
Write to settings.json
    ↓
Return updated AppSettings
    ↓
IPC Response → Renderer
    ↓
setSettings(updated)
    ↓
UI Updated with new value
    ↓
Success message shown
```

### Scan Data Flow
```
User Clicks "Scan"
    ↓
ScannerExample.handleScan()
    ↓
scannerService.scanDirectory(dirPath, config)
    ↓
IPC: 'scan-directory' → Main Process
    ↓
Scanner Handler:
  ├── Get global settings
  ├── Merge config with settings
  ├── Read PDFs from directory
  ├── Process each PDF with PDFManager
  ├── Create scan results
  ├── LogService logs to settings.directory
  └── Return results
    ↓
IPC Response → Renderer
    ↓
setResults(scanResults)
    ↓
UI Updated with results
    ↓
logs.json in directory updated
```

## Key Integration Points

### 1. App.tsx ↔ SettingsPanel
```typescript
// App.tsx
const [view, setView] = useState('loading')

// Load settings
const appSettings = await settingsService.getSettings()
setView('settings')

// Render
if (view === 'settings') {
  return <SettingsPanel onSettingsConfirmed={handleSettingsConfirmed} />
}

// SettingsPanel calls callback
const handleSettingsConfirmed = () => {
  setView('scanner')
}
```

### 2. SettingsPanel ↔ SettingsService
```typescript
// Load settings
const appSettings = await settingsService.getSettings()
setSettings(appSettings)

// Update settings
await settingsService.updateSetting('initialScale', 2)

// Reset settings
const defaults = await settingsService.resetSettings()
```

### 3. SettingsPanel ↔ Global Settings
```typescript
// All changes persist to settings.json
// Available everywhere in app
const settings = await settingsService.getSettings()
// {...entire AppSettings object}
```

### 4. ScannerExample ↔ Global Settings
```typescript
// Load settings on mount
const settings = await settingsService.getSettings()
setConfig({
  initialScale: settings.initialScale,
  enableRotation: settings.enableRotation,
  rotationDegrees: settings.rotationDegrees
})

// Save changes
updateConfigAndSettings(newConfig)
```

### 5. Scanner Handlers ↔ Global Settings
```typescript
// Main process
const settings = getSettingsService().getSettings()
const directory = settings.directory

// Merge config
const mergedConfig = {
  initialScale: config.initialScale ?? settings.initialScale,
  enableRotation: config.enableRotation ?? settings.enableRotation,
  rotationDegrees: config.rotationDegrees ?? settings.rotationDegrees,
}

// Log to directory
if (settings.directory) {
  const logService = new LogService(settings.directory)
  await logService.logFileProcess(result)
}
```

## State Management Overview

### App.tsx State
```typescript
const [view, setView] = useState<'loading' | 'error' | 'settings' | 'scanner'>('loading')
const [error, setError] = useState<string | null>(null)
```

### SettingsPanel State
```typescript
const [settings, setSettings] = useState<AppSettings | null>(null)
const [loading, setLoading] = useState(true)
const [saving, setSaving] = useState(false)
const [error, setError] = useState<string | null>(null)
const [successMessage, setSuccessMessage] = useState<string | null>(null)
```

### ScannerExample State
```typescript
const [config, setConfig] = useState<ScanConfig>(...)
const [filePath, setFilePath] = useState('')
const [dirPath, setDirPath] = useState('')
const [settings, setSettings] = useState<AppSettings | null>(null)
const [loadingSettings, setLoadingSettings] = useState(true)
// Plus scan states from hooks...
```

### Global Settings (Persisted)
```typescript
interface AppSettings {
  directory: string
  pollingInterval: number
  rotationDegrees: number
  initialScale: number
  enableRotation: boolean
}
```

## User Experience Timeline

### First Time User
```
T=0:00   → App launches
T=0:05   → SettingsPanel appears with empty directory
T=0:10   → User clicks "Browse Directory"
T=0:15   → File dialog opens
T=0:20   → User selects /path/to/pdfs
T=0:25   → Directory saved to settings.json
T=0:30   → User reviews scale/rotation settings (can modify)
T=0:35   → User clicks "Continue to Scanner"
T=0:40   → ScannerExample renders
T=0:45   → User selects PDF or directory to scan
T=0:50   → Scanning begins
T=1:00   → Results displayed
T=1:05   → logs.json created in selected directory
```

### Returning User
```
T=0:00   → App launches
T=0:05   → SettingsPanel appears with saved settings
T=0:10   → User verifies directory and settings (or modifies)
T=0:15   → User clicks "Continue to Scanner"
T=0:20   → ScannerExample renders with saved config
T=0:25   → User can immediately scan
T=0:35   → Results logged to directory
```

### Modified Settings
```
T=0:00   → User in ScannerExample
T=0:05   → User modifies scale from 3 to 2
T=0:10   → Change saved to global settings
T=0:15   → Next scan uses scale=2
T=0:20   → Results processed with new setting
```

## Benefits of This Architecture

1. **Clear Workflow** - User knows exactly what to do
2. **Validation** - Directory required before scanning
3. **Transparency** - Settings visible and editable
4. **Consistency** - All scans use same settings
5. **Persistence** - Settings remembered between sessions
6. **Flexibility** - Easy to change settings anytime
7. **Professional** - Polished UI and UX
8. **Automatic Logging** - No manual configuration needed
9. **Type Safety** - Full TypeScript throughout
10. **Error Handling** - Graceful error messages

## Testing Checklist

- [ ] App loads and shows SettingsPanel
- [ ] Directory can be selected and saved
- [ ] Settings changes are saved immediately
- [ ] Success/error messages display correctly
- [ ] Reset to Defaults works
- [ ] Continue to Scanner disabled when no directory
- [ ] ScannerExample loads with saved settings
- [ ] Scan uses saved config and directory
- [ ] logs.json created in correct directory
- [ ] Settings persist after app restart

---

**This complete flow ensures a professional, intuitive user experience with proper settings management and automatic result logging.**
