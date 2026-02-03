# Application Architecture - CampX Tampering Detection

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON APPLICATION                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      MAIN PROCESS (Node.js)                          │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │              IPC HANDLER LAYER (scanner.ts)                   │ │   │
│  │  │  • batch-start    → orchestrator.start()                      │ │   │
│  │  │  • batch-pause    → orchestrator.pause()                      │ │   │
│  │  │  • batch-resume   → orchestrator.resume()                     │ │   │
│  │  │  • batch-stop     → orchestrator.stop()                       │ │   │
│  │  │  • batch-get-state → orchestrator.getState()                  │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                              ↓                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │         BATCH ORCHESTRATOR (batch-orchestrator.service)        │ │   │
│  │  │                                                                │ │   │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │ │   │
│  │  │  │ State Management                                        │ │ │   │
│  │  │  │ • totalFilesDiscovered: number                          │ │ │   │
│  │  │  │ • filesProcessed: number                                │ │ │   │
│  │  │  │ • filesRemainingInRoot: number                          │ │ │   │
│  │  │  │ • currentBatchIndex: number                             │ │ │   │
│  │  │  │ • elapsedMs: number                                     │ │ │   │
│  │  │  └─────────────────────────────────────────────────────────┘ │ │   │
│  │  │                                                                │ │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │ │   │
│  │  │  │              │  │              │  │              │         │ │   │
│  │  │  │   Directory  │  │    Batch     │  │  Processing  │         │ │   │
│  │  │  │   Polling    │→ │   Creation   │→ │    Loop      │         │ │   │
│  │  │  │              │  │              │  │              │         │ │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘         │ │   │
│  │  │         ↓                                      ↓                │ │   │
│  │  │    scanDirectory()              processBatch()                 │ │   │
│  │  │    (every 5 sec)                 (worker pool)                 │ │   │
│  │  │                                                                │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐ │ │   │
│  │  │  │ emitProgress()                                           │ │ │   │
│  │  │  │ • Calculates: throughput, ETA, elapsed time              │ │ │   │
│  │  │  │ • Emits: batch-progress, batch-complete, batch-error    │ │ │   │
│  │  │  │ • Sends to: IPC callbacks → Renderer                     │ │ │   │
│  │  │  └──────────────────────────────────────────────────────────┘ │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                              ↓                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │            WORKER POOL (worker-pool.service)                  │ │   │
│  │  │                                                                │ │   │
│  │  │  Pool Size: 1-4 workers (based on CPU count)                  │ │   │
│  │  │  • Worker 1 ─┐                                                │ │   │
│  │  │  • Worker 2  ├→ [pdfScan.worker.js]                           │ │   │
│  │  │  • Worker N ─┘                                                │ │   │
│  │  │                                                                │ │   │
│  │  │  Job Queue: Max 1000 jobs                                     │ │   │
│  │  │  • Job timeout: 5 minutes                                     │ │   │
│  │  │  • Handles: errors, crashes, recovery                         │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                              ↓↓↓↓                                   │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │     WORKER: PDF SCANNING (pdfScan.worker.ts)                  │ │   │
│  │  │                                                                │ │   │
│  │  │  For each PDF file:                                           │ │   │
│  │  │                                                                │ │   │
│  │  │  ┌────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │ PDF Manager (pdf-manager.service)                     │  │ │   │
│  │  │  │ • Load PDF buffer                                      │  │ │   │
│  │  │  │ • Create PDF document                                  │  │ │   │
│  │  │  │ • Process each page                                    │  │ │   │
│  │  │  └────────────────────────────────────────────────────────┘  │ │   │
│  │  │         ↓                                                      │ │   │
│  │  │  ┌────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │ PDF to Image (pdf-to-image.service)                   │  │ │   │
│  │  │  │ • For each page (initialScale, rotation)               │  │ │   │
│  │  │  │ • Render → Image buffer                                │  │ │   │
│  │  │  └────────────────────────────────────────────────────────┘  │ │   │
│  │  │         ↓                                                      │ │   │
│  │  │  ┌────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │ Scan Image (scan-image.service)                        │  │ │   │
│  │  │  │ • Use ZXing.js to detect barcodes                      │  │ │   │
│  │  │  │ • Extract: Code128, QRCode, other formats             │  │ │   │
│  │  │  │ • Result: { codes[], success, error }                  │  │ │   │
│  │  │  └────────────────────────────────────────────────────────┘  │ │   │
│  │  │         ↓                                                      │ │   │
│  │  │  ┌────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │ Verification Service (verification.service)            │  │ │   │
│  │  │  │                                                         │  │ │   │
│  │  │  │ Checks (in order):                                     │  │ │   │
│  │  │  │ 1. verifyPageCount() → pages % 8 === 0?                │  │ │   │
│  │  │  │ 2. verifyFileCorrectness() → Code128 === fileName?     │  │ │   │
│  │  │  │ 3. verifyCodeValue(page) → per-page validation         │  │ │   │
│  │  │  │ 4. verifyMissingQRs() → QR + Code128 present?          │  │ │   │
│  │  │  │                                                         │  │ │   │
│  │  │  │ Results:                                                │  │ │   │
│  │  │  │ • 'tampered' → immediate exit                           │  │ │   │
│  │  │  │ • 'retry' → missing codes (flag for retry)              │  │ │   │
│  │  │  │ • 'scan_passed' → all checks OK                         │  │ │   │
│  │  │  └────────────────────────────────────────────────────────┘  │ │   │
│  │  │         ↓                                                      │ │   │
│  │  │  Result: {                                                     │ │   │
│  │  │    fileName, totalPages, results: { 1: {...}, 2: {...} },    │ │   │
│  │  │    success, error, verificationResult                        │ │   │
│  │  │  }                                                            │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │         ↓↓↓↓ (back to Orchestrator)                              │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │         LOGGING + ROUTING (processBatch)                      │ │   │
│  │  │                                                                │ │   │
│  │  │  ┌──────────────────────┐    ┌──────────────────────────────┐ │ │   │
│  │  │  │ Batch Logger         │    │ Routing Worker Pool          │ │ │   │
│  │  │  │ (batch-logger)       │    │ (routing-worker-pool)        │ │ │   │
│  │  │  │                      │    │                              │ │ │   │
│  │  │  │ • Store log entry    │    │ Process routing job:         │ │ │   │
│  │  │  │ • File name as key   │    │ 1. Create subfolder          │ │ │   │
│  │  │  │ • Status: SUCCESS    │    │ 2. Move file to folder       │ │ │   │
│  │  │  │   PARTIAL, FAILED    │    │ 3. Return result             │ │ │   │
│  │  │  │ • Results per page   │    │                              │ │ │   │
│  │  │  │ • Smart merge on     │    │ Folders:                     │ │ │   │
│  │  │  │   retry (best codes) │    │ • tampered/                  │ │ │   │
│  │  │  │                      │    │ • scan_passed/               │ │ │   │
│  │  │  │ Persists to:         │    │ • retry/                     │ │ │   │
│  │  │  │ logs.json (append)   │    │                              │ │ │   │
│  │  │  └──────────────────────┘    └──────────────────────────────┘ │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │         SETTINGS SERVICE (settings.service)                   │ │   │
│  │  │                                                                │ │   │
│  │  │ Centralized configuration:                                    │ │   │
│  │  │ • UI: directory, pollingInterval, rotation, initialScale      │ │   │
│  │  │ • Batch: batchSize, pollingIntervalMs, recursive              │ │   │
│  │  │ • Worker: poolSize, timeouts, maxQueueSize, verbose           │ │   │
│  │  │                                                                │ │   │
│  │  │ Persists to: userData/settings.json                           │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                            ⇅ IPC Bridge ⇅                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    RENDERER PROCESS (React)                          │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │           ScannerExample Component (UI)                        │ │   │
│  │  │                                                                │ │   │
│  │  │  ┌──────────────────────────────────────────────────────────┐ │ │   │
│  │  │  │ Directory Selection                                      │ │ │   │
│  │  │  │ + Batch Config (batchSize, pollingInterval)              │ │ │   │
│  │  │  │ + PDF Config (scale, rotation)                           │ │ │   │
│  │  │  │ + Control Buttons (Start, Pause, Resume, Stop)           │ │ │   │
│  │  │  └──────────────────────────────────────────────────────────┘ │ │   │
│  │  │         ↓                                                      │ │   │
│  │  │  ┌────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │ useBatchScan Hook                                      │  │ │   │
│  │  │  │                                                         │  │ │   │
│  │  │  │ State Management:                                      │  │ │   │
│  │  │  │ • scanning: boolean                                    │  │ │   │
│  │  │  │ • paused: boolean                                      │  │ │   │
│  │  │  │ • batchState: BatchState (from polling)                │  │ │   │
│  │  │  │ • batchProgress: BatchProgressEvent (from emitter)     │  │ │   │
│  │  │  │ • error: string | null                                 │  │ │   │
│  │  │  │                                                         │  │ │   │
│  │  │  │ Methods:                                               │  │ │   │
│  │  │  │ • startBatch(settings) → IPC                           │  │ │   │
│  │  │  │ • pause() → IPC                                        │  │ │   │
│  │  │  │ • resume() → IPC                                       │  │ │   │
│  │  │  │ • stop() → IPC                                         │  │ │   │
│  │  │  │ • reset()                                              │  │ │   │
│  │  │  │                                                         │  │ │   │
│  │  │  │ Listeners:                                             │  │ │   │
│  │  │  │ • onBatchProgress() [event emitter]                    │  │ │   │
│  │  │  │ • Polling getBatchState() [1 sec interval]             │  │ │   │
│  │  │  └────────────────────────────────────────────────────────┘  │ │   │
│  │  │         ↓                                                      │ │   │
│  │  │  ┌────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │ UI Display                                             │  │ │   │
│  │  │  │                                                         │  │ │   │
│  │  │  │ Progress Metrics:                                      │  │ │   │
│  │  │  │ • Progress bar: processedFiles / totalFiles            │  │ │   │
│  │  │  │ • Batch index, queued files, throughput, ETA           │  │ │   │
│  │  │  │ • Elapsed time (HH:MM:SS format)                       │  │ │   │
│  │  │  │                                                         │  │ │   │
│  │  │  │ Status Indicators:                                     │  │ │   │
│  │  │  │ • Active badge (green/inactive)                        │  │ │   │
│  │  │  │ • Paused indicator                                     │  │ │   │
│  │  │  │ • Error message display                                │  │ │   │
│  │  │  │                                                         │  │ │   │
│  │  │  │ Completion Summary:                                    │  │ │   │
│  │  │  │ • Total processed, succeeded, failed                   │  │ │   │
│  │  │  │ • Average time per file                                │  │ │   │
│  │  │  └────────────────────────────────────────────────────────┘  │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │         ↓                                                            │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │           Settings Service (Renderer)                          │ │   │
│  │  │                                                                │ │   │
│  │  │ IPC Wrapper:                                                   │ │   │
│  │  │ • getSettings() → IPC 'get-settings'                           │ │   │
│  │  │ • updateSettings() → IPC 'update-settings'                     │ │   │
│  │  │ • resetSettings() → IPC 'reset-settings'                       │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
USER ACTION
    ↓
[Select Directory + Start Batch]
    ↓
    ├→ IPC: batch-start(BatchSettings)
    │
    ↓
[BatchOrchestrator.start()]
    │
    ├→ Initialize Settings Service
    ├→ Initialize Batch Logger
    ├→ Start Directory Polling
    └→ Start Processing Loop
    │
    ├─────────────────────────────────────────────┐
    ↓                                             ↓
[Directory Polling (5 sec)]              [Processing Loop]
    │                                            │
    ├→ scanDirectory()                    ├→ Wait for files
    │   ├→ Read root directory           │
    │   ├→ Count PDF files               ├→ createBatch()
    │   └→ Update totalFilesDiscovered   │   (take N files)
    │                                    │
    └─────────────────────────────────────────────┘
                    ↓
        [Submit Batch to Worker Pool]
            │
            ├→ For each file in batch:
            │   │
            │   ├→ Read file buffer
            │   ├→ Create WorkerJob
            │   └→ Submit to Worker Pool
            │
            ├→ Wait for all workers (allSettled)
            │
            └→ For each result:
                │
                ├→ PDF Scanning (Worker)
                │   ├→ PDF Manager
                │   ├→ PDF to Image (per page)
                │   ├→ Scan Image (ZXing)
                │   └→ Return results
                │
                ├→ Verification Service
                │   ├→ verifyPageCount()
                │   ├→ verifyFileCorrectness()
                │   ├→ verifyCodeValue() (per page)
                │   ├→ verifyMissingQRs()
                │   └→ Return: tampered | retry | scan_passed
                │
                ├→ Batch Logger
                │   ├→ Store log entry
                │   ├→ Smart merge on retry
                │   └→ Track retryCount
                │
                └→ Routing Worker
                    ├→ Create subfolder (if needed)
                    ├→ Move file to: tampered/ | scan_passed/ | retry/
                    └→ Return routing result
        ↓
    [emitProgress()]
        │
        ├→ Calculate throughput
        ├→ Calculate ETA
        ├→ Create BatchProgressEvent
        └→ Emit to progress callbacks
            │
            └→ IPC: mainWindow.webContents.send('batch-progress', event)
                │
                ↓
            [Renderer: onBatchProgress()]
                │
                └→ Update UI with progress
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      BATCH LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────┘

[IDLE]
  │
  └─ user clicks "Start"
      │
      ↓
  [INITIALIZING]
      ├─ Create logger
      ├─ Start polling
      ├─ Start processing loop
      │
      ↓
  [SCANNING] ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
      ├─ Poll directory (5 sec interval)          │
      ├─ Process batches (N files at a time)       │
      ├─ Verification checks                       │
      ├─ File routing                              │
      └─ Emit progress                             │
         │                                         │
         ├─ user clicks "Pause"                    │
         │    ↓                                    │
         │  [PAUSED]                               │
         │    │                                    │
         │    └─ user clicks "Resume" ─ ─ ─ ─ ─ ┘
         │
         ├─ user clicks "Stop"
         │    ↓
         │  [STOPPING]
         │    ├─ Stop polling
         │    ├─ Wait for current jobs
         │    ├─ Flush logs
         │    │
         │    ↓
         │  [IDLE]
         │
         └─ no more files + queue empty
              ↓
          [COMPLETE]
              ├─ Emit batch-complete
              ├─ Final stats
              │
              ↓
          [IDLE]
```

## Data Structures

### BatchState (In-Memory State)
```typescript
{
  active: boolean;              // Whether batch is running
  paused: boolean;              // Whether batch is paused
  totalFiles: number;           // Total discovered
  processedFiles: number;       // Completed
  queuedFiles: number;          // Waiting in root directory
  currentBatchIndex: number;    // Batch number
  startedAt: number;            // Unix timestamp
  elapsedMs: number;            // Calculated elapsed time
}
```

### BatchProgressEvent (Emitted to Renderer)
```typescript
{
  type: 'batch-progress' | 'batch-complete' | 'batch-error';
  processedInBatch: number;     // Files in current batch
  totalProcessed: number;       // All files processed
  totalFiles: number;           // Total discovered
  batchIndex: number;           // Current batch
  queuedFiles: number;          // Files remaining
  elapsedMs: number;            // Elapsed time
  throughputPerSec: number;     // Files/second
  estimatedRemainingMins: number;  // ETA in minutes
  error?: string;               // Error message if type='batch-error'
}
```

### LogEntry (Persisted to logs.json)
```typescript
{
  fileName: string;
  absolutePath: string;
  batchId: string;
  batchIndex: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  results: Record<number, unknown>;  // Per-page results
  totalPages: number;
  retryCount: number;           // Incremented on retry
  error?: { message, code, timestamp };
  config: { initialScale, enableRotation, rotationDegrees };
}
```

### VerificationResult
```typescript
{
  status: 'tampered' | 'retry' | 'scan_passed';
  reason: string;  // Why this status
}

// Routing:
// • tampered → directory/tampered/
// • scan_passed → directory/scan_passed/
// • retry → directory/retry/
```

## Key Configuration (Settings)

```json
{
  "directory": "/path/to/pdfs",
  "pollingInterval": 5000,
  "rotationDegrees": 180,
  "initialScale": 3,
  "enableRotation": true,
  "batchSize": 4,
  "pollingIntervalMs": 5000,
  "recursive": false,
  "worker": {
    "poolSize": 4,
    "initTimeoutMs": 5000,
    "jobTimeoutMs": 300000,
    "maxQueueSize": 1000,
    "verbose": false
  }
}
```

## Critical Paths

### 1. Batch Start
```
User → batch-start IPC → Orchestrator.start()
  → Initialize Logger
  → Start Directory Polling
  → Start Processing Loop
  → Register Progress Callbacks
  → First scanDirectory()
```

### 2. File Processing
```
scanDirectory() → Directory.readdir() → Filter PDFs
  → createBatch() → Take N files from queue
  → processBatch() → Submit to Worker Pool
  → Worker processes each file (scan + verify)
  → Log results (with retry merge)
  → Route files to subdirectories
  → emitProgress() → IPC to Renderer
```

### 3. Progress Emission
```
emitProgress() in Orchestrator
  → Calculate metrics (throughput, ETA, elapsed)
  → Create BatchProgressEvent
  → Call all progressCallbacks
  → Callbacks forward via IPC → Renderer
  → Renderer updates UI state
```

### 4. Verification Flow
```
verifyPageCount()
  ↓ (if pass)
verifyFileCorrectness()
  ↓ (if pass)
for each page: verifyCodeValue()
  ↓ (if all pass)
verifyMissingQRs()
  ↓
Return: tampered | retry | scan_passed
```

## Communication Patterns

### Main ↔ Renderer (IPC)

**Main → Renderer (Events):**
- `batch-progress`: Progress events from orchestrator

**Renderer → Main (Requests):**
- `batch-start`: Start batch processing
- `batch-pause`: Pause batch processing
- `batch-resume`: Resume batch processing
- `batch-stop`: Stop batch processing
- `batch-get-state`: Get current batch state
- `get-settings`: Get application settings
- `update-settings`: Update settings
- `reset-settings`: Reset to defaults

### Worker Communication

**Main → Worker:**
- Post message with: `{ id, buffer, fileName, config }`

**Worker → Main:**
- `{ type: 'progress', ... }`
- `{ type: 'result', ... }`
- `{ type: 'error', ... }`

## Key Design Decisions

1. **Counter-based State**: Uses simple counters instead of tracking individual files
   - `totalFilesDiscovered`: Peak of (processed + remaining)
   - `filesProcessed`: Cumulative count
   - `filesRemainingInRoot`: Current queue size

2. **Smart Retry with Merge**: On retry, compares results page-by-page and keeps better detection

3. **Real-time Progress**: Calculates metrics on-the-fly (throughput, ETA)

4. **Worker Pool**: Fixed-size pool with job queue for CPU-heavy PDF scanning

5. **Centralized Settings**: All configuration through SettingsService

6. **Crash-safe Logging**: Logs appended to persistent logs.json file

7. **File Routing**: Verification status determines subdirectory

## Performance Characteristics

- **Batch Size**: 4 files (configurable)
- **Polling**: Every 5 seconds (configurable)
- **Worker Pool**: 4 workers max (CPU-dependent)
- **Job Timeout**: 5 minutes per file
- **Queue Size**: Max 1000 jobs
- **Memory Cleanup**: After each batch completion
