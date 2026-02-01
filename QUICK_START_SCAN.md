# Quick Start: Using the Scan Component

## Copy-Paste Integration

### Option 1: Using React Router (Recommended)

**src/main.tsx**
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { Scan } from './pages/Scan'
import './main.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/scan" element={<Scan />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
```

**src/App.tsx** (add navigation)
```typescript
import { Link } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <div className="app-container">
      <nav style={{ padding: '1rem', background: '#f0f0f0' }}>
        <Link to="/" style={{ marginRight: '2rem' }}>Home</Link>
        <Link to="/scan">Scanner</Link>
      </nav>
      {/* Your existing content */}
    </div>
  )
}

export default App
```

### Option 2: Using State Management (Simple)

**src/App.tsx**
```typescript
import { useState } from 'react'
import { Scan } from './pages/Scan'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'scan'>('home')

  return (
    <div className="app-container">
      {currentPage === 'scan' ? (
        <>
          <button onClick={() => setCurrentPage('home')}>← Back to Home</button>
          <Scan />
        </>
      ) : (
        <>
          <h1>Welcome</h1>
          <button onClick={() => setCurrentPage('scan')}>
            📄 Go to PDF Scanner
          </button>
          {/* Your existing content */}
        </>
      )}
    </div>
  )
}

export default App
```

### Option 3: Standalone Modal

**src/App.tsx**
```typescript
import { useState } from 'react'
import { Scan } from './pages/Scan'
import './App.css'

function App() {
  const [showScanner, setShowScanner] = useState(false)

  return (
    <div className="app-container">
      <button onClick={() => setShowScanner(true)}>
        📄 Open Scanner
      </button>

      {showScanner && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <button
              onClick={() => setShowScanner(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
            <Scan />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
```

## Direct Hook Usage (Advanced)

If you want to build your own UI around the scanner:

**src/components/CustomScanUI.tsx**
```typescript
import { useState } from 'react'
import { useSingleFileScan } from '../hooks/useSingleFileScan'
import { useDirectoryScan } from '../hooks/useDirectoryScan'

export function CustomScanUI() {
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [path, setPath] = useState('')

  const {
    scanning: singleScanning,
    result: singleResult,
    error: singleError,
    scanFile,
  } = useSingleFileScan()

  const {
    scanning: dirScanning,
    results,
    scanProgress,
    scanDirectory,
  } = useDirectoryScan()

  const handleScan = async () => {
    if (mode === 'single') {
      await scanFile(path, { initialScale: 3 })
    } else {
      await scanDirectory(path, { enableRotation: true })
    }
  }

  return (
    <div>
      <select value={mode} onChange={(e) => setMode(e.target.value as 'single' | 'batch')}>
        <option value="single">Single File</option>
        <option value="batch">Directory</option>
      </select>

      <input
        type="text"
        placeholder="Enter path"
        value={path}
        onChange={(e) => setPath(e.target.value)}
      />

      <button onClick={handleScan} disabled={singleScanning || dirScanning}>
        Scan
      </button>

      {singleError && <p style={{ color: 'red' }}>Error: {singleError}</p>}
      {singleResult && <pre>{JSON.stringify(singleResult, null, 2)}</pre>}

      {scanProgress && <p>Scanning: {scanProgress.fileName}</p>}
      {Object.keys(results).length > 0 && (
        <div>
          <h3>Results:</h3>
          {Object.entries(results).map(([name, result]) => (
            <p key={name}>{name}: {result.success ? '✓' : '✗'}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Service Usage (Non-React)

**src/utils/scanPDFs.ts**
```typescript
import { scannerService } from '../services/ScannerService'

export async function scanSinglePDF(filePath: string) {
  try {
    const result = await scannerService.scanSingleFile(filePath, {
      initialScale: 3,
      enableRotation: true,
    })
    console.log(`Scanned ${filePath}: ${result.success ? 'Success' : 'Failed'}`)
    return result
  } catch (error) {
    console.error('Scan failed:', error)
    throw error
  }
}

export async function scanDirectory(dirPath: string) {
  try {
    const result = await scannerService.scanDirectory(dirPath, {
      initialScale: 3,
    })
    console.log(`Scanned ${result.scannedCount} files, ${result.failedCount} failed`)
    return result
  } catch (error) {
    console.error('Directory scan failed:', error)
    throw error
  }
}

// Listen to progress updates
scannerService.onScanProgress((progress) => {
  console.log(`Processing ${progress.fileName}: Page ${progress.pageNumber}/${progress.totalPages}`)
})
```

## Common Patterns

### Pattern 1: Scan on Mount

```typescript
import { useEffect } from 'react'
import { useSingleFileScan } from '../hooks/useSingleFileScan'

export function AutoScan({ filePath }: { filePath: string }) {
  const { scanning, result, scanFile } = useSingleFileScan()

  useEffect(() => {
    scanFile(filePath)
  }, [filePath, scanFile])

  return (
    <div>
      {scanning && <p>Scanning...</p>}
      {result && <p>Pages: {result.totalPages}</p>}
    </div>
  )
}
```

### Pattern 2: Batch Processing with Progress Bar

```typescript
import { useDirectoryScan } from '../hooks/useDirectoryScan'

export function DirectoryScanWithProgress({ dirPath }: { dirPath: string }) {
  const {
    scanning,
    scanProgress,
    scannedCount,
    scanDirectory,
  } = useDirectoryScan()

  const progress = scanProgress ? (scanProgress.pageNumber / scanProgress.totalPages) * 100 : 0

  return (
    <div>
      <button onClick={() => scanDirectory(dirPath)} disabled={scanning}>
        {scanning ? 'Scanning...' : 'Start'}
      </button>

      {scanning && (
        <div>
          <div style={{
            width: '100%',
            height: '20px',
            background: '#e0e0e0',
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: '#4CAF50',
              transition: 'width 0.3s',
            }} />
          </div>
          <p>{scanProgress?.fileName}</p>
        </div>
      )}

      <p>Scanned: {scannedCount}</p>
    </div>
  )
}
```

### Pattern 3: File Upload + Scan

```typescript
import { useRef } from 'react'
import { useSingleFileScan } from '../hooks/useSingleFileScan'

export function FileUploadAndScan() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { scanning, result, scanFile } = useSingleFileScan()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Note: File API gives us File, but scanFile expects file path
    // In Electron, you'd need to use File dialog or special handling
    alert('Use directory picker for file paths')
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
      />
      {scanning && <p>Scanning...</p>}
      {result && <p>Found {result.totalPages} pages</p>}
    </div>
  )
}
```

## Testing

### Example Jest Test

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Scan } from '../pages/Scan'

describe('Scan Component', () => {
  it('renders scan component', () => {
    render(<Scan />)
    expect(screen.getByText(/PDF Scanner/i)).toBeInTheDocument()
  })

  it('allows mode selection', async () => {
    render(<Scan />)
    const singleFileBtn = screen.getByText(/Single File/i)
    await userEvent.click(singleFileBtn)
    expect(singleFileBtn).toHaveStyle({ color: '#6366f1' })
  })

  it('validates empty path', async () => {
    render(<Scan />)
    const startBtn = screen.getByText(/Start Scan/i)
    await userEvent.click(startBtn)
    // Should show alert or validation error
  })
})
```

## Next Steps

1. **Choose integration method** - Pick one of the options above
2. **Install dependencies** - Ensure React Router (if using Option 1)
3. **Update imports** - Adjust paths based on your project structure
4. **Test** - Try scanning a known PDF file
5. **Customize** - Modify colors, text, or behavior as needed

## Troubleshooting Integration

### Component not found
```
Error: Cannot find module './pages/Scan'
```
Make sure `Scan.tsx` is in `src/renderer/src/pages/`

### electronAPI is undefined
```
TypeError: Cannot read property 'invoke' of undefined
```
Check that preload script is loaded and `electronAPI` is exposed

### Types not recognized
```
TypeScript error: Property 'invoke' does not exist on type 'Window'
```
Ensure `global.d.ts` has the `electronAPI` type definition

## Performance Tips

- Use `React.memo()` to prevent unnecessary re-renders
- Consider debouncing path input
- Use lazy loading for the Scan component:
  ```typescript
  const Scan = React.lazy(() => import('./pages/Scan'))
  ```

## Accessibility

The component is keyboard accessible:
- Tab through buttons and inputs
- Enter to activate buttons
- Escape to close modals (when implementing)
