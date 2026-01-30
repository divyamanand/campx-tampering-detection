import { useState } from "react";
import { LogWriter } from "../LogWriter";

interface UseLogsDirectoryReturn {
  logsDirectory: string | null
  selectLogsDirectory: () => Promise<string>
  clearLogsDirectory: () => void
}

/**
 * useLogsDirectory - Custom hook for managing processing directory selection
 *
 * Single Responsibility: Handle directory selection and logs folder creation
 * Separates directory management from processing logic (SRP)
 *
 * @returns {Object} Object containing:
 *   - logsDirectory: Current directory path
 *   - selectLogsDirectory: Function to select directory and create logs folder
 *   - clearLogsDirectory: Function to clear the selected directory
 */
export const useLogsDirectory = (): UseLogsDirectoryReturn => {
  const [logsDirectory, setLogsDirectory] = useState<string | null>(null);

  /**
   * Select processing directory and create logs folder
   * Opens a directory picker dialog and creates /logs subdirectory
   */
  const selectLogsDirectory = async (): Promise<string> => {
    try {
      const dirPath = await LogWriter.selectLogsDirectory();
      await LogWriter.createLogsFolder(dirPath);
      setLogsDirectory(dirPath);
      return dirPath;
    } catch (error) {
      console.error("Error selecting directory:", error);
      throw error;
    }
  };

  /**
   * Clear the currently selected directory
   */
  const clearLogsDirectory = () => {
    setLogsDirectory(null);
  };

  return {
    logsDirectory,
    selectLogsDirectory,
    clearLogsDirectory,
  };
};
