import React, { useState } from 'react';
import { useDirectoryScan } from '../hooks/useDirectoryScan';
import { useSingleFileScan } from '../hooks/useSingleFileScan';

type ScanMode = 'single-file' | 'directory';

interface ScanConfig {
  initialScale: number;
  enableRotation: boolean;
  rotationDegrees: number;
}

/**
 * Scan Component
 *
 * Main scanning interface that allows users to:
 * - Select between single file or directory scan
 * - Input file/directory paths
 * - Configure scanner settings
 * - View real-time progress
 * - Display results
 */
export const Scan: React.FC = () => {
  const [scanMode, setScanMode] = useState<ScanMode>('single-file');
  const [filePath, setFilePath] = useState('');
  const [dirPath, setDirPath] = useState('');
  const [config, setConfig] = useState<ScanConfig>({
    initialScale: 3,
    enableRotation: true,
    rotationDegrees: 180,
  });
  const [showResults, setShowResults] = useState(false);

  // Hooks for scanning
  const {
    scanning: singleScanning,
    result: singleResult,
    error: singleError,
    scanFile,
    reset: resetSingleScan,
  } = useSingleFileScan();

  const {
    scanning: dirScanning,
    results: dirResults,
    scanProgress,
    scannedCount,
    failedCount,
    error: dirError,
    scanDirectory,
    reset: resetDirScan,
  } = useDirectoryScan();

  const isScanning = singleScanning || dirScanning;
  const hasError = singleError || dirError;
  const error = singleError || dirError;

  const handleStartScan = async () => {
    if (scanMode === 'single-file') {
      if (!filePath.trim()) {
        alert('Please enter a file path');
        return;
      }
      await scanFile(filePath, config);
      setShowResults(true);
    } else {
      if (!dirPath.trim()) {
        alert('Please enter a directory path');
        return;
      }
      await scanDirectory(dirPath, config);
      setShowResults(true);
    }
  };

  const handleReset = () => {
    setFilePath('');
    setDirPath('');
    setShowResults(false);
    resetSingleScan();
    resetDirScan();
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
    },
    wrapper: {
      maxWidth: '1000px',
      margin: '0 auto',
    },
    card: {
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      padding: '2rem',
      marginBottom: '2rem',
    },
    header: {
      marginBottom: '2rem',
      textAlign: 'center' as const,
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: '700',
      color: 'white',
      margin: '0 0 0.5rem 0',
    },
    subtitle: {
      fontSize: '1.1rem',
      color: 'rgba(255, 255, 255, 0.9)',
      margin: 0,
    },
    modeSelector: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '1rem',
      marginBottom: '2rem',
    },
    modeButton: {
      padding: '1rem',
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      background: '#f9fafb',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: '600',
      transition: 'all 0.3s',
      textAlign: 'center' as const,
    },
    modeButtonActive: {
      borderColor: '#6366f1',
      background: '#f0f4ff',
      color: '#6366f1',
    },
    section: {
      marginBottom: '2rem',
    },
    sectionTitle: {
      fontSize: '1.1rem',
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: '1rem',
      marginTop: 0,
    },
    formGroup: {
      marginBottom: '1.5rem',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.5rem',
    },
    label: {
      fontWeight: '600',
      fontSize: '0.95rem',
      color: '#374151',
    },
    input: {
      padding: '0.75rem 1rem',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '0.95rem',
      fontFamily: 'monospace',
      transition: 'all 0.2s',
    },
    inputFocus: {
      borderColor: '#6366f1',
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
    },
    configGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1.5rem',
      marginBottom: '1.5rem',
    },
    configItem: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.5rem',
    },
    inputNumber: {
      padding: '0.5rem 0.75rem',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '0.9rem',
      maxWidth: '100%',
    },
    checkbox: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      cursor: 'pointer',
    },
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap' as const,
      marginTop: '2rem',
    },
    button: {
      padding: '0.75rem 1.5rem',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: '600',
      transition: 'all 0.3s',
      flex: '1 0 auto',
      minWidth: '120px',
    },
    buttonPrimary: {
      background: '#6366f1',
      color: 'white',
    },
    buttonSecondary: {
      background: '#e5e7eb',
      color: '#374151',
    },
    buttonDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
    progressSection: {
      background: '#f0f4ff',
      border: '1px solid #c7d2fe',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1.5rem',
    },
    progressTitle: {
      margin: '0 0 1rem 0',
      color: '#4338ca',
      fontSize: '0.95rem',
      fontWeight: '600',
    },
    progressBar: {
      background: '#e5e7eb',
      borderRadius: '4px',
      height: '8px',
      overflow: 'hidden',
      marginBottom: '1rem',
    },
    progressFill: {
      background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
      height: '100%',
      transition: 'width 0.3s ease',
    },
    progressText: {
      fontSize: '0.85rem',
      color: '#4b5563',
      margin: '0.5rem 0',
      lineHeight: '1.5',
    },
    successAlert: {
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1.5rem',
      color: '#166534',
    },
    errorAlert: {
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1.5rem',
      color: '#dc2626',
    },
    warningAlert: {
      background: '#fffbeb',
      border: '1px solid #fde68a',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1.5rem',
      color: '#92400e',
    },
    alertTitle: {
      fontSize: '1rem',
      fontWeight: '600',
      marginTop: 0,
      marginBottom: '0.5rem',
    },
    resultGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1.5rem',
      marginTop: '1.5rem',
    },
    resultCard: {
      padding: '1.5rem',
      border: '2px solid',
      borderRadius: '8px',
      transition: 'all 0.2s',
    },
    resultCardSuccess: {
      borderColor: '#bbf7d0',
      background: '#f0fdf4',
    },
    resultCardError: {
      borderColor: '#fecaca',
      background: '#fef2f2',
    },
    resultCardTitle: {
      fontSize: '0.9rem',
      fontWeight: '600',
      color: '#374151',
      margin: '0 0 0.75rem 0',
      wordBreak: 'break-word' as const,
    },
    resultCardMeta: {
      fontSize: '0.85rem',
      color: '#6b7280',
      lineHeight: '1.6',
    },
    resultCardStatus: {
      fontSize: '0.85rem',
      fontWeight: '600',
      marginTop: '0.75rem',
    },
    statusSuccess: {
      color: '#15803d',
    },
    statusError: {
      color: '#dc2626',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>📄 PDF Scanner</h1>
          <p style={styles.subtitle}>Scan PDFs for QR codes and barcodes</p>
        </div>

        {/* Main Card */}
        <div style={styles.card}>
          {/* Scan Mode Selection */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Select Scan Mode</h2>
            <div style={styles.modeSelector}>
              <button
                style={{
                  ...styles.modeButton,
                  ...(scanMode === 'single-file' ? styles.modeButtonActive : {}),
                }}
                onClick={() => setScanMode('single-file')}
                disabled={isScanning}
              >
                📋 Single File
              </button>
              <button
                style={{
                  ...styles.modeButton,
                  ...(scanMode === 'directory' ? styles.modeButtonActive : {}),
                }}
                onClick={() => setScanMode('directory')}
                disabled={isScanning}
              >
                📁 Directory
              </button>
            </div>
          </div>

          {/* Path Input Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Path</h2>
            {scanMode === 'single-file' ? (
              <div style={styles.formGroup}>
                <label style={styles.label}>PDF File Path</label>
                <input
                  type="text"
                  placeholder="e.g., /path/to/document.pdf or C:\path\to\document.pdf"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  disabled={isScanning}
                  style={styles.input}
                />
              </div>
            ) : (
              <div style={styles.formGroup}>
                <label style={styles.label}>Directory Path</label>
                <input
                  type="text"
                  placeholder="e.g., /path/to/pdfs or C:\path\to\pdfs"
                  value={dirPath}
                  onChange={(e) => setDirPath(e.target.value)}
                  disabled={isScanning}
                  style={styles.input}
                />
              </div>
            )}
          </div>

          {/* Configuration Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Scanner Configuration</h2>
            <div style={styles.configGrid}>
              <div style={styles.configItem}>
                <label style={styles.label}>Initial Scale</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.5"
                  value={config.initialScale}
                  onChange={(e) =>
                    setConfig({ ...config, initialScale: parseFloat(e.target.value) })
                  }
                  disabled={isScanning}
                  style={styles.inputNumber}
                />
              </div>
              <div style={styles.configItem}>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={config.enableRotation}
                    onChange={(e) =>
                      setConfig({ ...config, enableRotation: e.target.checked })
                    }
                    disabled={isScanning}
                  />
                  <span>Enable Rotation</span>
                </label>
              </div>
              {config.enableRotation && (
                <div style={styles.configItem}>
                  <label style={styles.label}>Rotation Degrees</label>
                  <input
                    type="number"
                    value={config.rotationDegrees}
                    onChange={(e) =>
                      setConfig({ ...config, rotationDegrees: parseInt(e.target.value) })
                    }
                    disabled={isScanning}
                    style={styles.inputNumber}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={styles.buttonGroup}>
            <button
              onClick={handleStartScan}
              disabled={isScanning}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(isScanning ? styles.buttonDisabled : {}),
              }}
            >
              {isScanning ? (
                <>
                  <span style={{ marginRight: '0.5rem' }}>⏳</span>
                  {scanMode === 'single-file' ? 'Scanning File...' : 'Scanning Directory...'}
                </>
              ) : (
                <>
                  <span style={{ marginRight: '0.5rem' }}>🔍</span>
                  Start Scan
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              disabled={isScanning}
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                ...(isScanning ? styles.buttonDisabled : {}),
              }}
            >
              Reset
            </button>
          </div>

          {/* Progress Display for Directory Scan */}
          {dirScanning && scanProgress && (
            <div style={styles.progressSection}>
              <h3 style={styles.progressTitle}>⏳ Scanning Progress</h3>
              <div style={styles.progressBar}>
                <div style={styles.progressFill} />
              </div>
              <p style={styles.progressText}>
                <strong>File:</strong> {scanProgress.fileName}
              </p>
              <p style={styles.progressText}>
                <strong>Page:</strong> {scanProgress.pageNumber} / {scanProgress.totalPages}
              </p>
            </div>
          )}

          {/* Error Alert */}
          {hasError && (
            <div style={styles.errorAlert}>
              <h3 style={styles.alertTitle}>❌ Error</h3>
              <p style={{ margin: '0.5rem 0' }}>{error}</p>
            </div>
          )}

          {/* Single File Results */}
          {!isScanning && singleResult && showResults && (
            <div
              style={{
                ...styles.successAlert,
                ...(singleResult.success ? {} : styles.errorAlert),
              }}
            >
              <h3 style={styles.alertTitle}>
                {singleResult.success ? '✓ Scan Complete' : '✗ Scan Failed'}
              </h3>
              <div style={{ margin: '1rem 0' }}>
                <p style={{ margin: '0.5rem 0' }}>
                  <strong>File:</strong> {singleResult.fileName}
                </p>
                <p style={{ margin: '0.5rem 0' }}>
                  <strong>Total Pages:</strong> {singleResult.totalPages}
                </p>
                {singleResult.error && (
                  <p style={{ margin: '0.5rem 0' }}>
                    <strong>Error:</strong> {singleResult.error}
                  </p>
                )}
              </div>
              {singleResult.results && Object.keys(singleResult.results).length > 0 && (
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
                    View Detailed Results ({Object.keys(singleResult.results).length} pages)
                  </summary>
                  <pre
                    style={{
                      background: 'rgba(0, 0, 0, 0.05)',
                      padding: '1rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      marginTop: '0.5rem',
                    }}
                  >
                    {JSON.stringify(singleResult.results, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Directory Scan Results */}
          {!isScanning && (scannedCount > 0 || failedCount > 0) && showResults && (
            <>
              <div
                style={{
                  ...styles.successAlert,
                  ...(failedCount > 0 ? styles.warningAlert : {}),
                }}
              >
                <h3 style={styles.alertTitle}>
                  {failedCount === 0 ? '✓ Scan Complete' : '⚠ Scan Complete (with errors)'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <p style={{ margin: '0.5rem 0' }}>
                      <strong>Successfully Scanned:</strong>
                    </p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
                      {scannedCount}
                    </p>
                  </div>
                  {failedCount > 0 && (
                    <div>
                      <p style={{ margin: '0.5rem 0' }}>
                        <strong>Failed:</strong>
                      </p>
                      <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#dc2626' }}>
                        {failedCount}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {Object.keys(dirResults).length > 0 && (
                <>
                  <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#1f2937' }}>
                    📊 Results
                  </h3>
                  <div style={styles.resultGrid}>
                    {Object.entries(dirResults).map(([fileName, result]) => (
                      <div
                        key={fileName}
                        style={{
                          ...styles.resultCard,
                          ...(result.success
                            ? styles.resultCardSuccess
                            : styles.resultCardError),
                        }}
                      >
                        <h4 style={styles.resultCardTitle}>{result.fileName}</h4>
                        <div style={styles.resultCardMeta}>
                          <p style={{ margin: '0.25rem 0' }}>
                            <strong>Pages:</strong> {result.totalPages}
                          </p>
                          <p
                            style={{
                              ...styles.resultCardStatus,
                              ...(result.success
                                ? styles.statusSuccess
                                : styles.statusError),
                            }}
                          >
                            {result.success ? '✓ Success' : '✗ Failed'}
                          </p>
                          {result.error && (
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem' }}>
                              Error: {result.error}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scan;
