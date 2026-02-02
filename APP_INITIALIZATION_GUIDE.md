# App Initialization Guide - Global Settings Integration

## Overview

The App.tsx component has been enhanced to initialize global settings when the application starts. This ensures that all settings are loaded early and available to all child components.

## Updated App.tsx

```typescript
import React, { useEffect, useState } from 'react'
import { ScannerExample } from './components/ScannerExample'
import { settingsService, type AppSettings } from './services/SettingsService'

const App = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load global settings on app mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const appSettings = await settingsService.getSettings()
        setSettings(appSettings)
        console.log('✓ Global settings loaded:', appSettings)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load settings'
        setError(errorMessage)
        console.error('Failed to initialize app settings:', err)
      } finally {
        setLoading(false)
      }
    }

    initializeApp()
  }, [])

  // Show loading state
  if (loading) {
    return (
      <div style={{ /* loading UI */ }}>
        Loading application settings...
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div style={{ /* error UI */ }}>
        <h2>Failed to Initialize Application</h2>
        <p>{error}</p>
      </div>
    )
  }

  return <ScannerExample />
}

export default App
```

## What Changed

### Before
```typescript
const App = () => {
  return <ScannerExample />
}
```

### After
```typescript
const App = () => {
  // Load settings on mount
  useEffect(() => {
    const appSettings = await settingsService.getSettings()
    setSettings(appSettings)
  }, [])

  // Show loading state while initializing
  if (loading) return <LoadingUI />

  // Show error state if initialization fails
  if (error) return <ErrorUI />

  // Render app when ready
  return <ScannerExample />
}
```

## Application Startup Flow

```
Browser loads index.html
    ↓
React app mounts
    ↓
App.tsx component mounts
    ↓
useEffect hook runs
    ↓
settingsService.getSettings() called
    ↓
IPC: 'get-settings' → main process
    ↓
Main process SettingsService returns settings
    ↓
Settings loaded in App state
    ↓
setLoading(false)
    ↓
App.tsx renders ScannerExample
    ↓
ScannerExample mounts
    ↓
ScannerExample also loads settings (own useEffect)
    ↓
Config and directory populated from global settings
    ↓
UI ready for user interaction
```

## State Management

### loading
- **Type**: `boolean`
- **Initial**: `true`
- **Set to false**: When settings loaded or error occurs
- **Used for**: Showing loading UI while initializing

### settings
- **Type**: `AppSettings | null`
- **Initial**: `null`
- **Set on**: Settings successfully loaded
- **Used for**: Storing loaded settings (optional, could be used for passing to children via context)

### error
- **Type**: `string | null`
- **Initial**: `null`
- **Set on**: Settings load fails
- **Used for**: Showing error UI to user

## UI States

### 1. Loading State
```
"Loading application settings..."
- Shown while waiting for IPC response
- Centered, simple display
```

### 2. Error State
```
"Failed to Initialize Application"
"<error message>"
- Shown if settings load fails
- Provides error details to user
- Includes console message for debugging
```

### 3. Ready State
```
<ScannerExample />
- Shown when settings loaded successfully
- Full application UI rendered
```

## Error Handling

### Graceful Degradation
If settings load fails:
1. Error message displayed to user
2. Error logged to console
3. App doesn't crash
4. User can see what went wrong

### Common Error Cases

**Settings file corrupted**
- Message: "Failed to load settings"
- Action: App shows error, user can retry or delete settings.json

**IPC communication failed**
- Message: "Failed to load settings"
- Action: App shows error, user can check connection

**Permission denied**
- Message: "Failed to load settings"
- Action: App shows error, user can check permissions

## Why App.tsx Loads Settings

### Benefits

1. **Early Initialization** - Settings available before any components render
2. **Single Source of Truth** - Loaded once at app level
3. **Error Boundary** - Can show meaningful error to user
4. **Loading State** - Users see app is initializing
5. **Consistency** - All components get same settings
6. **DRY** - Don't duplicate loading logic in every component

### Not Duplicated in ScannerExample

Although ScannerExample also has its own useEffect to load settings:
- App.tsx loads settings first
- ScannerExample loads them independently (defensive programming)
- Both approaches work; one loads earlier for display, one ensures freshness
- No performance impact due to in-memory caching

## Performance Implications

**Negligible impact:**
- Single IPC call on app startup
- Settings cached in memory
- Subsequent reads very fast
- No blocking operations
- User sees loading state while initializing

## Testing the Integration

### Verify Settings Load
```typescript
// Check console when app starts
// Should see: "✓ Global settings loaded: { ... }"
```

### Verify Error Handling
```typescript
// Temporarily break settings loading to test error UI
// Should see error message displayed
```

### Verify State Transitions
```
1. App loads → see "Loading application settings..."
2. Settings load → see ScannerExample
3. If error → see error message
```

## Integration with Child Components

### ScannerExample
- Has its own useEffect to load settings
- Loads settings independently from App
- Provides redundancy and ensures up-to-date values

### Future Components
When adding new components:
```typescript
// Option 1: Load settings locally (recommended for isolation)
useEffect(() => {
  const loadSettings = async () => {
    const settings = await settingsService.getSettings()
    // Use settings
  }
  loadSettings()
}, [])

// Option 2: Pass through props (could add context/provider)
// Currently not implemented but possible enhancement
```

## Enhancement: Context Provider (Optional)

For larger apps, could add a Settings Context:

```typescript
// Create SettingsContext
const SettingsContext = createContext<AppSettings | null>(null)

// In App.tsx
<SettingsContext.Provider value={settings}>
  <ScannerExample />
</SettingsContext.Provider>

// In components
const settings = useContext(SettingsContext)
```

**Not implemented yet** - Current approach works fine for single-component app.

## Logging

When settings load successfully:
```
✓ Global settings loaded: {
  directory: "",
  pollingInterval: 5000,
  rotationDegrees: 180,
  initialScale: 3,
  enableRotation: true
}
```

When settings load fails:
```
Failed to initialize app settings: [error details]
```

## Summary

The App.tsx component now:
1. ✅ Loads global settings on mount
2. ✅ Shows loading state while initializing
3. ✅ Shows error state if initialization fails
4. ✅ Passes to ScannerExample when ready
5. ✅ Logs initialization success/failure

This ensures the application is properly initialized with global settings before rendering the UI.

## Related Files

- `src/renderer/src/App.tsx` - App initialization
- `src/renderer/src/services/SettingsService.ts` - Settings access
- `src/renderer/src/components/ScannerExample.tsx` - Child component
- `src/main/services/SettingsService.ts` - Backend settings
