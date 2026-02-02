# CAMPX Tampering Detection System

A desktop application for detecting barcodes and QR codes in PDF documents with batch processing, persistent directory monitoring, and crash-safe logging.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Directory Structure](#directory-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [API Reference](#api-reference)

---

## Overview

This Electron-based desktop application enables users to:

1. **Configure Global Settings** - Set PDF processing parameters (scale, rotation, polling interval)
2. **Scan Single PDFs** - Process individual PDF files to detect barcodes/QR codes
3. **Scan Directories** - Batch process multiple PDFs in a directory
4. **Monitor Directories** - Persistent polling with automatic crash recovery
5. **Log Results** - Crash-safe logging with automatic result persistence
6. **System Tray** - Minimize to system tray and keep running in background

### Application Flow

```
App Launch
    ↓
Load Global Settings
    ↓
Show SettingsPanel (Configure directory, scale, rotation, etc.)
    ↓
User Confirms Settings
    ↓
Show Scanner Interface (Single file or Directory scan)
    ↓
User Scans PDFs
    ↓
Results Logged to settings.directory/logs/batches/*.json
    ↓
Results Displayed in UI
```

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────┐
│         Renderer Process (React Frontend)               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  App.tsx (State Machine)                         │   │
│  │  ├── Loading                                     │   │
│  │  ├── Error                                       │   │
│  │  ├── SettingsPanel (Global Configuration)       │   │
│  │  └── ScannerExample (Single File / Directory)   │   │
│  └──────────────────────────────────────────────────┘   │
│                   ↕ Secure IPC Bridge                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services Layer (IPC Wrappers)                  │   │
│  │  ├── SettingsService                            │   │
│  │  └── ScannerService                             │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                    ↕ contextBridge
┌─────────────────────────────────────────────────────────┐
│         Main Process (Node.js Backend)                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  IPC Handlers (index.ts)                         │   │
│  │  ├── Settings: get, update, reset               │   │
│  │  ├── File Dialogs: select-directory, select-file│   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Scanner Handlers (scanner.ts)                   │   │
│  │  ├── scan-pdf-file (single PDF)                 │   │
│  │  ├── scan-pdf-batch (multiple PDFs)             │   │
│  │  ├── scan-directory (directory polling)         │   │
│  │  └── Batch Control (start, pause, resume, stop) │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services Layer (Business Logic)                 │   │
│  │  ├── WorkerPool (1-4 CPU-adaptive workers)       │   │
│  │  ├── BatchOrchestrator (Directory polling)       │   │
│  │  ├── BatchLogger (Crash-safe logging)            │   │
│  │  ├── PDFManager (PDF processing)                 │   │
│  │  ├── PDFToImage (PDF rendering)                  │   │
│  │  ├── ScanImage (Barcode detection)               │   │
│  │  ├── SettingsService (Persistence)               │   │
│  │  └── LogService (Results logging)                │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Worker Threads (Heavy Lifting)                  │   │
│  │  ├── pdfScan.worker.ts (1-4 instances)          │   │
│  │  └── Zero-copy ArrayBuffer transfer              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Process Architecture

**Two separate processes communicate via IPC:**

1. **Main Process** - Electron, Node.js runtime, file system access
2. **Renderer Process** - React, UI, user interactions
3. **Worker Threads** - Node.js Worker Threads, CPU-intensive tasks

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 | UI framework |
| **Language** | TypeScript | Type safety |
| **Desktop Framework** | Electron | Cross-platform desktop app |
| **State Management** | React hooks | Component state |
| **Persistence** | JSON files | Settings & logs |
| **PDF Processing** | pdf.js | PDF rendering |
| **Barcode Detection** | zxing-wasm | QR code & barcode detection |
| **Image Processing** | node-canvas | Server-side rendering |
| **Concurrency** | Node.js Worker Threads | Parallel PDF processing |
| **IPC** | contextBridge + preload | Secure inter-process communication |

---

## Directory Structure

```
campx-tampering-detection/
├── src/
│   ├── main/                              # Electron Main Process
│   │   ├── index.ts                       # Entry point, window management
│   │   ├── scanner.ts                     # Scanner IPC handlers
│   │   ├── zxingInit.ts                   # WASM initialization
│   │   ├── config/
│   │   │   └── worker.config.ts           # CPU-adaptive pool sizing
│   │   ├── types/
│   │   │   ├── BatchSettings.ts           # Batch configuration types
│   │   │   └── LogEntry.ts                # Log schema definitions
│   │   ├── services/
│   │   │   ├── BatchOrchestrator.ts       # Directory polling & batch management
│   │   │   ├── BatchLogger.ts             # Crash-safe logging
│   │   │   ├── PDFManager.ts              # PDF processing orchestration
│   │   │   ├── PDFToImage.ts              # PDF page rendering
│   │   │   ├── ScanImage.ts               # Barcode/QR code detection
│   │   │   ├── LogService.ts              # Result persistence
│   │   │   ├── imageUtils.ts              # Image manipulation
│   │   │   └── SettingsService.ts         # Settings persistence
│   │   └── workers/
│   │       ├── WorkerPool.ts              # Worker pool management (1-4 adaptive)
│   │       ├── pdfScan.worker.ts          # Worker thread implementation
│   │       ├── Job.ts                     # Job abstraction
│   │       └── types.ts                   # Message contracts
│   │
│   ├── preload/
│   │   └── preload.ts                     # IPC security bridge
│   │
│   └── renderer/                          # React Frontend
│       └── src/
│           ├── App.tsx                    # Root component (state machine)
│           ├── main.tsx                   # React entry point
│           ├── global.d.ts                # TypeScript declarations
│           ├── components/
│           │   ├── SettingsPanel.tsx      # Global settings configuration
│           │   └── ScannerExample.tsx     # Scanner interface
│           ├── hooks/
│           │   ├── useSingleFileScan.ts   # Single file scanning logic
│           │   └── useDirectoryScan.ts    # Directory scanning logic
│           └── services/
│               ├── SettingsService.ts     # IPC wrapper for settings
│               └── ScannerService.ts      # IPC wrapper for scanning
│
├── assets/
│   └── wasm/
│       └── zxing_reader.wasm              # Barcode detection WASM module
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Installation

### Prerequisites

- **Node.js** 16+ (LTS recommended)
- **npm** or **yarn**
- **Python 3** (for node-canvas build)
- **Visual Studio Build Tools** (Windows) or Xcode (macOS) for native compilation

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd campx-tampering-detection

# Install dependencies
npm install

# Build the application
npm run build

# Start development server
npm run dev

# Package for distribution
npm run package
```

---

## Usage

### User Workflow

#### 1. Initial Setup (SettingsPanel)

```
App launches → Loads SettingsPanel
User specifies:
  • Directory (Required) - Where PDFs are located and logs will be stored
  • Scale (1-5) - PDF rendering scale factor (default: 3)
  • Enable Rotation - Whether to try rotated versions (default: true)
  • Rotation Degrees - Rotation angle to try (default: 180°)
  • Polling Interval - Directory scan frequency (default: 5000ms)
→ User clicks "Continue" to proceed to Scanner
```

#### 2. Single File Scan

```
User clicks "Scan File" in ScannerExample
→ File picker dialog opens
→ User selects PDF
→ PDFManager processes the file:
   • Load PDF document
   • For each page:
     - Render to image at configured scale
     - Scan for barcodes/QR codes
     - If rotation enabled: try rotated version
     - Keep result with most detections
   • Return results per page
→ LogService saves results to logs/batches/{batchId}.json
→ UI displays results with detection counts
```

#### 3. Directory Scan

```
User clicks "Scan Directory"
→ Directory picker dialog opens
→ User selects folder with PDFs
→ BatchOrchestrator starts:
   1. Poll directory on interval
   2. Collect new PDF files into queue
   3. Create batches of configured size
   4. For each batch:
      - Start batch header (crash recovery)
      - Submit jobs to WorkerPool (1-4 threads)
      - Get results from workers
      - Log entries to in-memory buffer
      - Flush buffer to disk
      - Emit progress events
   5. Continue until queue empty
→ UI shows real-time progress (scanned/total files, ETA)
→ Final results saved with batch metadata
```

### Result Format

Results are logged in `{directory}/logs/batches/batch_{timestamp}.json`:

```json
{
  "version": "1.0",
  "header": {
    "batchId": "550e8400-e29b-41d4-a716-446655440000",
    "startTime": 1704067200000,
    "endTime": 1704067250000,
    "status": "COMPLETED",
    "totalFiles": 5,
    "batchSettings": {
      "directory": "/path/to/pdfs",
      "batchSize": 4,
      "pollingIntervalMs": 5000
    }
  },
  "entries": [
    {
      "fileName": "document.pdf",
      "absolutePath": "/path/to/pdfs/document.pdf",
      "batchId": "550e8400-e29b-41d4-a716-446655440000",
      "batchIndex": 1,
      "startTime": 1704067200000,
      "endTime": 1704067205000,
      "durationMs": 5000,
      "status": "SUCCESS",
      "totalPages": 10,
      "results": {
        "1": { "success": true, "result": ["QR123456"] },
        "2": { "success": false },
        "3": { "success": true, "result": ["BAR789012", "QR111222"] }
      },
      "config": {
        "initialScale": 3,
        "enableRotation": true,
        "rotationDegrees": 180
      }
    }
  ],
  "stats": {
    "totalProcessed": 5,
    "totalSucceeded": 4,
    "totalFailed": 1,
    "averageDurationMs": 4800
  }
}
```

### 4. System Tray

The application supports minimizing to the system tray while keeping background processes running.

**Features:**
- **Minimize to Tray** - Clicking the close button (X) hides the window to system tray instead of exiting
- **Tray Icon** - Application icon appears in system tray for quick access
- **Single Click Toggle** - Click tray icon to show/hide window
- **Context Menu** - Right-click tray icon for options:
  - **Show** - Display the application window
  - **Quit** - Close the application completely

**Usage:**
```
1. Click close button (X) on window → App minimizes to tray
2. Click tray icon to show window again
3. Right-click tray icon for context menu
4. Select "Quit" to completely close the application
```

**Benefits:**
- Keep the application running in background for continuous directory monitoring
- Quick access without cluttering taskbar
- Persistent batch processing and logging even when window is hidden
- Automatic logging and directory polling continues while minimized

---

## Development

### Architecture Patterns

#### 1. **State Machine Pattern** (App.tsx)

Clear view states prevent invalid transitions:

```typescript
type ViewState = 'loading' | 'error' | 'settings' | 'scanner';

// Only valid transitions:
// loading → settings or error
// settings → scanner
// scanner → (stay or error)
```

#### 2. **Singleton Pattern**

Services instantiated once, used globally:

```typescript
// SettingsService
let instance: SettingsService | null = null;
export function getSettingsService() {
  if (!instance) instance = new SettingsService();
  return instance;
}
```

#### 3. **Factory Functions**

Flexible service creation:

```typescript
// PDFManager
const manager = new PDFManager({
  initialScale: 3,
  enableRotation: true,
  rotationDegrees: 180,
});
```

#### 4. **Configuration Merging**

Runtime config overrides global defaults:

```typescript
const mergedConfig = {
  initialScale: runtimeConfig?.initialScale ?? settings.initialScale,
  enableRotation: runtimeConfig?.enableRotation ?? settings.enableRotation,
  rotationDegrees: runtimeConfig?.rotationDegrees ?? settings.rotationDegrees,
};
```

#### 5. **Adaptive Worker Pool**

CPU-aware concurrency:

```typescript
// Detected CPUs → Worker count
1-2 CPUs  → 1 worker
3-4 CPUs  → 2 workers
5-8 CPUs  → 3 workers
9+ CPUs   → 4 workers
```

#### 6. **Crash-Safe Logging**

Immediate header write enables recovery:

```typescript
// Start batch:
1. Write header immediately (status: STARTED)
   → Proves batch was started even if crash occurs

// Process files:
2. Accumulate entries in memory buffer
   → No disk writes during processing (fast)

// Complete batch:
3. Flush all entries to disk at once
   → Single atomic write for consistency
   → Update status: COMPLETED/FAILED
```

#### 7. **Zero-Copy Transfer**

Efficient buffer passing between threads:

```typescript
// Renderer → Main (IPC)
const job = { id, buffer: pdfBuffer, ... };

// Main → Worker (Worker Thread)
worker.postMessage(request, [buffer.arrayBuffer]);
// buffer is transferred, not copied
```

### Key Services

#### BatchOrchestrator

Persistent directory monitoring with crash recovery:

```typescript
const orchestrator = getOrchestrator();

// Start continuous monitoring
await orchestrator.start({
  directory: '/path/to/pdfs',
  batchSize: 4,
  pollingIntervalMs: 5000,
  pdfConfig: { initialScale: 3 },
});

// Control
orchestrator.pause();    // Stop processing, keep polling
orchestrator.resume();   // Resume processing
await orchestrator.stop(); // Stop everything

// Monitor progress
orchestrator.onProgress((event) => {
  console.log(`Processed: ${event.totalProcessed}/${event.totalFiles}`);
});
```

#### WorkerPool

Adaptive thread management:

```typescript
const pool = getWorkerPool();

// Auto-scales based on CPU count
// 1-4 workers running in parallel

const result = await pool.submit(job);
// Job queued, executed when worker available
```

#### BatchLogger

Crash-safe result persistence:

```typescript
const logger = getBatchLogger(directory);

// Start batch (header written immediately)
const batchId = await logger.startBatch({
  directory,
  batchSize: 4,
  pollingIntervalMs: 5000,
  totalFiles: 10,
});

// Add entries (in-memory only)
logger.addEntry({
  fileName: 'file.pdf',
  status: 'SUCCESS',
  // ... other fields
});

// Complete batch (flush to disk)
await logger.completeBatch('COMPLETED');
```

### Data Flow Examples

#### Single File Scan

```
User selects file
    ↓
IPC: 'scan-pdf-file' → Main
    ↓
Scanner handler:
  1. Read file buffer
  2. Create PDFManager
  3. Process buffer
  4. Get results per page
  5. LogService.logFileProcess()
  6. Return results
    ↓
Hook updates state
    ↓
Component re-renders with results
```

#### Directory Batch Scan

```
BatchOrchestrator.start()
    ↓
startPolling() - Scan directory every 5s
    ↓
scanDirectory() - Find all *.pdf files
    ↓
Add new files to queue
    ↓
processingLoop() - Create batches
    ↓
For each batch:
  1. Logger.startBatch() - Write header
  2. Create WorkerPool jobs
  3. Submit jobs to pool (1-4 workers)
  4. Collect results
  5. Log entries
  6. Logger.completeBatch() - Flush to disk
  7. Emit progress event
    ↓
Continue until queue empty
```

### Adding Features

#### Add New Scan Mode

1. **Create IPC Handler** (src/main/scanner.ts)
   ```typescript
   ipcMain.handle('scan-custom-mode', async (event, filePath, config) => {
     // Implementation
   });
   ```

2. **Create Hook** (src/renderer/src/hooks/useCustomMode.ts)
   ```typescript
   export function useCustomMode() {
     return {
       scanning: boolean,
       results: ScannedResults,
       error: string | null,
       scan: (path, config) => Promise<void>,
     };
   }
   ```

3. **Use in Component** (src/renderer/src/components/ScannerExample.tsx)
   ```typescript
   const { scan, results } = useCustomMode();
   ```

#### Add New Settings Option

1. **Update Type** (src/main/types/BatchSettings.ts)
   ```typescript
   export interface BatchSettings {
     // ... existing
     newOption: boolean;
   }
   ```

2. **Update SettingsService** (src/main/utils/SettingsService.ts)
   ```typescript
   const DEFAULT_BATCH_SETTINGS = {
     // ... existing
     newOption: false,
   };
   ```

3. **Update UI** (src/renderer/src/components/SettingsPanel.tsx)
   ```typescript
   <label>
     <input
       type="checkbox"
       checked={settings.newOption}
       onChange={(e) => updateSetting('newOption', e.target.checked)}
     />
     New Option
   </label>
   ```

### Building & Packaging

```bash
# Development
npm run dev              # Start dev server with hot reload

# Production Build
npm run build            # Build renderer + main
npm run build:renderer   # React/Vite only
npm run build:main       # TypeScript/Electron only

# Packaging
npm run package          # Create distributable
npm run package:win      # Windows installer
npm run package:mac      # macOS app bundle
npm run package:linux    # Linux AppImage
```

### Debugging

```bash
# Enable debug logs
DEBUG=* npm run dev

# Open DevTools
Ctrl+Shift+I (Windows/Linux)
Cmd+Option+I (macOS)

# Main process logs appear in console
# Renderer logs appear in DevTools

# Check worker thread activity
console.log('[Worker] Processing:', pageNumber);
```

---

## API Reference

### IPC Handlers

#### Settings

| Handler | Params | Returns | Purpose |
|---------|--------|---------|---------|
| `get-settings` | - | `AppSettings` | Get current settings |
| `update-settings` | `Partial<AppSettings>` | `AppSettings` | Update multiple settings |
| `update-setting` | `(key, value)` | `AppSettings` | Update single setting |
| `reset-settings` | - | `AppSettings` | Reset to defaults |

#### File Dialogs

| Handler | Params | Returns | Purpose |
|---------|--------|---------|---------|
| `select-directory` | - | `string \| null` | Open directory picker |
| `select-file` | - | `string \| null` | Open file picker (PDF filter) |

#### Scanning

| Handler | Params | Returns | Purpose |
|---------|--------|---------|---------|
| `scan-pdf-file` | `(filePath, config)` | `ScanResult` | Scan single PDF |
| `scan-pdf-batch` | `(filePaths[], config)` | `BatchScanResult` | Scan multiple PDFs |
| `scan-directory` | `(dirPath, config)` | `DirectoryScanResult` | Scan all PDFs in directory |

#### Batch Control

| Handler | Params | Returns | Purpose |
|---------|--------|---------|---------|
| `batch-start` | `BatchSettings` | `{ batchId: string }` | Start batch monitoring |
| `batch-pause` | - | `BatchState` | Pause processing (keep polling) |
| `batch-resume` | - | `BatchState` | Resume processing |
| `batch-stop` | - | `BatchResult` | Stop monitoring |
| `batch-get-state` | - | `BatchState` | Get current batch state |

### Events

#### Progress Events

```typescript
interface BatchProgressEvent {
  type: 'batch-progress' | 'batch-complete' | 'batch-error';
  processedInBatch: number;
  totalProcessed: number;
  totalFiles: number;
  batchIndex: number;
  queuedFiles: number;
  elapsedMs: number;
  throughputPerSec: number;
  estimatedRemainingMins?: number;
  error?: string;
}
```

Listen with:
```typescript
window.electronAPI.on('scan-progress', (event) => {
  console.log(`Progress: ${event.totalProcessed}/${event.totalFiles}`);
});
```

---

## Performance Considerations

### Memory Management

- **PDF Buffers**: 50-300 MB typical, transferred via zero-copy
- **Batch Processing**: Fixed batch size (4) prevents memory buildup
- **Garbage Collection**: Triggered after each batch
- **Image Cache**: Cleared per page

### CPU Utilization

- **Worker Threads**: 1-4 based on CPU count
- **Directory Polling**: 5s interval (configurable)
- **PDF Rendering**: Off-thread via workers

### Disk I/O

- **Batched Writes**: Single flush after batch complete
- **Incremental Logging**: Header written first, enables recovery
- **No Live Updates**: Buffer → disk only at batch completion

---

## Troubleshooting

### Application won't start

```bash
# Clear cache and node_modules
rm -rf node_modules
npm install
npm run build
```

### PDFs not detected

1. Check `settings.directory` is correct
2. Verify file permissions
3. Ensure polling interval is not too short
4. Check `logs/batches/*.json` for error entries

### Barcode detection failing

1. Verify PDF quality (ensure at least 100 DPI)
2. Try adjusting `initialScale` (higher = better detail, slower)
3. Enable rotation if codes are at unusual angles
4. Check WASM module loaded: open DevTools → console

### High memory usage

1. Reduce `batchSize` in settings
2. Check `logs/batches/*.json` for huge result entries
3. Monitor worker thread heap usage
4. Restart application to clear buffers

---

## License

MIT

---

## Contributing

1. Create feature branch
2. Make changes
3. Run `npm run build` to verify
4. Submit pull request

---

## Support

For issues and feature requests, please refer to the project issue tracker.
