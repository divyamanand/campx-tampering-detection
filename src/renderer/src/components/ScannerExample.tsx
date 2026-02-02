import React, { useState, useEffect } from 'react';
import { useDirectoryScan } from '../hooks/useDirectoryScan';
import { useSingleFileScan } from '../hooks/useSingleFileScan';
import { settingsService, type AppSettings } from '../services/SettingsService';

interface ScanConfig {
  initialScale: number;
  enableRotation: boolean;
  rotationDegrees: number;
}

/**
 * ScannerExample Component
 *
 * Demonstrates both single file and directory scanning functionality
 * Shows how to use the custom hooks for PDF scanning
 */
export const ScannerExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'directory'>('single');
  const [filePath, setFilePath] = useState('');
  const [dirPath, setDirPath] = useState('');
  const [config, setConfig] = useState<ScanConfig>({
    initialScale: 3,
    enableRotation: true,
    rotationDegrees: 180,
  });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const appSettings = await settingsService.getSettings();
        setSettings(appSettings);
        // Update config from global settings
        setConfig({
          initialScale: appSettings.initialScale,
          enableRotation: appSettings.enableRotation,
          rotationDegrees: appSettings.rotationDegrees,
        });
        // Set directory path from global settings if available
        if (appSettings.directory) {
          setDirPath(appSettings.directory);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, []);

  // Single file scanning hook
  const {
    scanning: singleScanning,
    result: singleResult,
    error: singleError,
    scanFile,
    reset: resetSingleScan,
  } = useSingleFileScan();

  // Directory scanning hook
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

  const handleSelectFile = async () => {
    try {
      const selected = await window.electronAPI.selectFile();
      if (selected) {
        setFilePath(selected);
      }
    } catch (error) {
      alert(`Error selecting file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) {
        setDirPath(selected);
        // Save directory to global settings
        await settingsService.setDirectory(selected);
      }
    } catch (error) {
      alert(`Error selecting directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Save config changes to global settings
  const updateConfigAndSettings = (newConfig: ScanConfig) => {
    setConfig(newConfig);
    // Update settings in background
    settingsService.updateSettings({
      initialScale: newConfig.initialScale,
      enableRotation: newConfig.enableRotation,
      rotationDegrees: newConfig.rotationDegrees,
    }).catch(error => console.error('Failed to save settings:', error));
  };

  const handleSingleFileScan = async () => {
    if (!filePath.trim()) {
      alert('Please enter a file path');
      return;
    }
    await scanFile(filePath, config);
  };

  const handleDirectoryScan = async () => {
    if (!dirPath.trim()) {
      alert('Please enter a directory path');
      return;
    }
    await scanDirectory(dirPath, config);
  };

  const styles = {
    container: {
      maxWidth: '900px',
      margin: '2rem auto',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tabs: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '2rem',
      borderBottom: '2px solid #e2e8f0',
    },
    tab: {
      padding: '0.75rem 1.5rem',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      fontSize: '1rem',
      borderBottom: '3px solid transparent',
      transition: 'all 0.2s',
    },
    activeTab: {
      borderBottomColor: '#6366f1',
      color: '#6366f1',
      fontWeight: 600,
    },
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    } as React.CSSProperties,
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    } as React.CSSProperties,
    label: {
      fontWeight: 600,
      fontSize: '0.95rem',
      color: '#1f2937',
    },
    input: {
      padding: '0.75rem',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '0.95rem',
      fontFamily: 'monospace',
    },
    inputNumber: {
      padding: '0.5rem',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '0.9rem',
      maxWidth: '150px',
    },
    configRow: {
      display: 'flex',
      gap: '2rem',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
    },
    configGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    } as React.CSSProperties,
    button: {
      padding: '0.75rem 1.5rem',
      backgroundColor: '#6366f1',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: 600,
      transition: 'all 0.2s',
    },
    buttonSecondary: {
      backgroundColor: '#6b7280',
    },
    buttonDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
    progress: {
      padding: '1rem',
      backgroundColor: '#f3f4f6',
      borderRadius: '6px',
      border: '1px solid #d1d5db',
    },
    success: {
      padding: '1rem',
      backgroundColor: '#f0fdf4',
      borderRadius: '6px',
      border: '1px solid #bbf7d0',
      color: '#166534',
    },
    error: {
      padding: '1rem',
      backgroundColor: '#fef2f2',
      borderRadius: '6px',
      border: '1px solid #fecaca',
      color: '#dc2626',
    },
    resultGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gap: '1rem',
    },
    resultCard: {
      padding: '1rem',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      backgroundColor: '#f9fafb',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={{ marginBottom: '2rem', color: '#111827' }}>PDF Scanner</h1>

      {loadingSettings && (
        <div style={{ ...styles.progress, marginBottom: '2rem' }}>
          Loading settings...
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'single' ? styles.activeTab : {}),
          }}
          onClick={() => setActiveTab('single')}
        >
          Single File
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'directory' ? styles.activeTab : {}),
          }}
          onClick={() => setActiveTab('directory')}
        >
          Directory
        </button>
      </div>

      {/* Configuration */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
        <h3 style={{ marginTop: 0 }}>Scanner Configuration</h3>
        <div style={styles.configRow}>
          <div style={styles.configGroup}>
            <label style={styles.label}>Initial Scale</label>
            <input
              type="number"
              min="1"
              max="5"
              value={config.initialScale}
              onChange={(e) => updateConfigAndSettings({ ...config, initialScale: parseInt(e.target.value) })}
              style={styles.inputNumber}
            />
          </div>
          <div style={styles.configGroup}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={config.enableRotation}
                onChange={(e) => updateConfigAndSettings({ ...config, enableRotation: e.target.checked })}
              />
              Enable Rotation
            </label>
          </div>
          {config.enableRotation && (
            <div style={styles.configGroup}>
              <label style={styles.label}>Rotation Degrees</label>
              <input
                type="number"
                value={config.rotationDegrees}
                onChange={(e) => updateConfigAndSettings({ ...config, rotationDegrees: parseInt(e.target.value) })}
                style={styles.inputNumber}
              />
            </div>
          )}
        </div>
      </div>

      {/* Single File Tab */}
      {activeTab === 'single' && (
        <div style={styles.section}>
          <div style={styles.formGroup}>
            <label style={styles.label}>PDF File Path</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <input
                type="text"
                placeholder="e.g., /path/to/document.pdf"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                disabled={singleScanning}
                style={{ ...styles.input, flex: 1 }}
              />
              <button
                onClick={handleSelectFile}
                disabled={singleScanning}
                style={{
                  ...styles.button,
                  padding: '0.75rem 1rem',
                  marginTop: 0,
                  ...(singleScanning ? styles.buttonDisabled : {}),
                }}
                title="Browse for PDF file"
              >
                📁
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleSingleFileScan}
              disabled={singleScanning}
              style={{
                ...styles.button,
                ...(singleScanning ? styles.buttonDisabled : {}),
              }}
            >
              {singleScanning ? 'Scanning...' : 'Scan File'}
            </button>
            <button
              onClick={resetSingleScan}
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
              }}
            >
              Reset
            </button>
          </div>

          {singleError && <div style={styles.error}>Error: {singleError}</div>}

          {singleResult && (
            <div style={singleResult.success ? styles.success : styles.error}>
              <h4 style={{ marginTop: 0 }}>{singleResult.fileName}</h4>
              <p>Total Pages: {singleResult.totalPages}</p>
              <p>Status: {singleResult.success ? '✓ Success' : '✗ Failed'}</p>
              {singleResult.error && <p>Error: {singleResult.error}</p>}
            </div>
          )}
        </div>
      )}

      {/* Directory Tab */}
      {activeTab === 'directory' && (
        <div style={styles.section}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Directory Path</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <input
                type="text"
                placeholder="e.g., /path/to/pdf/folder"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                disabled={dirScanning}
                style={{ ...styles.input, flex: 1 }}
              />
              <button
                onClick={handleSelectDirectory}
                disabled={dirScanning}
                style={{
                  ...styles.button,
                  padding: '0.75rem 1rem',
                  marginTop: 0,
                  ...(dirScanning ? styles.buttonDisabled : {}),
                }}
                title="Browse for directory"
              >
                📁
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleDirectoryScan}
              disabled={dirScanning}
              style={{
                ...styles.button,
                ...(dirScanning ? styles.buttonDisabled : {}),
              }}
            >
              {dirScanning ? 'Scanning Directory...' : 'Scan Directory'}
            </button>
            <button
              onClick={resetDirScan}
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
              }}
            >
              Reset
            </button>
          </div>

          {dirScanning && scanProgress && (
            <div style={styles.progress}>
              <h4 style={{ marginTop: 0 }}>Scanning: {scanProgress.fileName}</h4>
              <p>Page {scanProgress.pageNumber} / {scanProgress.totalPages}</p>
            </div>
          )}

          {dirError && <div style={styles.error}>Error: {dirError}</div>}

          {!dirScanning && (scannedCount > 0 || failedCount > 0) && (
            <>
              <div style={styles.success}>
                <h4 style={{ marginTop: 0 }}>Summary</h4>
                <p>Scanned: {scannedCount}</p>
                <p>Failed: {failedCount}</p>
              </div>

              {Object.keys(dirResults).length > 0 && (
                <>
                  <h3>Results</h3>
                  <div style={styles.resultGrid}>
                    {Object.entries(dirResults).map(([fileName, result]) => (
                      <div
                        key={fileName}
                        style={{
                          ...styles.resultCard,
                          borderColor: result.success ? '#d1fae5' : '#fecaca',
                          backgroundColor: result.success ? '#f0fdf4' : '#fef2f2',
                        }}
                      >
                        <h5 style={{ marginTop: 0 }}>{result.fileName}</h5>
                        <p>Pages: {result.totalPages}</p>
                        <p>
                          Status: <strong>{result.success ? '✓ Success' : '✗ Failed'}</strong>
                        </p>
                        {result.error && <p style={{ color: '#dc2626' }}>Error: {result.error}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ScannerExample;
