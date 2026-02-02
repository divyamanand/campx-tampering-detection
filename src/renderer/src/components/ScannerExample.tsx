import React, { useState, useEffect } from 'react';
import { useBatchScan } from '../hooks/useBatchScan';
import { settingsService } from '../services/SettingsService';
import type { BatchSettings } from '../../../main/types/batchSettings.types';

interface ScanConfig {
  initialScale: number;
  enableRotation: boolean;
  rotationDegrees: number;
}

/**
 * Format elapsed time in milliseconds to HH:MM:SS format
 */
function formatTime(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
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
    batchState,
    batchProgress,
    error,
    startBatch,
    pause,
    resume,
    stop,
  } = useBatchScan();

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
        </div>

        {/* Status Messages */}
        {error && <div style={styles.error}>❌ Error: {error}</div>}

        {paused && (
          <div style={styles.progress}>
            ⏸️ Scanning paused. Click Resume to continue.
          </div>
        )}

        {scanning && (
          <div style={styles.progress}>
            {/* Real-time Progress from Emitter */}
            {batchProgress && (
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #d1d5db' }}>
                <h4 style={{ marginTop: 0, color: '#1f2937' }}>⚡ Real-time Progress (from onBatchProgress emitter)</h4>

                {/* Progress Bar */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <span><strong>Files Processed:</strong> {batchProgress.totalProcessed} / {batchProgress.totalFiles}</span>
                    <span><strong>{Math.round((batchProgress.totalProcessed / batchProgress.totalFiles) * 100)}%</strong></span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '28px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid #d1d5db',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.round((batchProgress.totalProcessed / batchProgress.totalFiles) * 100)}%`,
                      backgroundColor: '#10b981',
                      transition: 'width 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: '8px',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }} >
                      {Math.round((batchProgress.totalProcessed / batchProgress.totalFiles) * 100)}%
                    </div>
                  </div>
                </div>

                {/* Progress Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <div><strong>Current Batch:</strong> #{batchProgress.batchIndex}</div>
                  <div><strong>Processed in Batch:</strong> {batchProgress.processedInBatch} files</div>
                  <div><strong>Queued Files:</strong> {batchProgress.queuedFiles}</div>
                  <div><strong>Event Type:</strong> <span style={{ color: batchProgress.type === 'batch-progress' ? '#2563eb' : batchProgress.type === 'batch-complete' ? '#10b981' : '#dc2626' }}>{batchProgress.type}</span></div>
                  {batchProgress.throughputPerSec !== undefined && (
                    <div><strong>⚙️ Throughput:</strong> {batchProgress.throughputPerSec.toFixed(2)} files/sec</div>
                  )}
                  {batchProgress.estimatedRemainingMins !== undefined && (
                    <div><strong>⏳ Est. Remaining:</strong> {batchProgress.estimatedRemainingMins} min(s)</div>
                  )}
                </div>
              </div>
            )}

            {/* Batch State from Polling */}
            {batchState && (
              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #d1d5db' }}>
                <h4 style={{ marginTop: 0, color: '#1f2937' }}>📊 Batch State (from getBatchState polling)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <div>
                    <strong>Status:</strong>
                    <div style={{
                      display: 'inline-block',
                      marginLeft: '0.5rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: batchState.active ? '#dcfce7' : '#f3f4f6',
                      color: batchState.active ? '#166534' : '#6b7280',
                      fontSize: '0.85rem'
                    }}>
                      {batchState.active ? '🟢 Active' : '⚪ Inactive'}
                    </div>
                  </div>
                  <div>
                    <strong>Pause:</strong>
                    <div style={{
                      display: 'inline-block',
                      marginLeft: '0.5rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: batchState.paused ? '#fef3c7' : '#f3f4f6',
                      color: batchState.paused ? '#b45309' : '#6b7280',
                      fontSize: '0.85rem'
                    }}>
                      {batchState.paused ? '⏸️ Paused' : '▶️ Running'}
                    </div>
                  </div>
                  <div><strong>Elapsed:</strong> {formatTime(batchState.elapsedMs)}</div>
                  <div><strong>Total Files:</strong> {batchState.totalFiles}</div>
                  <div><strong>Processed:</strong> {batchState.processedFiles}</div>
                  <div><strong>Remaining:</strong> {batchState.queuedFiles}</div>
                </div>
              </div>
            )}

            {/* Combined Stats */}
            {batchProgress && batchState && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '6px',
                border: '1px solid #bbf7d0',
                fontSize: '0.9rem'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: '#166534' }}>📈 Combined Statistics</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Efficiency</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>
                      {batchProgress.throughputPerSec ? batchProgress.throughputPerSec.toFixed(2) : '0'} f/s
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Completion</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>
                      {Math.round((batchProgress.totalProcessed / batchProgress.totalFiles) * 100)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Time Elapsed</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>
                      {formatTime(batchState.elapsedMs)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!scanning && batchProgress && (
          <div style={batchProgress.type === 'batch-error' ? styles.error : styles.success}>
            <h4 style={{ marginTop: 0 }}>
              {batchProgress.type === 'batch-error' ? '❌ Batch Failed' : '✅ Batch Completed'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div><strong>Total Processed:</strong> {batchProgress.totalProcessed}</div>
              <div><strong>Total Files:</strong> {batchProgress.totalFiles}</div>
              <div><strong>Elapsed:</strong> {formatTime(batchProgress.elapsedMs)}</div>
              {batchProgress.throughputPerSec !== undefined && (
                <div><strong>Avg Throughput:</strong> {batchProgress.throughputPerSec.toFixed(2)} files/sec</div>
              )}
            </div>
            {batchProgress.error && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fee2e2', borderRadius: '4px', color: '#991b1b' }}>
                <strong>Error:</strong> {batchProgress.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '6px', borderLeft: '4px solid #0284c7' }}>
        <h3 style={{ marginTop: 0 }}>ℹ️ About Batch Scanning</h3>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li><strong>Scanning:</strong> Converts PDFs to images and detects barcodes</li>
          <li><strong>Verification:</strong> Checks for tampering (code mismatches, missing QRs, invalid page counts)</li>
          <li><strong>Routing:</strong> Automatically organizes files into folders based on verification results</li>
          <li><strong>Logging:</strong> Crash-safe batch logs with processing statistics</li>
          <li><strong>Real-time Monitoring:</strong> Live progress events and state polling for accurate tracking</li>
        </ul>
        <p style={{ fontSize: '0.9rem', color: '#0c4a6e', margin: '0.75rem 0 0 0' }}>
          <strong>File Organization:</strong>
        </p>
        <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
          <li><code>tampered/</code> - Files with detected tampering or missing barcodes</li>
          <li><code>scan_passed/</code> - Files that passed all verification checks</li>
          <li><em>(Root directory)</em> - Files with undefined verification status (kept for review/retry)</li>
        </ul>
      </div>
    </div>
  );
};

export default ScannerExample;
