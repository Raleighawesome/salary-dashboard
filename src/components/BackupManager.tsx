import React, { useState, useCallback, useRef } from 'react';
import { AutoBackupService, type BackupData } from '../services/autoBackup';
import styles from './BackupManager.module.css';

interface BackupManagerProps {
  onRestoreBackup: (backupData: BackupData) => void;
  className?: string;
}

export const BackupManager: React.FC<BackupManagerProps> = ({
  onRestoreBackup,
  className,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string>('');
  const [showBackupInfo, setShowBackupInfo] = useState(false);
  const [showExportInstructions, setShowExportInstructions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backupInfo = AutoBackupService.getBackupInfo();
  const hasBackup = AutoBackupService.hasBackup();

  // Handle file import
  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError('');

    try {
      const backupData = await AutoBackupService.importBackupFile(file);
      if (backupData) {
        onRestoreBackup(backupData);
        alert(`✅ Backup restored successfully!\n\n${backupData.employees.length} employees imported\nBudget: ${backupData.budget.budgetCurrency} ${backupData.budget.totalBudget.toLocaleString()}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import backup';
      setImportError(errorMessage);
      alert(`❌ ${errorMessage}`);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onRestoreBackup]);

  // Handle restore from storage
  const handleRestoreFromStorage = useCallback(() => {
    const backupData = AutoBackupService.restoreFromStorage();
    if (backupData) {
      onRestoreBackup(backupData);
      alert(`✅ Session restored from backup!\n\n${backupData.employees.length} employees restored\nBudget: ${backupData.budget.budgetCurrency} ${backupData.budget.totalBudget.toLocaleString()}`);
    } else {
      alert('❌ No backup found to restore');
    }
  }, [onRestoreBackup]);

  // Clear backup
  const handleClearBackup = useCallback(() => {
    if (confirm('Are you sure you want to clear the backup? This cannot be undone.')) {
      AutoBackupService.clearBackup();
      alert('🗑️ Backup cleared');
      setShowBackupInfo(false);
    }
  }, []);

  // Trigger file input
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Copy backup content to clipboard
  const handleCopyBackupContent = useCallback(async () => {
    const content = AutoBackupService.exportBackupContent();
    if (!content) {
      alert('❌ No backup content available to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      alert('✅ Backup content copied to clipboard!\n\nYou can now paste this into /public/backup/salary_dashboard_backup.json');
    } catch (error) {
      // Fallback: show content in a textarea for manual copy
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('✅ Backup content copied to clipboard!\n\nYou can now paste this into /public/backup/salary_dashboard_backup.json');
    }
  }, []);

  // Load from public backup
  const handleLoadPublicBackup = useCallback(async () => {
    try {
      const backupData = await AutoBackupService.loadPublicBackup();
      if (backupData) {
        onRestoreBackup(backupData);
        alert(`✅ Public backup loaded successfully!\n\n${backupData.employees.length} employees imported\nBudget: ${backupData.budget.budgetCurrency} ${backupData.budget.totalBudget.toLocaleString()}`);
      } else {
        alert('❌ No public backup file found or file is invalid');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load public backup';
      alert(`❌ ${errorMessage}`);
    }
  }, [onRestoreBackup]);

  return (
    <div className={`${styles.backupManager} ${className || ''}`}>
      <div className={styles.backupHeader}>
        <h3 className={styles.backupTitle}>💾 Data Backup</h3>
        <p className={styles.backupDescription}>
          Automatic backups protect your salary adjustments
        </p>
      </div>

      <div className={styles.backupContent}>
        {/* Backup Status */}
        {hasBackup && backupInfo && (
          <div className={styles.backupStatus}>
            <div className={styles.statusIndicator}>
              <span className={styles.statusIcon}>✅</span>
              <div className={styles.statusInfo}>
                <div className={styles.statusLabel}>Last Backup</div>
                <div className={styles.statusValue}>
                  {new Date(backupInfo.timestamp).toLocaleString()}
                </div>
                <div className={styles.statusDetails}>
                  {backupInfo.employeeCount} employees
                  {backupInfo.hasChanges && <span className={styles.changesIndicator}>• Has changes</span>}
                </div>
              </div>
            </div>
            
            <button
              className={styles.infoButton}
              onClick={() => setShowBackupInfo(!showBackupInfo)}
              title="Toggle backup details"
            >
              {showBackupInfo ? '▼' : '▶'}
            </button>
          </div>
        )}

        {!hasBackup && (
          <div className={styles.noBackup}>
            <span className={styles.statusIcon}>⚠️</span>
            <span>No backup available - make some changes to create one</span>
          </div>
        )}

        {/* Backup Actions */}
        <div className={styles.actions}>
          {hasBackup && (
            <button
              className={styles.restoreButton}
              onClick={handleRestoreFromStorage}
              title="Restore data from automatic backup"
            >
              🔄 Restore from Storage
            </button>
          )}

          <button
            className={styles.importButton}
            onClick={handleLoadPublicBackup}
            title="Load backup from public directory"
          >
            📂 Load Public Backup
          </button>

          <button
            className={styles.importButton}
            onClick={handleImportClick}
            disabled={isImporting}
            title="Import backup file from your computer"
          >
            {isImporting ? '⏳ Importing...' : '📁 Import File'}
          </button>

          {hasBackup && (
            <button
              className={styles.exportButton}
              onClick={() => setShowExportInstructions(!showExportInstructions)}
              title="Show export instructions"
            >
              📤 Export Instructions
            </button>
          )}

          {hasBackup && showBackupInfo && (
            <button
              className={styles.clearButton}
              onClick={handleClearBackup}
              title="Clear backup data"
            >
              🗑️ Clear Backup
            </button>
          )}
        </div>

        {/* Extended Info */}
        {showBackupInfo && hasBackup && backupInfo && (
          <div className={styles.backupDetails}>
            <h4>Backup Details</h4>
            <div className={styles.detailItem}>
              <strong>Created:</strong> {new Date(backupInfo.timestamp).toLocaleString()}
            </div>
            <div className={styles.detailItem}>
              <strong>Employees:</strong> {backupInfo.employeeCount}
            </div>
            <div className={styles.detailItem}>
              <strong>Status:</strong> {backupInfo.hasChanges ? 'Contains salary changes' : 'No changes made yet'}
            </div>
            <div className={styles.detailNote}>
              💡 Backups are created automatically when you modify salaries or raises
            </div>
          </div>
        )}

        {/* Export Instructions */}
        {showExportInstructions && hasBackup && (
          <div className={styles.exportInstructions}>
            <h4>📤 Export to Public Directory</h4>
            <p>To update the backup file in your project's public directory:</p>
            <ol>
              <li>Click "Copy Backup Content" below</li>
              <li>Open <code>/public/backup/salary_dashboard_backup.json</code> in your editor</li>
              <li>Replace the entire file content with the copied JSON</li>
              <li>Save the file</li>
            </ol>
            <div className={styles.copyActions}>
              <button
                className={styles.copyButton}
                onClick={handleCopyBackupContent}
                title="Copy backup JSON to clipboard"
              >
                📋 Copy Backup Content
              </button>
            </div>
            <div className={styles.pathInfo}>
              <strong>File path:</strong> <code>/public/backup/salary_dashboard_backup.json</code>
            </div>
          </div>
        )}

        {/* Error Display */}
        {importError && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>⚠️</span>
            <span>{importError}</span>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default BackupManager;