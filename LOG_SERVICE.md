# LogService Documentation

## Overview

The `LogService` is a utility for automatically logging PDF scanning results to a `logs.json` file. It handles creation, reading, updating, and querying of scan logs in JSON format.

## File Location

- **Service**: `src/main/services/LogService.ts`
- **Integration**: `src/main/scanner.ts`
- **Output**: `logs.json` (in specified directory)

## Features

✅ **Automatic Creation** - Creates `logs.json` if it doesn't exist
✅ **File Appending** - Appends results to existing logs without overwriting
✅ **Timestamped Logs** - Records ISO timestamp for each entry
✅ **Batch Logging** - Log multiple files at once
✅ **Statistics** - Generate summary statistics from logs
✅ **Error Handling** - Graceful handling of file errors

## Data Structure

### logs.json Format

```json
{
  "document1.pdf": {
    "fileName": "document1.pdf",
    "totalPages": 5,
    "results": {
      "1": { "success": true, "result": {...}, "scale": 3, "rotated": false },
      "2": { "success": true, "result": {...}, "scale": 3, "rotated": false }
    },
    "success": true,
    "error": null,
    "timestamp": "2024-02-01T12:30:45.123Z"
  },
  "document2.pdf": {
    "fileName": "document2.pdf",
    "totalPages": 3,
    "results": {...},
    "success": false,
    "error": "File corrupted",
    "timestamp": "2024-02-01T12:35:20.456Z"
  }
}
```

## Usage

### Automatic Logging (Recommended)

When calling scan handlers, pass the `logsDirectory` parameter:

```typescript
// Single file scan with logging
await scannerService.scanSingleFile(
  '/path/to/document.pdf',
  { initialScale: 3 },
  '/path/to/logs/directory'  // ← Logs will be saved here
);

// Directory scan with logging
await scannerService.scanDirectory(
  '/path/to/pdf/folder',
  { enableRotation: true },
  '/path/to/logs/directory'  // ← Logs will be saved here
);

// Batch scan with logging
await scannerService.scanBatch(
  ['/path/to/file1.pdf', '/path/to/file2.pdf'],
  { initialScale: 2 },
  '/path/to/logs/directory'  // ← Logs will be saved here
);
```

### Manual Logging (Direct Usage)

```typescript
import { LogService } from '@/main/services/LogService';

const logService = new LogService('/path/to/logs/directory');

// Log a single file's results
await logService.logFileProcess({
  fileName: 'document.pdf',
  totalPages: 5,
  results: { /* page results */ },
  success: true,
});

// Log multiple files at once
await logService.logMultipleFiles([
  { fileName: 'doc1.pdf', totalPages: 5, results: {...}, success: true },
  { fileName: 'doc2.pdf', totalPages: 3, results: {...}, success: false },
]);
```

## API Reference

### Constructor

```typescript
new LogService(logsDirectory: string)
```

Creates a new LogService instance pointing to a logs directory.

### Methods

#### logFileProcess()

```typescript
async logFileProcess(fileResults: {
  fileName: string;
  totalPages: number;
  results: Record<number, any>;
  success: boolean;
  error?: string;
}): Promise<void>
```

Logs the results of a single PDF processing operation.

**Example:**
```typescript
await logService.logFileProcess({
  fileName: 'document.pdf',
  totalPages: 5,
  results: pageResults,
  success: true,
});
```

#### logMultipleFiles()

```typescript
async logMultipleFiles(fileResults: Array<{
  fileName: string;
  totalPages: number;
  results: Record<number, any>;
  success: boolean;
  error?: string;
}>): Promise<void>
```

Logs results for multiple files at once.

**Example:**
```typescript
await logService.logMultipleFiles([
  { fileName: 'doc1.pdf', totalPages: 5, results: {...}, success: true },
  { fileName: 'doc2.pdf', totalPages: 3, results: {...}, success: true },
]);
```

#### getAllLogs()

```typescript
async getAllLogs(): Promise<LogsData>
```

Returns all logged entries.

**Example:**
```typescript
const allLogs = await logService.getAllLogs();
console.log(Object.keys(allLogs)); // ['doc1.pdf', 'doc2.pdf', ...]
```

#### getFileLogs()

```typescript
async getFileLogs(fileName: string): Promise<FileProcessLog | null>
```

Returns logs for a specific file, or null if not found.

**Example:**
```typescript
const fileLogs = await logService.getFileLogs('document.pdf');
if (fileLogs) {
  console.log(`Scanned ${fileLogs.totalPages} pages`);
}
```

#### getStatistics()

```typescript
async getStatistics(): Promise<{
  totalFiles: number;
  successfulScans: number;
  failedScans: number;
  totalPages: number;
  totalCodesFound: number;
}>
```

Returns summary statistics from all logs.

**Example:**
```typescript
const stats = await logService.getStatistics();
console.log(`Successfully scanned ${stats.successfulScans}/${stats.totalFiles} files`);
console.log(`Total codes found: ${stats.totalCodesFound}`);
```

#### clearLogs()

```typescript
async clearLogs(): Promise<void>
```

Deletes the logs.json file completely.

**Example:**
```typescript
await logService.clearLogs(); // Removes logs.json
```

## Workflow

### Scanning with Automatic Logging

```
User initiates scan
    ↓
PDFManager processes file
    ↓
Scanner handler completes
    ↓
Check if logsDirectory provided?
    ├─ Yes: Create LogService instance
    │   ├─ Read existing logs.json (if exists)
    │   ├─ Add new entry with fileName as key
    │   ├─ Write updated logs.json
    │   └─ Log: "✓ Logged results for: document.pdf"
    │
    └─ No: Skip logging
```

### logs.json Lifecycle

```
First Scan:
  logs.json doesn't exist
    ↓
  LogService creates it
    ↓
  logs.json created with first file's data

Subsequent Scans:
  logs.json exists
    ↓
  LogService reads existing content
    ↓
  Appends/Updates new file entry
    ↓
  Writes updated content back
```

## Error Handling

### File Not Found
- If `logs.json` doesn't exist, it's created automatically
- No error is thrown

### Invalid JSON
- If existing `logs.json` is corrupted, a warning is logged
- Fresh logs.json is created with new data
- Prevents loss of new scan data

### Write Errors
- If write fails, error is logged to console
- Scanning continues (logging won't block scans)
- User is informed via console warning

### Directory Doesn't Exist
- Parent directory is created recursively
- logs.json is created in the directory

## Example: Complete Scan with Logging

```typescript
import { scannerService } from '@/renderer/src/services/ScannerService';

async function scanWithLogging() {
  const filePath = '/path/to/document.pdf';
  const logsDir = '/path/to/logs';

  try {
    // Scan with automatic logging
    const result = await scannerService.scanDirectory(
      filePath,
      {
        initialScale: 3,
        enableRotation: true,
      },
      logsDir  // ← Results will be logged here
    );

    console.log(`Scanned ${result.scannedCount} files`);
    console.log(`Logs saved to: ${logsDir}/logs.json`);

    // Later, read the logs
    const logService = new LogService(logsDir);
    const stats = await logService.getStatistics();
    console.log(`Total QR codes found: ${stats.totalCodesFound}`);

  } catch (error) {
    console.error('Scanning failed:', error);
  }
}
```

## logs.json Example

```json
{
  "invoice_2024.pdf": {
    "fileName": "invoice_2024.pdf",
    "totalPages": 2,
    "results": {
      "1": {
        "success": true,
        "result": {
          "success": true,
          "codes": [
            {
              "data": "INV-2024-001",
              "format": "QRCode",
              "position": null
            }
          ],
          "error": null
        },
        "scale": 3,
        "rotated": false
      },
      "2": {
        "success": true,
        "result": {
          "success": true,
          "codes": [
            {
              "data": "INV-2024-002",
              "format": "Code128",
              "position": null
            }
          ],
          "error": null
        },
        "scale": 3,
        "rotated": false
      }
    },
    "success": true,
    "timestamp": "2024-02-01T14:30:25.123Z"
  },
  "receipt_2024.pdf": {
    "fileName": "receipt_2024.pdf",
    "totalPages": 1,
    "results": {
      "1": {
        "success": false,
        "result": {
          "success": false,
          "codes": [],
          "error": "NO_BARCODE_FOUND"
        },
        "scale": 3,
        "rotated": false
      }
    },
    "success": false,
    "error": null,
    "timestamp": "2024-02-01T14:32:10.456Z"
  }
}
```

## Configuration

### Default Behavior

- Logs directory must be specified when calling scan methods
- If logs directory is not provided, logging is skipped (no error)
- Each file entry is keyed by its filename
- Timestamps are recorded in ISO format

### Customization

You can extend LogService for custom behavior:

```typescript
class CustomLogService extends LogService {
  async logFileProcess(fileResults: any) {
    // Custom logic before logging
    console.log(`Processing: ${fileResults.fileName}`);

    // Call parent implementation
    await super.logFileProcess(fileResults);

    // Custom logic after logging
    await this.notifyUser(fileResults.fileName);
  }
}
```

## Best Practices

1. **Always pass logs directory** when you want to track scan results
2. **Store logs in user-selected directory** for easy access
3. **Review logs periodically** for quality control
4. **Use statistics** to monitor scan performance
5. **Clear old logs** when starting fresh analysis

## Troubleshooting

### logs.json not created
- Ensure logs directory exists and is writable
- Check console for permission errors
- Verify the directory path is correct

### logs.json file is empty/corrupted
- Delete the file manually to start fresh
- Next scan will create a new logs.json
- Data from corrupted logs may be lost

### Logs not updating
- Verify logsDirectory parameter is passed
- Check that directory has write permissions
- Look for console warnings about logging failures

## Integration with ScannerExample

The ScannerExample component can be updated to auto-log results:

```typescript
const handleDirectoryScan = async () => {
  if (!dirPath.trim()) {
    alert('Please select a directory');
    return;
  }

  // Scan with logging (once logsDirectory is available)
  await scanDirectory(dirPath, config, logsDirectory);
};
```

## Related Files

- `src/main/scanner.ts` - Scanner handlers with logging integration
- `src/renderer/src/services/ScannerService.ts` - Service layer supporting logs parameter
- `src/renderer/src/components/ScannerExample.tsx` - UI component
