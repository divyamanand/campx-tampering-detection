# Scan Component Integration Guide

## Overview

The `Scan` component is a full-featured scanning interface that allows users to scan single PDF files or entire directories for QR codes and barcodes.

## Features

- **Single File Scanning** - Scan individual PDF files
- **Directory Scanning** - Scan all PDFs in a directory with batch processing
- **Real-time Progress** - Live updates during directory scans
- **Configurable Scanner** - Adjust scale, rotation, and other settings
- **Detailed Results** - View comprehensive scan results with expandable details
- **Error Handling** - User-friendly error messages

## File Structure

```
src/renderer/src/
├── pages/
│   ├── Scan.tsx          # Main scan interface component
│   └── index.ts          # Page exports
├── hooks/
│   ├── useSingleFileScan.ts    # Hook for single file scanning
│   └── useDirectoryScan.ts     # Hook for directory scanning
└── services/
    └── ScannerService.ts        # IPC service layer

src/main/
└── scanner.ts                    # IPC handlers for scanning
```

## Integration Steps

### 1. Import the Component

```typescript
import Scan from './pages/Scan';
// or
import { Scan } from './pages/Scan';
```

### 2. Add to Your App Router

If using React Router:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Scan } from './pages/Scan';
import App from './App';

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/scan" element={<Scan />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Root;
```

### 3. Add Navigation to Scan Page

```typescript
import { Link } from 'react-router-dom';

export function Navigation() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/scan">Scan PDFs</Link>
    </nav>
  );
}
```

### 4. Alternative: Render Directly

If not using routing:

```typescript
import React, { useState } from 'react';
import { Scan } from './pages/Scan';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <div>
      {currentPage === 'scan' ? (
        <Scan />
      ) : (
        <div>
          <button onClick={() => setCurrentPage('scan')}>
            Go to Scanner
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
```

## Component Props

The `Scan` component takes no required props. It's self-contained with internal state management.

## User Workflow

1. **Select Mode** - Choose between Single File or Directory
2. **Enter Path** - Input the file or directory path
3. **Configure** - Optionally adjust scanner settings (usually defaults are fine)
4. **Start Scan** - Click "Start Scan" button
5. **View Progress** - For directory scans, watch real-time progress
6. **Review Results** - See summary and detailed results
7. **Reset** - Click "Reset" to scan again

## Scanner Configuration Options

| Option | Default | Range | Description |
|--------|---------|-------|-------------|
| Initial Scale | 3 | 1-5 | Scale factor for PDF-to-image conversion |
| Enable Rotation | true | - | Allow 180° rotation attempts |
| Rotation Degrees | 180 | - | Degrees to rotate for secondary scan |

## Usage Examples

### Example 1: Single File Scan

User enters: `/home/user/documents/invoice.pdf`

Expected output:
```
File: invoice.pdf
Total Pages: 5
Status: ✓ Success
```

### Example 2: Directory Scan

User enters: `/home/user/pdf-documents`

The scanner will:
1. Find all `.pdf` files in the directory
2. Process each file sequentially or in batches
3. Show progress for each page
4. Display summary with success/failure counts
5. List all results in a grid

## Styling Customization

The component uses inline styles. To customize:

1. **Colors** - Modify the hex codes in the `styles` object
2. **Fonts** - Update font-related properties
3. **Layout** - Adjust grid templates and flexbox properties

Example customization:

```typescript
// In Scan.tsx, modify the buttonPrimary style
buttonPrimary: {
  background: '#your-color',
  color: 'white',
}
```

## API Reference

### Underlying Hooks

#### useSingleFileScan()

```typescript
const {
  scanning,      // boolean - is scanning in progress
  result,        // ScanResult - scan result data
  error,         // string | null - error message
  scanFile,      // function - trigger scan
  reset,         // function - reset state
} = useSingleFileScan();

// Usage
await scanFile('/path/to/file.pdf', { initialScale: 3 });
```

#### useDirectoryScan()

```typescript
const {
  scanning,      // boolean - is scanning in progress
  results,       // Record<string, ScanResult> - all results
  scanProgress,  // ScanProgress | null - current progress
  scannedCount,  // number - files successfully scanned
  failedCount,   // number - files that failed
  error,         // string | null - error message
  scanDirectory, // function - trigger directory scan
  reset,         // function - reset state
} = useDirectoryScan();

// Usage
await scanDirectory('/path/to/pdfs', { enableRotation: true });
```

### Underlying Service

#### scannerService

```typescript
import { scannerService } from './services/ScannerService';

// Methods
await scannerService.scanSingleFile(filePath, config);
await scannerService.scanBatch(filePaths, config);
await scannerService.scanDirectory(dirPath, config);
scannerService.onScanProgress(callback);
```

## Error Handling

The component handles errors gracefully:

- **Invalid Path** - Shows alert and prompts for valid input
- **File Not Found** - Displays error message in alert
- **Scanning Error** - Shows error message with details
- **Permission Error** - Displays accessibility issues

## Performance Considerations

- **Large Directories** - Directory scans process files in batches for stability
- **Large PDFs** - Individual page processing is optimized
- **Real-time Updates** - Progress events are throttled to prevent UI lag
- **Memory** - Results are stored in component state

## Troubleshooting

### Scan doesn't start
- Verify the file/directory path exists and is accessible
- Check file permissions
- Ensure path format is correct for your OS

### Slow scanning
- This is normal for large PDFs or directories
- Each page is processed individually
- Progress updates show actual scanning progress

### Results show 0 codes found
- Check PDF quality and format
- Verify QR codes are visible and not obstructed
- Try adjusting the scale setting

### Directory scan fails midway
- Some PDFs may be corrupted
- Check failed files list in results
- Try scanning individual files from the failed list

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Scan.tsx Component              │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  Path Selection & Config UI      │   │
│  └──────────────────────────────────┘   │
│                 │                       │
│                 ▼                       │
│  ┌──────────────────────────────────┐   │
│  │  useSingleFileScan / useDir...   │   │
│  │  (React Hooks)                   │   │
│  └──────────────────────────────────┘   │
│                 │                       │
│                 ▼                       │
│  ┌──────────────────────────────────┐   │
│  │  ScannerService (IPC Wrapper)    │   │
│  └──────────────────────────────────┘   │
│                 │                       │
└─────────────────┼─────────────────────────
                  │ IPC invoke
                  ▼
         ┌──────────────────────┐
         │  Main Process        │
         │  scanner.ts          │
         │                      │
         │  - scan-pdf-file     │
         │  - scan-pdf-batch    │
         │  - scan-directory    │
         └──────────────────────┘
                  │
                  ▼
         ┌──────────────────────┐
         │  PDFManager          │
         │  (Core Scanning)     │
         └──────────────────────┘
```

## Related Files

- [SCANNER_USAGE.md](src/renderer/src/services/SCANNER_USAGE.md) - Detailed service usage
- [src/main/scanner.ts](src/main/scanner.ts) - IPC handler definitions
- [src/renderer/src/hooks/](src/renderer/src/hooks/) - Custom hooks
- [src/renderer/src/services/ScannerService.ts](src/renderer/src/services/ScannerService.ts) - Service layer

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review component console for error details
3. Verify file paths and permissions
4. Check main process logs for scanning errors
