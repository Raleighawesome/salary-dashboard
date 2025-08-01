// Core employee data interfaces
export interface Employee {
  employeeId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  country: string;
  currency: string;
  baseSalary: number;
  baseSalaryUSD: number; // Converted for comparison
  comparatio: number;
  timeInRole: number; // in months
  performanceRating?: number | string; // Optional, from performance sheet
  retentionRisk: number; // Calculated risk score
  proposedRaise: number;
  newSalary: number;
  percentChange: number;
  businessImpactScore?: number; // Manager input
  salaryGradeMin?: number;
  salaryGradeMid?: number;
  salaryGradeMax?: number;
  hireDate?: string;
  roleStartDate?: string;
  lastRaiseDate?: string;
  departmentCode?: string;
  jobTitle?: string;
  managerId?: string;
  managerName?: string;
  futuretalent?: string;
  movementReadiness?: string;
  proposedTalentActions?: string;
}

// Raw data from uploaded CSV files
export interface SalarySheetRow {
  employeeId?: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  currency?: string;
  baseSalary?: number;
  comparatio?: number;
  salaryGradeMin?: number;
  salaryGradeMid?: number;
  salaryGradeMax?: number;
  timeInRole?: number;
  hireDate?: string;
  roleStartDate?: string;
  lastRaiseDate?: string;
  departmentCode?: string;
  jobTitle?: string;
  managerId?: string;
  managerName?: string;
  gradeLevel?: string;
}

export interface PerformanceSheetRow {
  employeeId?: string;
  email?: string;
  name?: string;
  performanceRating?: number | string;
  businessImpactScore?: number;
  retentionRisk?: number;
  futuretalent?: string;
  movementReadiness?: string;
  proposedTalentActions?: string;
}

// Policy violation types
export interface PolicyViolation {
  type: 'COMPARATIO_TOO_LOW' | 'RAISE_TOO_HIGH' | 'NO_RAISE_TOO_LONG' | 'BUDGET_EXCEEDED';
  severity: 'WARNING' | 'ERROR';
  message: string;
  employeeId?: string;
  currentValue?: number;
  threshold?: number;
}

// Dashboard metrics
export interface DashboardMetrics {
  totalEmployees: number;
  averageComparatio: number;
  totalProposedRaises: number;
  budgetUtilization: number;
  policyViolations: PolicyViolation[];
  employeesWithoutRaises: number;
  employeesAtRisk: number;
}

// Heat map data structure
export interface HeatMapData {
  comparatioDistribution: { range: string; count: number; percentage: number }[];
  performanceDistribution: { rating: number; count: number; percentage: number }[];
  tenureDistribution: { range: string; count: number; percentage: number }[];
  retentionRiskDistribution: { risk: string; count: number; percentage: number }[];
}

// File upload types
export interface FileUploadResult {
  fileName: string;
  fileType: 'salary' | 'performance' | 'unknown';
  rowCount: number;
  validRows: number;
  errors: string[];
  data: SalarySheetRow[] | PerformanceSheetRow[];
}

// Currency conversion
export interface CurrencyRate {
  code: string;
  rate: number; // Rate to USD
  lastUpdated: number;
}

export interface CurrencyConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  lastUpdated: number;
}

// Table sorting and filtering
export interface TableSort {
  column: keyof Employee;
  direction: 'asc' | 'desc';
}

export interface TableFilter {
  column: keyof Employee;
  value: string | number;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
}

// Export configuration
export interface ExportConfig {
  includeColumns: Array<keyof Employee>;
  fileName: string;
  format: 'csv' | 'xlsx';
}

// Session and budget management
export interface BudgetAllocation {
  totalBudget: number;
  allocatedAmount: number;
  remainingAmount: number;
  employeeCount: number;
  averageRaisePercent: number;
}

// Chart data types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TrendData {
  employeeId: string;
  salaryHistory: Array<{
    date: string;
    salary: number;
    comparatio: number;
  }>;
  performanceHistory: Array<{
    date: string;
    rating: number;
  }>;
}

// Validation results
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  employeeId?: string;
} 