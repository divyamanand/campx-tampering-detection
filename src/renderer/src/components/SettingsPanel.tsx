import React, { useEffect, useState } from 'react';
import { settingsService, type AppSettings } from '../services/SettingsService';

interface SettingsPanelProps {
  onSettingsConfirmed?: () => void;
}

/**
 * SettingsPanel Component
 *
 * Displays and manages global application settings.
 * Allows users to configure:
 * - Working directory (for PDFs and logs)
 * - Initial scale for PDF rendering
 * - Rotation settings
 * - Polling interval
 *
 * Changes are saved immediately to global settings.
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onSettingsConfirmed }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const appSettings = await settingsService.getSettings();
        setSettings(appSettings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Handle directory selection
  const handleSelectDirectory = async () => {
    try {
      const selected = await window.electronAPI.selectDirectory();
      if (selected && settings) {
        await updateSetting('directory', selected);
        setSuccessMessage('✓ Directory updated');
        setTimeout(() => setSuccessMessage(null), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select directory');
    }
  };

  // Update a single setting
  const updateSetting = async (key: keyof AppSettings, value: unknown) => {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await settingsService.updateSetting(key, value as any);
      setSettings(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleResetToDefaults = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      setSaving(true);
      try {
        const defaults = await settingsService.resetSettings();
        setSettings(defaults);
        setSuccessMessage('✓ Settings reset to defaults');
        setTimeout(() => setSuccessMessage(null), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reset settings');
      } finally {
        setSaving(false);
      }
    }
  };

  const styles = {
    container: {
      maxWidth: '800px',
      margin: '2rem auto',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    } as React.CSSProperties,
    header: {
      marginBottom: '2rem',
      borderBottom: '2px solid #e5e7eb',
      paddingBottom: '1rem',
    } as React.CSSProperties,
    title: {
      fontSize: '2rem',
      fontWeight: 700,
      color: '#111827',
      margin: '0 0 0.5rem 0',
    } as React.CSSProperties,
    subtitle: {
      fontSize: '0.95rem',
      color: '#6b7280',
      margin: 0,
    } as React.CSSProperties,
    section: {
      marginBottom: '2rem',
      padding: '1.5rem',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
    } as React.CSSProperties,
    sectionTitle: {
      fontSize: '1.1rem',
      fontWeight: 600,
      color: '#1f2937',
      marginTop: 0,
      marginBottom: '1rem',
    } as React.CSSProperties,
    formGroup: {
      marginBottom: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    } as React.CSSProperties,
    label: {
      fontWeight: 600,
      color: '#374151',
      fontSize: '0.95rem',
    } as React.CSSProperties,
    labelDescription: {
      fontSize: '0.85rem',
      color: '#6b7280',
      fontWeight: 400,
      marginTop: '0.25rem',
    } as React.CSSProperties,
    input: {
      padding: '0.75rem',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '0.95rem',
      fontFamily: 'monospace',
    } as React.CSSProperties,
    inputNumber: {
      padding: '0.75rem',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '0.95rem',
      maxWidth: '200px',
    } as React.CSSProperties,
    dirPathDisplay: {
      padding: '0.75rem',
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '0.9rem',
      fontFamily: 'monospace',
      wordBreak: 'break-all',
      minHeight: '2.5rem',
      display: 'flex',
      alignItems: 'center',
    } as React.CSSProperties,
    dirPathEmpty: {
      color: '#9ca3af',
      fontStyle: 'italic',
    } as React.CSSProperties,
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
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
    } as React.CSSProperties,
    buttonSecondary: {
      backgroundColor: '#6b7280',
    } as React.CSSProperties,
    buttonDanger: {
      backgroundColor: '#ef4444',
    } as React.CSSProperties,
    buttonDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    } as React.CSSProperties,
    checkboxContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    } as React.CSSProperties,
    checkbox: {
      width: '20px',
      height: '20px',
      cursor: 'pointer',
    } as React.CSSProperties,
    checkboxLabel: {
      fontWeight: 600,
      color: '#374151',
      cursor: 'pointer',
    } as React.CSSProperties,
    messageBox: {
      padding: '1rem',
      borderRadius: '6px',
      marginBottom: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    } as React.CSSProperties,
    successMessage: {
      backgroundColor: '#f0fdf4',
      border: '1px solid #bbf7d0',
      color: '#166534',
    } as React.CSSProperties,
    errorMessage: {
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#dc2626',
    } as React.CSSProperties,
    footer: {
      marginTop: '2rem',
      padding: '1.5rem',
      borderTop: '2px solid #e5e7eb',
      display: 'flex',
      gap: '1rem',
      justifyContent: 'space-between',
      alignItems: 'center',
    } as React.CSSProperties,
    infoBox: {
      padding: '1rem',
      backgroundColor: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: '6px',
      color: '#1e40af',
      fontSize: '0.9rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Settings</h1>
        </div>
        <div style={{ ...styles.messageBox, ...styles.successMessage }}>
          Loading settings...
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Settings</h1>
        </div>
        <div style={{ ...styles.messageBox, ...styles.errorMessage }}>
          Failed to load settings
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>⚙️ Application Settings</h1>
        <p style={styles.subtitle}>Configure your PDF scanning preferences</p>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ ...styles.messageBox, ...styles.errorMessage }}>
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div style={{ ...styles.messageBox, ...styles.successMessage }}>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Info Box */}
      <div style={styles.infoBox}>
        <strong>💡 Tip:</strong> Configure these settings once, and they'll be used for all PDF scans. Settings are saved automatically.
      </div>

      {/* Directory Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>📁 Working Directory</h2>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Directory for PDF files and logs
            <div style={styles.labelDescription}>
              This directory will be used to store logs.json with scan results
            </div>
          </label>
          <div style={styles.dirPathDisplay}>
            {settings.directory ? (
              <span>{settings.directory}</span>
            ) : (
              <span style={styles.dirPathEmpty}>No directory selected</span>
            )}
          </div>
          <button
            onClick={handleSelectDirectory}
            disabled={saving}
            style={{
              ...styles.button,
              width: 'fit-content',
              ...(saving ? styles.buttonDisabled : {}),
            }}
          >
            📂 Browse Directory
          </button>
        </div>
      </div>

      {/* PDF Processing Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>🖼️ PDF Processing</h2>

        {/* Initial Scale */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Initial Scale
            <div style={styles.labelDescription}>
              Higher values = better quality but slower processing (1-5)
            </div>
          </label>
          <input
            type="number"
            min="1"
            max="5"
            value={settings.initialScale}
            onChange={(e) => updateSetting('initialScale', parseInt(e.target.value))}
            disabled={saving}
            style={{
              ...styles.inputNumber,
              ...(saving ? { opacity: 0.6 } : {}),
            }}
          />
          <div style={styles.labelDescription}>
            Current: {settings.initialScale}x (higher = better quality)
          </div>
        </div>

        {/* Rotation */}
        <div style={styles.formGroup}>
          <div style={styles.checkboxContainer}>
            <input
              type="checkbox"
              id="enableRotation"
              checked={settings.enableRotation}
              onChange={(e) => updateSetting('enableRotation', e.target.checked)}
              disabled={saving}
              style={styles.checkbox}
            />
            <label htmlFor="enableRotation" style={styles.checkboxLabel}>
              Enable Rotation Attempts
            </label>
          </div>
          <div style={styles.labelDescription}>
            Try rotating images to improve barcode/QR code detection
          </div>
        </div>

        {/* Rotation Degrees */}
        {settings.enableRotation && (
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Rotation Degrees
              <div style={styles.labelDescription}>
                Angle to rotate images for detection (0-360°)
              </div>
            </label>
            <input
              type="number"
              min="0"
              max="360"
              value={settings.rotationDegrees}
              onChange={(e) => updateSetting('rotationDegrees', parseInt(e.target.value))}
              disabled={saving}
              style={{
                ...styles.inputNumber,
                ...(saving ? { opacity: 0.6 } : {}),
              }}
            />
            <div style={styles.labelDescription}>
              Current: {settings.rotationDegrees}°
            </div>
          </div>
        )}
      </div>

      {/* Advanced Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>⚡ Advanced</h2>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            Polling Interval (ms)
            <div style={styles.labelDescription}>
              How often to check for file changes (milliseconds)
            </div>
          </label>
          <input
            type="number"
            min="100"
            max="60000"
            step="500"
            value={settings.pollingInterval}
            onChange={(e) => updateSetting('pollingInterval', parseInt(e.target.value))}
            disabled={saving}
            style={{
              ...styles.inputNumber,
              ...(saving ? { opacity: 0.6 } : {}),
            }}
          />
          <div style={styles.labelDescription}>
            Current: {settings.pollingInterval}ms
          </div>
        </div>
      </div>

      {/* Settings Summary */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>📋 Current Settings Summary</h2>
        <div style={{ fontSize: '0.9rem', color: '#374151', lineHeight: '1.8' }}>
          <div>
            <strong>Directory:</strong> {settings.directory || '(not set)'}
          </div>
          <div>
            <strong>Initial Scale:</strong> {settings.initialScale}x
          </div>
          <div>
            <strong>Rotation:</strong> {settings.enableRotation ? `Enabled (${settings.rotationDegrees}°)` : 'Disabled'}
          </div>
          <div>
            <strong>Polling Interval:</strong> {settings.pollingInterval}ms
          </div>
        </div>
      </div>

      {/* Footer with Actions */}
      <div style={styles.footer}>
        <button
          onClick={handleResetToDefaults}
          disabled={saving}
          style={{
            ...styles.button,
            ...styles.buttonDanger,
            ...(saving ? styles.buttonDisabled : {}),
          }}
        >
          Reset to Defaults
        </button>

        <button
          onClick={onSettingsConfirmed}
          disabled={saving || !settings.directory}
          style={{
            ...styles.button,
            ...(saving || !settings.directory ? styles.buttonDisabled : {}),
          }}
        >
          {saving ? 'Saving...' : 'Continue to Scanner →'}
        </button>
      </div>

      {!settings.directory && (
        <div style={styles.infoBox}>
          ℹ️ <strong>Note:</strong> Please select a working directory before proceeding to the scanner.
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
