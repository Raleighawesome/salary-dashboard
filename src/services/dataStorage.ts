import Dexie, { type EntityTable } from 'dexie';
import type { ExchangeRate } from './currencyConverter';

// Define the database schema interfaces
export interface EmployeeRecord {
  id?: number;
  employeeId: string;
  email: string;
  name: string;
  country: string;
  currency: string;
  baseSalary: number;
  baseSalaryUSD: number; // Converted to USD for comparison
  comparatio: number;
  timeInRole: number; // months
  performanceRating?: number;
  retentionRisk: number;
  proposedRaise: number;
  newSalary: number;
  percentChange: number;
  businessImpactScore?: number;
  salaryGradeMin?: number;
  salaryGradeMid?: number;
  salaryGradeMax?: number;
  hireDate?: string;
  roleStartDate?: string;
  lastRaiseDate?: string;
}

export interface SessionData {
  id?: number;
  sessionId: string;
  budget: number;
  remainingBudget: number;
  uploadTimestamp: number;
  lastModified: number;
  hasPerformanceData: boolean;
  fileMetadata: {
    salaryFile?: {
      name: string;
      size: number;
      rowCount: number;
      uploadTime: number;
    };
    performanceFile?: {
      name: string;
      size: number;
      rowCount: number;
      uploadTime: number;
    };
  };
  processingOptions: {
    convertCurrencies: boolean;
    currencyApiKey?: string;
    joinStrategy: string;
  };
}

export interface PolicySettings {
  id?: number;
  comparatioFloor: number; // 74%
  maxRaisePercentUS: number; // 12%
  maxRaisePercentIndia: number; // 10%
  noRaiseThresholdMonths: number; // 18 months
  lastUpdated: number;
}

// Cache for currency exchange rates
export interface CurrencyRateCache {
  id?: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: number;
  source: 'api' | 'fallback' | 'cache';
  expiresAt: number;
}

// Cache for file processing results
export interface FileProcessingCache {
  id?: number;
  fileHash: string; // MD5 hash of file content
  fileName: string;
  fileSize: number;
  fileType: 'salary' | 'performance';
  processedData: any; // Parsed and processed data
  processingTime: number;
  createdAt: number;
  lastAccessed: number;
}

// User preferences and settings
export interface UserPreferences {
  id?: number;
  theme: 'light' | 'dark' | 'auto';
  currency: string; // Default display currency
  locale: string; // For number/date formatting
  tablePageSize: number;
  autoSave: boolean;
  showAdvancedFeatures: boolean;
  lastUpdated: number;
}

// Audit log for tracking changes
export interface AuditLog {
  id?: number;
  sessionId: string;
  employeeId?: string;
  action: 'create' | 'update' | 'delete' | 'export' | 'import';
  field?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: number;
  userAgent: string;
}

// Define the database schema
export class RaiseDashboardDB extends Dexie {
  // Define table schemas
  employees!: EntityTable<EmployeeRecord, 'id'>;
  sessions!: EntityTable<SessionData, 'id'>;
  policies!: EntityTable<PolicySettings, 'id'>;
  currencyRates!: EntityTable<CurrencyRateCache, 'id'>;
  fileCache!: EntityTable<FileProcessingCache, 'id'>;
  preferences!: EntityTable<UserPreferences, 'id'>;
  auditLog!: EntityTable<AuditLog, 'id'>;

  constructor() {
    super('RaiseDashboardDB');
    
    // Define schema version 1
    this.version(1).stores({
      employees: '++id, employeeId, email, name, country, currency, baseSalary, comparatio, timeInRole, retentionRisk',
      sessions: '++id, sessionId, budget, uploadTimestamp',
      policies: '++id'
    });

    // Define schema version 2 - Add caching and preferences
    this.version(2).stores({
      employees: '++id, employeeId, email, name, country, currency, baseSalary, comparatio, timeInRole, retentionRisk',
      sessions: '++id, sessionId, budget, uploadTimestamp, lastModified',
      policies: '++id, lastUpdated',
      currencyRates: '++id, fromCurrency, toCurrency, timestamp, expiresAt',
      fileCache: '++id, fileHash, fileName, fileType, createdAt, lastAccessed',
      preferences: '++id',
      auditLog: '++id, sessionId, employeeId, action, timestamp'
    });
  }
}

// Create database instance
export const db = new RaiseDashboardDB();

// Database service functions
export class DataStorageService {
  // Employee data operations
  static async saveEmployees(employees: EmployeeRecord[]): Promise<void> {

    await db.employees.clear(); // Clear existing data for new session
    await db.employees.bulkAdd(employees);
    
    // Log the save operation
    await this.logAudit({
      action: 'import',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: await this.getCurrentSessionId(),
    });
  }

  static async getEmployees(): Promise<EmployeeRecord[]> {
    return await db.employees.toArray();
  }

  static async updateEmployee(employeeId: string, updates: Partial<EmployeeRecord>): Promise<void> {
    // Get current values for audit log
    const currentEmployee = await db.employees.where('employeeId').equals(employeeId).first();
    
    await db.employees.where('employeeId').equals(employeeId).modify(updates);
    
    // Log each field change
    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = currentEmployee ? (currentEmployee as any)[field] : undefined;
      if (oldValue !== newValue) {
        await this.logAudit({
          action: 'update',
          employeeId,
          field,
          oldValue,
          newValue,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          sessionId: await this.getCurrentSessionId(),
        });
      }
    }
  }

  static async getEmployeeById(employeeId: string): Promise<EmployeeRecord | undefined> {
    return await db.employees.where('employeeId').equals(employeeId).first();
  }

  static async searchEmployees(query: string): Promise<EmployeeRecord[]> {
    const lowerQuery = query.toLowerCase();
    return await db.employees
      .filter(emp => 
        emp.name.toLowerCase().includes(lowerQuery) ||
        emp.email.toLowerCase().includes(lowerQuery) ||
        emp.employeeId.toLowerCase().includes(lowerQuery)
      )
      .toArray();
  }

  // Session data operations
  static async saveSession(sessionData: SessionData): Promise<void> {

    await db.sessions.clear(); // Only keep current session
    await db.sessions.add(sessionData);
  }

  static async getCurrentSession(): Promise<SessionData | undefined> {
    return await db.sessions.orderBy('uploadTimestamp').last();
  }

  static async getCurrentSessionId(): Promise<string> {
    const session = await this.getCurrentSession();
    return session?.sessionId || 'unknown';
  }

  static async updateSession(updates: Partial<SessionData>): Promise<void> {
    const session = await this.getCurrentSession();
    if (session?.id) {
      const updatedData = { ...updates, lastModified: Date.now() };
      await db.sessions.update(session.id, updatedData);
    }
  }

  static async updateSessionBudget(budget: number, remainingBudget: number): Promise<void> {
    await this.updateSession({ budget, remainingBudget });
  }

  // Currency rate caching
  static async cacheCurrencyRate(rate: ExchangeRate, cacheDurationMs: number = 3600000): Promise<void> {
    const cacheEntry: CurrencyRateCache = {
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: rate.rate,
      timestamp: rate.timestamp,
      source: rate.source,
      expiresAt: Date.now() + cacheDurationMs,
    };

    // Remove existing rate for this currency pair
    await db.currencyRates
      .where('[fromCurrency+toCurrency]')
      .equals([rate.fromCurrency, rate.toCurrency])
      .delete();

    await db.currencyRates.add(cacheEntry);

  }

  static async getCachedCurrencyRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | null> {
    const cached = await db.currencyRates
      .where('fromCurrency')
      .equals(fromCurrency)
      .and(rate => rate.toCurrency === toCurrency)
      .first();

    if (cached && cached.expiresAt > Date.now()) {
  
      return {
        fromCurrency: cached.fromCurrency,
        toCurrency: cached.toCurrency,
        rate: cached.rate,
        timestamp: cached.timestamp,
        source: 'cache',
      };
    }

    // Clean up expired rate
    if (cached) {
      await db.currencyRates.delete(cached.id!);
    }

    return null;
  }

  static async cleanupExpiredCurrencyRates(): Promise<void> {
    const now = Date.now();
    const deletedCount = await db.currencyRates.where('expiresAt').below(now).delete();
    if (deletedCount > 0) {
  
    }
  }

  // File processing cache
  static async cacheFileProcessing(
    fileHash: string,
    fileName: string,
    fileSize: number,
    fileType: 'salary' | 'performance',
    processedData: any,
    processingTime: number
  ): Promise<void> {
    const cacheEntry: FileProcessingCache = {
      fileHash,
      fileName,
      fileSize,
      fileType,
      processedData,
      processingTime,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    // Remove existing cache for this file hash
    await db.fileCache.where('fileHash').equals(fileHash).delete();
    await db.fileCache.add(cacheEntry);
    

  }

  static async getCachedFileProcessing(fileHash: string): Promise<FileProcessingCache | null> {
    const cached = await db.fileCache.where('fileHash').equals(fileHash).first();
    
    if (cached) {
      // Update last accessed time
      await db.fileCache.update(cached.id!, { lastAccessed: Date.now() });

      return cached;
    }
    
    return null;
  }

  static async cleanupFileCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const deletedCount = await db.fileCache.where('lastAccessed').below(cutoff).delete();
    if (deletedCount > 0) {
  
    }
  }

  // User preferences
  static async saveUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
    const existing = await db.preferences.toCollection().first();
    const updatedPrefs = {
      ...existing,
      ...preferences,
      lastUpdated: Date.now(),
    };

    if (existing?.id) {
      await db.preferences.update(existing.id, updatedPrefs);
    } else {
      await db.preferences.add({
        theme: 'light',
        currency: 'USD',
        locale: 'en-US',
        tablePageSize: 50,
        autoSave: true,
        showAdvancedFeatures: false,
        ...updatedPrefs,
      } as UserPreferences);
    }
  }

  static async getUserPreferences(): Promise<UserPreferences> {
    const prefs = await db.preferences.toCollection().first();
    return prefs || {
      theme: 'light',
      currency: 'USD',
      locale: 'en-US',
      tablePageSize: 50,
      autoSave: true,
      showAdvancedFeatures: false,
      lastUpdated: Date.now(),
    };
  }

  // Audit logging
  static async logAudit(entry: Omit<AuditLog, 'id'>): Promise<void> {
    await db.auditLog.add(entry);
  }

  static async getAuditLog(sessionId?: string, limit: number = 100): Promise<AuditLog[]> {
    let query = db.auditLog.orderBy('timestamp').reverse();
    
    if (sessionId) {
      query = query.filter(log => log.sessionId === sessionId);
    }
    
    return await query.limit(limit).toArray();
  }

  static async getEmployeeAuditLog(employeeId: string): Promise<AuditLog[]> {
    return await db.auditLog
      .where('employeeId')
      .equals(employeeId)
      .reverse()
      .sortBy('timestamp');
  }

  // Policy settings operations
  static async initializePolicySettings(): Promise<void> {
    const existingPolicy = await db.policies.toCollection().first();
    if (!existingPolicy) {
      await db.policies.add({
        comparatioFloor: 76,
        maxRaisePercentUS: 12,
        maxRaisePercentIndia: 10,
        noRaiseThresholdMonths: 18,
        lastUpdated: Date.now(),
      });
    }
  }

  static async getPolicySettings(): Promise<PolicySettings> {
    const policy = await db.policies.toCollection().first();
    return policy || {
      comparatioFloor: 76,
      maxRaisePercentUS: 12,
      maxRaisePercentIndia: 10,
      noRaiseThresholdMonths: 18,
      lastUpdated: Date.now(),
    };
  }

  static async updatePolicySettings(updates: Partial<PolicySettings>): Promise<void> {
    const existing = await db.policies.toCollection().first();
    const updatedPolicy = {
      ...existing,
      ...updates,
      lastUpdated: Date.now(),
    };

    if (existing?.id) {
      await db.policies.update(existing.id, updatedPolicy);
    } else {
      await db.policies.add(updatedPolicy as PolicySettings);
    }
  }

  // Session recovery and data management
  static async hasExistingData(): Promise<boolean> {
    const employeeCount = await db.employees.count();
    const sessionExists = await db.sessions.count() > 0;
    return employeeCount > 0 && sessionExists;
  }

  static async getSessionRecoveryInfo(): Promise<{
    hasData: boolean;
    sessionId?: string;
    employeeCount: number;
    lastModified?: number;
    fileMetadata?: SessionData['fileMetadata'];
  }> {
    const session = await this.getCurrentSession();
    const employeeCount = await db.employees.count();
    
    return {
      hasData: employeeCount > 0 && !!session,
      sessionId: session?.sessionId,
      employeeCount,
      lastModified: session?.lastModified,
      fileMetadata: session?.fileMetadata,
    };
  }

  static async clearAllData(): Promise<void> {

    await Promise.all([
      db.employees.clear(),
      db.sessions.clear(),
      db.auditLog.clear(),
    ]);
  }

  static async resetAllData(): Promise<void> {

    
    // Log the reset action
    await this.logAudit({
      action: 'delete',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: await this.getCurrentSessionId(),
    });
    
    // Clear all data including cache
    await Promise.all([
      db.employees.clear(),
      db.sessions.clear(),
      db.auditLog.clear(),
      db.currencyRates.clear(),
      db.fileCache.clear(),
    ]);
    

  }

  static async clearCache(): Promise<void> {

    await Promise.all([
      db.currencyRates.clear(),
      db.fileCache.clear(),
    ]);
  }

  // Database maintenance
  static async performMaintenance(): Promise<void> {

    
    await Promise.all([
      this.cleanupExpiredCurrencyRates(),
      this.cleanupFileCache(),
      this.cleanupOldAuditLogs(),
    ]);
    

  }

  static async cleanupOldAuditLogs(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const deletedCount = await db.auditLog.where('timestamp').below(cutoff).delete();
    if (deletedCount > 0) {
  
    }
  }

  // Database statistics
  static async getDatabaseStats(): Promise<{
    employees: number;
    sessions: number;
    currencyRates: number;
    fileCache: number;
    auditLogs: number;
    totalSize: string;
  }> {
    const [employees, sessions, currencyRates, fileCache, auditLogs] = await Promise.all([
      db.employees.count(),
      db.sessions.count(),
      db.currencyRates.count(),
      db.fileCache.count(),
      db.auditLog.count(),
    ]);

    // Estimate database size (rough calculation)
    const estimatedSize = (employees * 500) + (sessions * 1000) + (currencyRates * 100) + 
                         (fileCache * 10000) + (auditLogs * 200);
    
    return {
      employees,
      sessions,
      currencyRates,
      fileCache,
      auditLogs,
      totalSize: `${Math.round(estimatedSize / 1024)} KB`,
    };
  }

  // Export/Import functionality
  static async exportData(): Promise<{
    employees: EmployeeRecord[];
    session: SessionData | undefined;
    policies: PolicySettings;
    preferences: UserPreferences;
    exportTimestamp: number;
  }> {
    const [employees, session, policies, preferences] = await Promise.all([
      this.getEmployees(),
      this.getCurrentSession(),
      this.getPolicySettings(),
      this.getUserPreferences(),
    ]);

    return {
      employees,
      session,
      policies,
      preferences,
      exportTimestamp: Date.now(),
    };
  }

  static async importData(data: {
    employees: EmployeeRecord[];
    session?: SessionData;
    policies?: PolicySettings;
    preferences?: UserPreferences;
  }): Promise<void> {

    
    // Clear existing data
    await this.clearAllData();
    
    // Import employees
    if (data.employees.length > 0) {
      await this.saveEmployees(data.employees);
    }
    
    // Import session
    if (data.session) {
      await this.saveSession(data.session);
    }
    
    // Import policies
    if (data.policies) {
      await this.updatePolicySettings(data.policies);
    }
    
    // Import preferences
    if (data.preferences) {
      await this.saveUserPreferences(data.preferences);
    }
    

  }
}

// Initialize policy settings on startup
DataStorageService.initializePolicySettings().catch(console.error); 