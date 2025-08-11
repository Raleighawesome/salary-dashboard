// Temporary field storage service for tracking unsaved field changes

interface TempFieldChange {
  employeeId: string;
  field: string;
  value: any;
  timestamp: number;
  originalValue?: any;
}

export class TempFieldStorageService {
  private static readonly TEMP_STORAGE_KEY = 'salary_dashboard_temp_changes';
  private static readonly MAX_TEMP_AGE = 5 * 60 * 1000; // 5 minutes
  private static backupTimeout: NodeJS.Timeout | null = null;

  /**
   * Store a temporary field change
   */
  static storeTempChange(
    employeeId: string, 
    field: string, 
    value: any, 
    originalValue?: any
  ): void {
    try {
      const changes = this.getTempChanges();
      
      // Update or add the change
      const existingIndex = changes.findIndex(c => 
        c.employeeId === employeeId && c.field === field
      );
      
      const change: TempFieldChange = {
        employeeId,
        field,
        value,
        timestamp: Date.now(),
        originalValue: originalValue !== undefined ? originalValue : 
          (existingIndex >= 0 ? changes[existingIndex].originalValue : undefined)
      };
      
      if (existingIndex >= 0) {
        changes[existingIndex] = change;
      } else {
        changes.push(change);
      }
      
      // Store updated changes
      localStorage.setItem(this.TEMP_STORAGE_KEY, JSON.stringify(changes));
      
      // Schedule a backup to ensure these changes are captured
      this.scheduleBackupForTempChanges();
      
    } catch (error) {
      console.error('❌ Failed to store temp change:', error);
    }
  }

  /**
   * Get all temporary changes
   */
  static getTempChanges(): TempFieldChange[] {
    try {
      const stored = localStorage.getItem(this.TEMP_STORAGE_KEY);
      if (!stored) return [];
      
      const changes: TempFieldChange[] = JSON.parse(stored);
      
      // Filter out expired changes
      const now = Date.now();
      const validChanges = changes.filter(c => 
        (now - c.timestamp) < this.MAX_TEMP_AGE
      );
      
      // Update storage if we filtered out expired changes
      if (validChanges.length !== changes.length) {
        localStorage.setItem(this.TEMP_STORAGE_KEY, JSON.stringify(validChanges));
      }
      
      return validChanges;
    } catch (error) {
      console.error('❌ Failed to get temp changes:', error);
      return [];
    }
  }

  /**
   * Get temporary changes for a specific employee
   */
  static getTempChangesForEmployee(employeeId: string): TempFieldChange[] {
    return this.getTempChanges().filter(c => c.employeeId === employeeId);
  }

  /**
   * Apply temporary changes to an employee object
   */
  static applyTempChangesToEmployee(employee: any): any {
    const tempChanges = this.getTempChangesForEmployee(employee.employeeId);
    if (tempChanges.length === 0) return employee;
    
    const updatedEmployee = { ...employee };
    
    tempChanges.forEach(change => {
      // Apply the temporary value
      updatedEmployee[change.field] = change.value;
      
      // Mark as having unsaved changes
      updatedEmployee.hasUnsavedChanges = true;
      updatedEmployee.lastTempChange = change.timestamp;
    });
    
    return updatedEmployee;
  }

  /**
   * Remove temporary changes for a specific employee and field
   */
  static removeTempChange(employeeId: string, field: string): void {
    try {
      const changes = this.getTempChanges();
      const filteredChanges = changes.filter(c => 
        !(c.employeeId === employeeId && c.field === field)
      );
      
      localStorage.setItem(this.TEMP_STORAGE_KEY, JSON.stringify(filteredChanges));
    } catch (error) {
      console.error('❌ Failed to remove temp change:', error);
    }
  }

  /**
   * Remove all temporary changes for an employee (after save)
   */
  static removeTempChangesForEmployee(employeeId: string): void {
    try {
      const changes = this.getTempChanges();
      const filteredChanges = changes.filter(c => c.employeeId !== employeeId);
      
      localStorage.setItem(this.TEMP_STORAGE_KEY, JSON.stringify(filteredChanges));
    } catch (error) {
      console.error('❌ Failed to remove temp changes for employee:', error);
    }
  }

  /**
   * Clear all temporary changes
   */
  static clearAllTempChanges(): void {
    try {
      localStorage.removeItem(this.TEMP_STORAGE_KEY);
      
      // Clear any scheduled backup
      if (this.backupTimeout) {
        clearTimeout(this.backupTimeout);
        this.backupTimeout = null;
      }
    } catch (error) {
      console.error('❌ Failed to clear temp changes:', error);
    }
  }

  /**
   * Get summary of unsaved changes
   */
  static getUnsavedChangesSummary(): {
    totalChanges: number;
    employeesWithChanges: number;
    oldestChange: number | null;
  } {
    const changes = this.getTempChanges();
    const uniqueEmployees = new Set(changes.map(c => c.employeeId));
    
    return {
      totalChanges: changes.length,
      employeesWithChanges: uniqueEmployees.size,
      oldestChange: changes.length > 0 ? Math.min(...changes.map(c => c.timestamp)) : null
    };
  }

  /**
   * Schedule a backup that includes temporary changes
   */
  private static scheduleBackupForTempChanges(): void {
    // Clear existing timeout
    if (this.backupTimeout) {
      clearTimeout(this.backupTimeout);
    }

    // Schedule backup in 1 second to capture temp changes
    this.backupTimeout = setTimeout(() => {
      // This will be handled by the existing backup system
      // We just need to make sure it's triggered
      const event = new CustomEvent('tempFieldChanged', {
        detail: { 
          hasTempChanges: this.getTempChanges().length > 0 
        }
      });
      window.dispatchEvent(event);
    }, 1000);
  }

  /**
   * Check if there are any unsaved changes
   */
  static hasUnsavedChanges(): boolean {
    return this.getTempChanges().length > 0;
  }

  /**
   * Get field value (temp if exists, otherwise original)
   */
  static getFieldValue(employeeId: string, field: string, originalValue: any): any {
    const changes = this.getTempChanges();
    const tempChange = changes.find(c => 
      c.employeeId === employeeId && c.field === field
    );
    
    return tempChange ? tempChange.value : originalValue;
  }

  /**
   * Restore temporary changes on app load
   */
  static restoreTempChanges(): TempFieldChange[] {
    const changes = this.getTempChanges();
    
    if (changes.length > 0) {
      console.log(`📝 Restored ${changes.length} temporary field changes`);
    }
    
    return changes;
  }
}

export default TempFieldStorageService;