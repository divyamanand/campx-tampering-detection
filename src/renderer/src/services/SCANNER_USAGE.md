# Scanner Usage Guide

This guide explains how to use the scanner functionality in your React components.

## Overview

The scanner system consists of three main components:

1. **IPC Handlers** (Main Process): `src/main/scanner.ts`
2. **Service Layer** (Renderer): `src/renderer/src/services/ScannerService.ts`
3. **React Hooks** (Renderer):
   - `useDirectoryScan` - For scanning all PDFs in a directory
   - `useSingleFileScan` - For scanning a single PDF file

## Quick Start

### Using the Service (Recommended for non-React code)

```typescript
import { scannerService } from './services/ScannerService';

// Scan a single file
const result = await scannerService.scanSingleFile('/path/to/file.pdf', {
  initialScale: 3,
  enableRotation: true,
});

// Scan multiple files
const batchResult = await scannerService.scanBatch(
  ['/path/to/file1.pdf', '/path/to/file2.pdf'],
  { enableRotation: true }
);

// Scan entire directory
const dirResult = await scannerService.scanDirectory('/path/to/pdf/folder', {
  initialScale: 2,
});

// Listen for progress updates
scannerService.onScanProgress((progress) => {
  console.log(`Page ${progress.pageNumber}/${progress.totalPages} of ${progress.fileName}`);
});
```

### Using React Hooks

#### For Single File Scanning

```typescript
import { useSingleFileScan } from './hooks/useSingleFileScan';

function MyComponent() {
  const { scanning, result, error, scanFile, reset } = useSingleFileScan();

  const handleScan = async () => {
    const res = await scanFile('/path/to/file.pdf', {
      initialScale: 3,
      enableRotation: true,
    });

    if (res) {
      console.log(`Scanned ${res.totalPages} pages`);
    }
  };

  return (
    <div>
      <button onClick={handleScan} disabled={scanning}>
        {scanning ? 'Scanning...' : 'Scan File'}
      </button>
      {error && <p>Error: {error}</p>}
      {result && <p>Success: {result.totalPages} pages</p>}
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

#### For Directory Scanning

```typescript
import { useDirectoryScan } from './hooks/useDirectoryScan';

function DirectoryScanComponent() {
  const {
    scanning,
    results,
    scanProgress,
    scannedCount,
    failedCount,
    error,
    scanDirectory,
    reset,
  } = useDirectoryScan();

  const handleDirectoryScan = async () => {
    await scanDirectory('/path/to/pdf/folder', {
      initialScale: 3,
    });
  };

  return (
    <div>
      <button onClick={handleDirectoryScan} disabled={scanning}>
        {scanning ? 'Scanning Directory...' : 'Scan Directory'}
      </button>

      {scanning && scanProgress && (
        <div>
          <p>
            Scanning: {scanProgress.fileName}
          </p>
          <p>
            Page {scanProgress.pageNumber} / {scanProgress.totalPages}
          </p>
        </div>
      )}

      {!scanning && scannedCount > 0 && (
        <div>
          <p>Scanned: {scannedCount}, Failed: {failedCount}</p>
          <p>Results available in state</p>
        </div>
      )}

      {error && <p>Error: {error}</p>}
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

## Configuration

### PDFManagerConfig

```typescript
interface PDFManagerConfig {
  initialScale?: number;      // Scale factor for PDF conversion (default: 3)
  enableRotation?: boolean;   // Enable 180° rotation attempts (default: true)
  rotationDegrees?: number;   // Rotation degrees to apply (default: 180)
}
```

## IPC Handlers

### Main Process Handlers

All handlers are registered in `src/main/scanner.ts`:

#### `scan-pdf-file`
- **Args**: `filePath: string`, `config?: PDFManagerConfig`
- **Returns**: `ScanResult`
- **Description**: Scans a single PDF file

#### `scan-pdf-batch`
- **Args**: `filePaths: string[]`, `config?: PDFManagerConfig`
- **Returns**: `BatchScanResult`
- **Emits**: `scan-progress` events
- **Description**: Scans multiple PDF files with progress tracking

#### `scan-directory`
- **Args**: `dirPath: string`, `config?: PDFManagerConfig`
- **Returns**: `DirectoryScanResult`
- **Emits**: `scan-progress` events
- **Description**: Scans all PDFs in a directory

### IPC Events

#### `scan-progress`
Emitted from main process during batch and directory scans:
```typescript
interface ScanProgress {
  filePath: string;      // Full path to file being scanned
  fileName: string;      // File name
  pageNumber: number;    // Current page being processed
  totalPages: number;    // Total pages in file
}
```

## Result Types

### ScanResult
```typescript
interface ScanResult {
  fileName: string;
  totalPages: number;
  results: Record<number, PageProcessResult>;
  success: boolean;
  error?: string;
}
```

### BatchScanResult
```typescript
interface BatchScanResult {
  allResults: Record<string, ScanResult>;
  failedFiles: string[];
  successCount: number;
  failureCount: number;
}
```

### DirectoryScanResult
```typescript
interface DirectoryScanResult {
  scannedCount: number;
  failedCount: number;
  failedFiles: string[];
  results: Record<string, ScanResult>;
}
```

## Examples

### Complete Component Example

```typescript
import React, { useState } from 'react';
import { useSingleFileScan } from './hooks/useSingleFileScan';

export function ScannerDemo() {
  const [filePath, setFilePath] = useState('');
  const { scanning, result, error, scanFile, reset } = useSingleFileScan();

  const handleScan = async () => {
    if (!filePath) {
      alert('Please enter a file path');
      return;
    }

    const res = await scanFile(filePath, {
      initialScale: 3,
      enableRotation: true,
      rotationDegrees: 180,
    });

    if (res?.success) {
      console.log(`Successfully scanned ${res.totalPages} pages`);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>PDF Scanner</h2>

      <input
        type="text"
        placeholder="Enter PDF file path"
        value={filePath}
        onChange={(e) => setFilePath(e.target.value)}
        disabled={scanning}
      />

      <button onClick={handleScan} disabled={scanning}>
        {scanning ? 'Scanning...' : 'Scan'}
      </button>

      <button onClick={reset}>Reset</button>

      {error && <div style={{ color: 'red' }}>Error: {error}</div>}

      {result && (
        <div style={{ marginTop: '1rem', color: result.success ? 'green' : 'red' }}>
          <p>File: {result.fileName}</p>
          <p>Pages: {result.totalPages}</p>
          <p>Status: {result.success ? 'Success' : 'Failed'}</p>
          {result.error && <p>Error: {result.error}</p>}
        </div>
      )}
    </div>
  );
}
```

## Architecture

```
Main Process (scanner.ts)
    ↓
    ├── IPC Handler: scan-pdf-file
    ├── IPC Handler: scan-pdf-batch
    └── IPC Handler: scan-directory
            ↓ (uses)
        PDFManager (services/PDFManager.ts)
            ↓ (emits scan-progress)
Renderer Process
    ↓
    ├── Service: ScannerService
    │   ├── scanSingleFile()
    │   ├── scanBatch()
    │   ├── scanDirectory()
    │   └── onScanProgress()
    │
    └── Hooks
        ├── useSingleFileScan
        └── useDirectoryScan
```

## Notes

- File paths must be absolute paths
- Only PDF files are scanned in directory mode
- Progress events are sent for batch and directory scans
- Error handling is built-in to both service and hooks
- The service is a singleton, safe to import multiple times
