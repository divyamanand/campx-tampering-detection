# ZXing WASM Setup Guide

## Overview

The application uses `zxing-wasm` for barcode and QR code scanning. The WASM module requires proper path configuration to work in both development and production environments.

## File Structure

```
project-root/
├── assets/
│   └── wasm/
│       └── zxing_reader.wasm          ← Primary WASM file
├── src/
│   ├── main/
│   │   ├── zxingSetup.ts               ← WASM initialization
│   │   ├── index.ts                    ← Main process
│   │   └── services/
│   │       └── ScanImage.ts            ← Uses WASM for scanning
│   └── renderer/
└── dist/
    ├── main/                           ← Compiled main process
    └── renderer/                       ← Compiled renderer
```

## How It Works

### 1. **Initialization (Main Process)**

When the Electron app starts:
```
app.whenReady()
  → initZXing() called in index.ts
  → zxingSetup.ts locates and prepares WASM file
  → Emscripten module is configured with locateFile callback
```

### 2. **Scanning**

When a scan is requested:
```
ScanImage.scan()
  → Checks if ZXing is initialized
  → If not, calls initZXing()
  → Calls readBarcodes() from zxing-wasm
  → Returns scan results
```

## Path Resolution

The `zxingSetup.ts` tries to find the WASM file in this order:

1. **Development**: `process.cwd()/assets/wasm/zxing_reader.wasm`
   - Works when running with `npm run dev`

2. **App Root**: `app.getAppPath()/assets/wasm/zxing_reader.wasm`
   - Works in most Electron environments

3. **Resources**: `process.resourcesPath/assets/wasm/zxing_reader.wasm`
   - Works in packaged/built applications

4. **Fallback**: Uses WASM from `node_modules/zxing-wasm/dist/reader/zxing_reader.wasm`
   - Last resort fallback

## Development Setup

### Running the App

```bash
npm run dev
```

This command:
1. Builds main process (`tsc`)
2. Starts Vite dev server (renderer)
3. Launches Electron

The WASM file must be accessible at `./assets/wasm/zxing_reader.wasm` from the project root.

### Verifying Setup

Check the console output when the app starts:
```
✓ Found WASM at: /path/to/project/assets/wasm/zxing_reader.wasm
✓ ZXing WASM module initialized successfully
```

## Production Build Setup

### Building for Distribution

```bash
npm run dist
```

This creates a packaged application with electron-builder.

### Ensuring WASM is Included

For electron-builder to include the WASM file in the distribution, you may need to add this to `package.json`:

```json
{
  "build": {
    "files": [
      "dist/**/*",
      "assets/**/*",
      "node_modules/**/*"
    ]
  }
}
```

Or create an `electron-builder.yml`:

```yaml
files:
  - from: dist
    to: .
  - from: assets
    to: assets
  - from: node_modules
    to: node_modules

directories:
  buildResources: assets
```

## Troubleshooting

### Error: "Aborted(both async and sync fetching of the wasm failed)"

**Cause**: WASM file not found at expected location

**Solution**:
1. Check console for "Attempted paths" messages
2. Verify file exists: `ls -la assets/wasm/zxing_reader.wasm`
3. In development: restart with `npm run dev`
4. In production: check electron-builder config

### Error: "Cannot find module 'zxing-wasm'"

**Cause**: Package not installed

**Solution**:
```bash
npm install zxing-wasm
```

### Scanning returns "NO_BARCODE_FOUND" for valid codes

**Cause**: WASM module might not be fully initialized

**Solution**: The app now calls `ScanImage.ensureInitialized()` before each scan, which retries initialization if needed.

### WASM not found in production build

**Cause**: Assets not copied to build

**Solution**:
1. Verify electron-builder config includes `assets/**/*`
2. Run clean build: `rm -rf dist && npm run dist`
3. Check built app for `resources/assets/wasm/` directory

## How Initialization Works

```typescript
// src/main/zxingSetup.ts
export async function initZXing() {
  if (prepared) return; // Only initialize once

  const getWasmPath = (file: string): string => {
    // Tries multiple locations
    // Returns first path that exists
    // Falls back to node_modules if needed
  };

  prepareZXingModule({
    overrides: {
      locateFile: getWasmPath, // Custom file locator
    },
  });

  prepared = true;
}
```

## How Scanning Works

```typescript
// src/main/services/ScanImage.ts
export class ScanImage {
  private static initialized = false;

  private static async ensureInitialized(): Promise<void> {
    if (!ScanImage.initialized) {
      await initZXing(); // Initialize if needed
      ScanImage.initialized = true;
    }
  }

  async scan(imageData: ImageData): Promise<ScanResult> {
    await ScanImage.ensureInitialized(); // Guarantee initialization
    const results = await readBarcodes(imageData, this.readerOptions);
    // ... process and return results
  }
}
```

## Key Files Modified

| File | Changes |
|------|---------|
| `src/main/zxingSetup.ts` | Enhanced path resolution with fallbacks |
| `src/main/services/ScanImage.ts` | Added initialization guarantee |
| `src/main/index.ts` | Calls `initZXing()` on app startup |

## Configuration Options

### PDFManager Config (affects scanning)

```typescript
interface PDFManagerConfig {
  initialScale?: number;        // Default: 3 (higher = more detail)
  enableRotation?: boolean;     // Default: true (try 180° rotation)
  rotationDegrees?: number;     // Default: 180
}
```

### Scanner Options (affects scanning)

```typescript
interface ScannerOptions {
  tryHarder?: boolean;          // Default: true
  formats?: string[];           // Default: ["QRCode", "Code128"]
  maxNumberOfSymbols?: number;  // Default: 2
}
```

## Performance Tips

1. **Initialize Once**: ZXing is initialized only once per session
2. **Batch Scanning**: Process multiple PDFs in a batch for efficiency
3. **Scale Factor**: Lower scale (2-3) is usually sufficient
4. **Rotation**: Only enable if needed (increases processing time)

## Security Considerations

- WASM module runs in Node.js context with full filesystem access
- Only load trusted WASM files
- Validate file paths before processing

## Related Documentation

- [Scanner Usage Guide](src/renderer/src/services/SCANNER_USAGE.md)
- [Quick Start Scanner](QUICK_START_SCAN.md)
- [Scan Integration](SCAN_INTEGRATION.md)
- [zxing-wasm GitHub](https://github.com/zxing-js/zxing-wasm)

## Debugging

Enable detailed logging:

```typescript
// In zxingSetup.ts, uncomment for verbose output
console.log(`Checking WASM path: ${filePath}`);
console.log(`Path exists: ${fs.existsSync(filePath)}`);
```

Check Electron main process logs:
```bash
npm run dev 2>&1 | grep -i "wasm\|zxing"
```

## Common Issues Checklist

- [ ] WASM file exists at `assets/wasm/zxing_reader.wasm`
- [ ] App is started with `npm run dev` or properly built
- [ ] Console shows "✓ Found WASM at:" message
- [ ] Console shows "✓ ZXing WASM module initialized successfully"
- [ ] No errors before first scan attempt
- [ ] In production: electron-builder config includes assets
