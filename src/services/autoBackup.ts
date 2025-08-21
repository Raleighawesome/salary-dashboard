// autoBackup.ts - Automatic backup service for employee data
import type { Employee } from '../types/employee';

export interface BackupData {
  employees: Employee[];
  budget: {
    totalBudget: number;
    budgetCurrency: string;
  };
  metadata: {
    timestamp: string;
    version: string;
    employeeCount: number;
    hasChanges: boolean;
  };
}

export class AutoBackupService {
  private static readonly BACKUP_KEY = 'salary_dashboard_backup';
  private static readonly BACKUP_FILENAME = '/backup/salary_dashboard_backup.json';
  private static backupTimeout: NodeJS.Timeout | null = null;
  private static lastBackupHash: string = '';

  /**
   * Create a backup of current employee data
   */
  static async createBackup(
    employees: Employee[], 
    totalBudget: number = 0, 
    budgetCurrency: string = 'USD'
  ): Promise<void> {
    try {
      const backupData: BackupData = {
        employees: employees.map(emp => ({
          ...emp,
          // Ensure we capture all current values including any edits
          ...(emp as any).lastModified ? {} : { lastModified: new Date().toISOString() },
        })),
        budget: {
          totalBudget,
          budgetCurrency,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          employeeCount: employees.length,
          hasChanges: this.hasDataChanged(employees),
        },
      };

      // Create hash to avoid unnecessary backups
      const currentHash = this.createDataHash(backupData);
      if (currentHash === this.lastBackupHash) {
  
        return;
      }

      // Store in localStorage for session recovery
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify(backupData));
      
      // Update backup file in public directory
      await this.updatePublicBackupFile(backupData);
      
      this.lastBackupHash = currentHash;
  
      
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
    }
  }

  /**
   * Debounced backup - delays backup for a few seconds to avoid too many saves
   */
  static scheduleBackup(
    employees: Employee[], 
    totalBudget: number = 0, 
    budgetCurrency: string = 'USD',
    delayMs: number = 3000
  ): void {
    // Clear existing timeout
    if (this.backupTimeout) {
      clearTimeout(this.backupTimeout);
    }

    // Schedule new backup
    this.backupTimeout = setTimeout(() => {
      this.createBackup(employees, totalBudget, budgetCurrency);
    }, delayMs);


  }

  /**
   * Update backup file in public directory
   * NOTE: This method is disabled to prevent unwanted download dialogs.
   * Backups are only stored in localStorage for session recovery.
   * Users can manually export backups via the BackupManager component.
   */
  private static async updatePublicBackupFile(backupData: BackupData): Promise<void> {
    try {
      // DISABLED: Automatic file system access to prevent unwanted download dialogs
      // The File System Access API was causing save dialogs to appear every time
      // a salary proposal was made, which is disruptive to the user experience.
      
      // Only use the non-intrusive fallback method that doesn't trigger downloads
      await this.saveBackupForManualUpdate(backupData);
      
    } catch (error) {
      console.error('❌ Public backup file update failed:', error);
      // Fallback to localStorage only - this is actually preferred behavior
    }
  }

  /**
   * Save using File System Access API (Chrome/Edge)
   * NOTE: This method is no longer called automatically to prevent unwanted download dialogs.
   * It can be used manually by the BackupManager component when user explicitly requests export.
   */
  private static async saveWithFileSystemAPI(backupData: BackupData): Promise<void> {
    try {
      // Note: This requires user permission and only works in secure contexts
      // This method shows a save dialog, so it should only be called when user explicitly requests it
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: 'salary_dashboard_backup.json',
        types: [{
          description: 'JSON files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(backupData, null, 2));
      await writable.close();
      
      console.log('✅ Backup file saved successfully via File System Access API');

    } catch (error) {
      console.error('❌ File System Access API save failed:', error);
      throw error;
    }
  }

  /**
   * Save backup in a way that can be manually copied to public directory
   */
  private static async saveBackupForManualUpdate(backupData: BackupData): Promise<void> {
    // Store the backup data in a format that can be easily retrieved
    const backupContent = JSON.stringify(backupData, null, 2);
    
    // Create a hidden element with the backup content for easy copying
    const backupElement = document.getElementById('backup-content') || document.createElement('div');
    backupElement.id = 'backup-content';
    backupElement.style.display = 'none';
    backupElement.setAttribute('data-backup', backupContent);
    
    if (!document.getElementById('backup-content')) {
      document.body.appendChild(backupElement);
    }
    
    // Also make it available via a global variable for easy access
    (window as any).salaryDashboardBackup = backupData;
    

  }

  /**
   * Restore data from localStorage backup
   */
  static restoreFromStorage(): BackupData | null {
    try {
      const backupStr = localStorage.getItem(this.BACKUP_KEY);
      if (!backupStr) {
  
        return null;
      }

      const backupData: BackupData = JSON.parse(backupStr);
  
      return backupData;
      
    } catch (error) {
      console.error('❌ Backup restoration from storage failed:', error);
      return null;
    }
  }

  /**
   * Import backup from uploaded file
   */
  static async importBackupFile(file: File): Promise<BackupData | null> {
    try {
      const fileContent = await file.text();
      const backupData: BackupData = JSON.parse(fileContent);
      
      // Validate backup structure
      if (!this.validateBackupData(backupData)) {
        throw new Error('Invalid backup file format');
      }

      // Store in localStorage for session recovery
      localStorage.setItem(this.BACKUP_KEY, JSON.stringify(backupData));
      
  
      return backupData;
      
    } catch (error) {
      console.error('❌ Backup file import failed:', error);
      throw new Error(`Failed to import backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load backup from public directory
   */
  static async loadPublicBackup(): Promise<BackupData | null> {
    try {
      const response = await fetch(this.BACKUP_FILENAME);
      if (!response.ok) {
  
        return null;
      }
      
      const backupData: BackupData = await response.json();
      
      // Validate backup structure
      if (!this.validateBackupData(backupData)) {
        throw new Error('Invalid public backup file format');
      }
      
  
      return backupData;
      
    } catch (error) {
      console.error('❌ Failed to load public backup:', error);
      return null;
    }
  }

  /**
   * Export current backup content for manual file update
   */
  static exportBackupContent(): string | null {
    const backupStr = localStorage.getItem(this.BACKUP_KEY);
    if (!backupStr) return null;
    
    try {
      const backupData = JSON.parse(backupStr);
      return JSON.stringify(backupData, null, 2);
    } catch {
      return null;
    }
  }

  /**
   * Check if backup exists
   */
  static hasBackup(): boolean {
    return localStorage.getItem(this.BACKUP_KEY) !== null;
  }

  /**
   * Clear backup data
   */
  static clearBackup(): void {
    localStorage.removeItem(this.BACKUP_KEY);
    this.lastBackupHash = '';

  }

  /**
   * Reset all backup data and timers
   */
  static resetAllBackups(): void {
    // Clear any pending backup timeouts
    if (this.backupTimeout) {
      clearTimeout(this.backupTimeout);
      this.backupTimeout = null;
    }

    // Clear backup storage
    localStorage.removeItem(this.BACKUP_KEY);
    this.lastBackupHash = '';

    // Clear the global backup variable
    if ((window as any).salaryDashboardBackup) {
      delete (window as any).salaryDashboardBackup;
    }

    // Remove backup content element
    const backupElement = document.getElementById('backup-content');
    if (backupElement) {
      backupElement.remove();
    }


  }

  /**
   * Get backup info without loading full data
   */
  static getBackupInfo(): { timestamp: string; employeeCount: number; hasChanges: boolean } | null {
    try {
      const backupStr = localStorage.getItem(this.BACKUP_KEY);
      if (!backupStr) return null;

      const backupData: BackupData = JSON.parse(backupStr);
      return {
        timestamp: backupData.metadata.timestamp,
        employeeCount: backupData.metadata.employeeCount,
        hasChanges: backupData.metadata.hasChanges,
      };
    } catch {
      return null;
    }
  }

  /**
   * Validate backup data structure
   */
  private static validateBackupData(data: any): data is BackupData {
    return (
      data &&
      Array.isArray(data.employees) &&
      data.budget &&
      typeof data.budget.totalBudget === 'number' &&
      typeof data.budget.budgetCurrency === 'string' &&
      data.metadata &&
      typeof data.metadata.timestamp === 'string' &&
      typeof data.metadata.employeeCount === 'number'
    );
  }

  /**
   * Create hash of data for change detection
   */
  private static createDataHash(data: BackupData): string {
    const hashData = {
      employees: data.employees.map(emp => ({
        id: emp.employeeId,
        salary: emp.baseSalaryUSD,
        raise: emp.proposedRaise,
      })),
      budget: data.budget,
    };
    return btoa(JSON.stringify(hashData));
  }

  /**
   * Check if data has meaningful changes
   */
  private static hasDataChanged(employees: Employee[]): boolean {
    return employees.some(emp => 
      (emp.proposedRaise && emp.proposedRaise > 0) ||
      (emp as any).lastModified // If we're tracking modifications
    );
  }
}

export default AutoBackupService;