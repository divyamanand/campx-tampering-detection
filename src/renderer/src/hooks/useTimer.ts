import { useState, useEffect } from 'react';

interface UseTimerOptions {
  /**
   * Whether the timer is active
   */
  isRunning: boolean;
  /**
   * Optional callback when timer updates
   */
  onTick?: (elapsedMs: number) => void;
  /**
   * Reset timer automatically when status changes
   */
  autoReset?: boolean;
}

interface UseTimerResult {
  /**
   * Elapsed time in milliseconds
   */
  elapsedMs: number;
  /**
   * Formatted time string (HH:MM:SS)
   */
  formattedTime: string;
  /**
   * Start the timer
   */
  start: () => void;
  /**
   * Stop the timer
   */
  stop: () => void;
  /**
   * Reset the timer to 0
   */
  reset: () => void;
}

/**
 * useTimer Hook - Simple elapsed time tracker
 *
 * Tracks elapsed time while scanning is in progress
 * Provides formatted output for display
 *
 * @param options Configuration options
 * @returns Timer state and control methods
 */
export const useTimer = (options: UseTimerOptions): UseTimerResult => {
  const { isRunning, onTick, autoReset = true } = options;
  const [elapsedMs, setElapsedMs] = useState(0);

  // Handle auto-reset when isRunning changes from true to false
  useEffect(() => {
    if (!isRunning && autoReset) {
      setElapsedMs(0);
    }
  }, [isRunning, autoReset]);

  // Main timer interval
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedMs((prev) => {
        const newTime = prev + 100;
        onTick?.(newTime);
        return newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, onTick]);

  /**
   * Format milliseconds to HH:MM:SS
   */
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  return {
    elapsedMs,
    formattedTime: formatTime(elapsedMs),
    start: () => setElapsedMs(0),
    stop: () => {
      // Timer stops automatically when isRunning becomes false
    },
    reset: () => setElapsedMs(0),
  };
};
