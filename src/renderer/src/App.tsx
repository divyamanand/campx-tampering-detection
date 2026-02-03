import React, { useEffect, useState } from 'react'
import { ScannerExample } from './components/ScannerExample'
import { SettingsPanel } from './components/SettingsPanel'
import { settingsService } from './services/SettingsService'

type AppView = 'loading' | 'error' | 'settings' | 'scanner'

/**
 * App Component - Main application entry point
 *
 * Manages the application flow:
 * 1. Loading → Show loading state while fetching settings
 * 2. Error → Show error message if initialization fails
 * 3. Settings → Show SettingsPanel for user to configure/review settings
 * 4. Scanner → Show ScannerExample for PDF scanning
 */
const App = () => {
  const [view, setView] = useState<AppView>('loading')
  const [error, setError] = useState<string | null>(null)

  // Load global settings on app mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load settings from global service
        const appSettings = await settingsService.getSettings()
        // Always show settings panel first for user to review/configure
        setView('settings')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load settings'
        setError(errorMessage)
        console.error('Failed to initialize app settings:', err)
        setView('error')
      }
    }

    initializeApp()
  }, [])

  // Handle settings confirmation - move to scanner view
  const handleSettingsConfirmed = () => {
    setView('scanner')
  }

  // Render based on current view
  if (view === 'loading') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '1rem',
        color: '#666',
      }}>
        Loading application settings...
      </div>
    )
  }

  if (view === 'error') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '2rem',
      }}>
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '2rem',
          maxWidth: '500px',
          color: '#dc2626',
        }}>
          <h2 style={{ marginTop: 0 }}>Failed to Initialize Application</h2>
          <p>{error}</p>
          <p style={{ fontSize: '0.9rem', color: '#991b1b' }}>
            Please check the console for more details.
          </p>
        </div>
      </div>
    )
  }

  if (view === 'settings') {
    return <SettingsPanel onSettingsConfirmed={handleSettingsConfirmed} />
  }

  // Default: scanner view
  return <ScannerExample />
}

export default App