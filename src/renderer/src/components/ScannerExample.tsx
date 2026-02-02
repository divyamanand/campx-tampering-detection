import React, { useState, useEffect } from 'react';
import { useBatchScan } from '../hooks/useBatchScan';
import { useTimer } from '../hooks/useTimer';
import { settingsService } from '../services/SettingsService';
import type { BatchSettings } from '../../../main/types/batchSettings.types';

interface ScanConfig {
  initialScale: number;
  enableRotation: boolean;
  rotationDegrees: number;
}

/**
 * ScannerExample Component
 *
 * Batch-based PDF scanning with:
 * - Verification (tampering detection)
 * - File routing (tampered/retry/scan_passed)
 * - Crash-safe logging
 * - Pause/Resume/Stop controls
 */
export const ScannerExample: React.FC = () => {
  const [dirPath, setDirPath] = useState('');
  const [config, setConfig] = useState<ScanConfig>({
    initialScale: 3,
    enableRotation: true,
    rotationDegrees: 180,
  });
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Batch scanning hook
  const {
    scanning,
    paused,
    batchProgress,
    error,
    startBatch,
    pause,
    resume,
    stop,
  } = useBatchScan();

  // Timer for elapsed time
  const elapsedTimer = useTimer({
    isRunning: scanning && !paused,
    autoReset: true,
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const appSettings = await settingsService.getSettings();
        setConfig({
          initialScale: appSettings.initialScale,
          enableRotation: appSettings.enableRotation,
          rotationDegrees: appSettings.rotationDegrees,
        });
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

  const handleSelectDirectory = async () => {
    try {
      const selected = await window.electronAPI.selectDirectory();
      if (selected) {
        setDirPath(selected);
        await settingsService.setDirectory(selected);
      }
    } catch (error) {
      alert(`Error selecting directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const updateConfigAndSettings = (newConfig: ScanConfig) => {
    setConfig(newConfig);
    settingsService.updateSettings({
      initialScale: newConfig.initialScale,
      enableRotation: newConfig.enableRotation,
      rotationDegrees: newConfig.rotationDegrees,
    }).catch(error => console.error('Failed to save settings:', error));
  };

  const handleStartBatch = async () => {
    if (!dirPath.trim()) {
      alert('Please select a directory');
      return;
    }

    const batchSettings: BatchSettings = {
      directory: dirPath,
      batchSize: 4,
      pollingIntervalMs: 5000,
      pdfConfig: config,
    };

    await startBatch(batchSettings);
  };

  const handlePause = async () => {
    await pause();
  };

  const handleResume = async () => {
    await resume();
  };

  const handleStop = async () => {
    await stop();
  };

  const styles = {
    container: {
      maxWidth: '900px',
      margin: '2rem auto',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    header: {
      marginBottom: '2rem',
      color: '#111827',
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
      flexWrap: 'wrap' as const,
      alignItems: 'flex-end',
    } as React.CSSProperties,
    configGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    } as React.CSSProperties,
    buttonGroup: {
      display: 'flex',
      gap: '0.75rem',
      flexWrap: 'wrap',
      alignItems: 'center',
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
    buttonDanger: {
      backgroundColor: '#dc2626',
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
      marginTop: '1rem',
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
    timer: {
      fontSize: '1.2rem',
      fontWeight: 600,
      color: '#6366f1',
      minWidth: '100px',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>📄 PDF Scanner</h1>

      {loadingSettings && (
        <div style={{ ...styles.progress, marginBottom: '2rem' }}>
          Loading settings...
        </div>
      )}

      {/* Configuration Section */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
        <h3 style={{ marginTop: 0 }}>⚙️ Scanner Configuration</h3>
        <div style={styles.configRow}>
          <div style={styles.configGroup}>
            <label style={styles.label}>Initial Scale</label>
            <input
              type="number"
              min="1"
              max="5"
              value={config.initialScale}
              onChange={(e) => updateConfigAndSettings({ ...config, initialScale: parseInt(e.target.value) })}
              disabled={scanning}
              style={styles.inputNumber}
            />
          </div>
          <div style={styles.configGroup}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={config.enableRotation}
                onChange={(e) => updateConfigAndSettings({ ...config, enableRotation: e.target.checked })}
                disabled={scanning}
              />
              {' '}Enable Rotation
            </label>
          </div>
          {config.enableRotation && (
            <div style={styles.configGroup}>
              <label style={styles.label}>Rotation Degrees</label>
              <input
                type="number"
                value={config.rotationDegrees}
                onChange={(e) => updateConfigAndSettings({ ...config, rotationDegrees: parseInt(e.target.value) })}
                disabled={scanning}
                style={styles.inputNumber}
              />
            </div>
          )}
        </div>
      </div>

      {/* Batch Scanning Section */}
      <div style={styles.section}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>🔍 Batch Scanning</h2>

        <div style={styles.formGroup}>
          <label style={styles.label}>Directory Path</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <input
              type="text"
              placeholder="e.g., /path/to/pdf/folder"
              value={dirPath}
              onChange={(e) => setDirPath(e.target.value)}
              disabled={scanning}
              style={{ ...styles.input, flex: 1 }}
            />
            <button
              onClick={handleSelectDirectory}
              disabled={scanning}
              style={{
                ...styles.button,
                padding: '0.75rem 1rem',
                marginTop: 0,
                ...(scanning ? styles.buttonDisabled : {}),
              }}
              title="Browse for directory"
            >
              📁
            </button>
          </div>
        </div>

        {/* Control Buttons */}
        <div style={styles.buttonGroup}>
          {!scanning ? (
            <button
              onClick={handleStartBatch}
              style={{
                ...styles.button,
                ...(scanning ? styles.buttonDisabled : {}),
              }}
            >
              ▶️ Start Scan
            </button>
          ) : (
            <>
              {!paused ? (
                <button
                  onClick={handlePause}
                  style={{
                    ...styles.button,
                    ...styles.buttonSecondary,
                  }}
                >
                  ⏸️ Pause
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  style={{
                    ...styles.button,
                    ...styles.buttonSecondary,
                  }}
                >
                  ▶️ Resume
                </button>
              )}
              <button
                onClick={handleStop}
                style={{
                  ...styles.button,
                  ...styles.buttonDanger,
                }}
              >
                ⏹️ Stop
              </button>
            </>
          )}

          {scanning && (
            <div style={styles.timer}>
              ⏱️ {elapsedTimer.formattedTime}
            </div>
          )}
        </div>

        {/* Status Messages */}
        {error && <div style={styles.error}>❌ Error: {error}</div>}

        {paused && (
          <div style={styles.progress}>
            ⏸️ Scanning paused. Click Resume to continue.
          </div>
        )}

        {scanning && batchProgress && (
          <div style={styles.progress}>
            <h4 style={{ marginTop: 0 }}>📄 Batch {batchProgress.batchIndex}</h4>
            <p>Processed: {batchProgress.totalProcessed} / {batchProgress.totalFiles}</p>
            <p>Queued: {batchProgress.queuedFiles}</p>
            {batchProgress.throughputPerSec && (
              <p>Throughput: {batchProgress.throughputPerSec.toFixed(2)} files/sec</p>
            )}
            {batchProgress.estimatedRemainingMins && (
              <p>⏳ Est. Time Remaining: {batchProgress.estimatedRemainingMins} min(s)</p>
            )}
          </div>
        )}

        {!scanning && batchProgress && (
          <div style={styles.success}>
            <h4 style={{ marginTop: 0 }}>✅ Batch Completed</h4>
            <p>Total Processed: {batchProgress.totalProcessed}</p>
            <p>Status: {batchProgress.type === 'batch-complete' ? 'Completed' : 'Error'}</p>
            {batchProgress.error && <p>Error: {batchProgress.error}</p>}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '6px', borderLeft: '4px solid #0284c7' }}>
        <h3 style={{ marginTop: 0 }}>ℹ️ About Batch Scanning</h3>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li><strong>Scanning:</strong> Converts PDFs to images and detects barcodes</li>
          <li><strong>Verification:</strong> Checks for tampering (code mismatches, missing QRs, invalid page counts)</li>
          <li><strong>Routing:</strong> Automatically organizes files into folders based on scan results</li>
          <li><strong>Logging:</strong> Crash-safe batch logs with resume capability</li>
        </ul>
        <p style={{ fontSize: '0.9rem', color: '#0c4a6e', margin: 0 }}>
          Files are organized into: <code>tampered/</code>, <code>retry/</code>, <code>scan_passed/</code>
        </p>
      </div>
    </div>
  );
};

export default ScannerExample;
