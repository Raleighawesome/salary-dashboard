import type { Employee, PolicyViolation } from '../types/employee';
import { PolicyValidator } from '../utils/policyValidation';

// Export configuration interface
export interface ExportConfig {
  includeOriginalData: boolean;
  includeCalculatedFields: boolean;
  includePolicyViolations: boolean;
  includeMetadata: boolean;
  customColumnOrder?: string[];
  filterCriteria?: {
    minRaiseAmount?: number;
    maxRaiseAmount?: number;
    countries?: string[];
    departmentCodes?: string[];
    onlyWithRaises?: boolean;
  };
}

// Export result interface
export interface ExportResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  totalRaiseAmount: number;
  policyViolations: PolicyViolation[];
  exportTimestamp: number;
  downloadUrl?: string;
  error?: string;
}

// Default column order for leadership review
const DEFAULT_COLUMN_ORDER = [
  // Employee identification
  'employeeId',
  'name',
  'email',
  'departmentCode',
  'jobTitle',
  'managerId',
  'country',
  
  // Current compensation
  'baseSalaryUSD',
  'baseSalary',
  'currency',
  'salaryGrade',
  'comparatio',
  
  // Proposed changes
  'proposedRaise',
  'newSalary',
  'percentChange',
  'effectiveDate',
  
  // Performance and risk factors
  'performanceRating',
  'businessImpactScore',
  'retentionRisk',
  'timeInRole',
  'totalTenure',
  
  // Dates and tenure
  'hireDate',
  'roleStartDate',
  'lastRaiseDate',
  'lastPromotionDate',
  
  // Policy compliance
  'policyViolations',
  'violationSeverity',
  'approvalRequired',
  
  // Metadata
  'lastModified',
  'modifiedBy',
  'exportTimestamp'
];

export class CSVExporter {
  // Main export function
  public static async exportEmployeeData(
    employees: Employee[],
    config: Partial<ExportConfig> = {}
  ): Promise<ExportResult> {

    
    try {
      // Merge with default config
      const exportConfig: ExportConfig = {
        includeOriginalData: true,
        includeCalculatedFields: true,
        includePolicyViolations: true,
        includeMetadata: true,
        customColumnOrder: DEFAULT_COLUMN_ORDER,
        ...config
      };

      // Filter employees based on criteria
      const filteredEmployees = this.filterEmployees(employees, exportConfig.filterCriteria);


      // Validate all employees and collect policy violations
      const allViolations: PolicyViolation[] = [];
      const enrichedEmployees = filteredEmployees.map(employee => {
        const violations = PolicyValidator.validateEmployee(employee);
        allViolations.push(...violations);
        
        return this.enrichEmployeeData(employee, violations, exportConfig);
      });

      // Generate CSV content
      const csvContent = this.generateCSVContent(enrichedEmployees, exportConfig);
      
      // Calculate export metrics
      const totalRaiseAmount = filteredEmployees.reduce((sum, emp) => 
        sum + (emp.proposedRaise || 0), 0
      );

      // Create download blob and URL
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `salary-raises-export-${timestamp}.csv`;

      const result: ExportResult = {
        success: true,
        fileName,
        rowCount: enrichedEmployees.length,
        totalRaiseAmount,
        policyViolations: allViolations,
        exportTimestamp: Date.now(),
        downloadUrl
      };


      return result;

    } catch (error) {
      console.error('❌ CSV export failed:', error);
      return {
        success: false,
        fileName: '',
        rowCount: 0,
        totalRaiseAmount: 0,
        policyViolations: [],
        exportTimestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  // Filter employees based on export criteria
  private static filterEmployees(
    employees: Employee[], 
    criteria?: ExportConfig['filterCriteria']
  ): Employee[] {
    if (!criteria) return employees;

    return employees.filter(employee => {
      // Filter by raise amount range
      if (criteria.minRaiseAmount && (employee.proposedRaise || 0) < criteria.minRaiseAmount) {
        return false;
      }
      if (criteria.maxRaiseAmount && (employee.proposedRaise || 0) > criteria.maxRaiseAmount) {
        return false;
      }

      // Filter by countries
      if (criteria.countries && criteria.countries.length > 0) {
        if (!criteria.countries.includes(employee.country || '')) {
          return false;
        }
      }

      // Filter by department codes
      if (criteria.departmentCodes && criteria.departmentCodes.length > 0) {
        if (!criteria.departmentCodes.includes(employee.departmentCode || '')) {
          return false;
        }
      }

      // Filter to only employees with raises
      if (criteria.onlyWithRaises && (!employee.proposedRaise || employee.proposedRaise <= 0)) {
        return false;
      }

      return true;
    });
  }

  // Enrich employee data with calculated fields and policy information
  private static enrichEmployeeData(
    employee: Employee, 
    violations: PolicyViolation[], 
    config: ExportConfig
  ): any {
    const enriched: any = { ...employee };

    if (config.includeCalculatedFields) {
      // Calculate new salary and percentage change
      enriched.newSalary = PolicyValidator.calculateNewSalary(
        employee.baseSalaryUSD || employee.baseSalary || 0,
        employee.proposedRaise || 0
      );
      
      enriched.percentChange = PolicyValidator.calculateRaisePercent(
        employee.baseSalaryUSD || employee.baseSalary || 0,
        employee.proposedRaise || 0
      );

      // Calculate tenure information
      if (employee.hireDate) {
        const hireDate = new Date(employee.hireDate);
        const now = new Date();
        const tenureMonths = Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        enriched.totalTenure = tenureMonths;
      }

      if (employee.roleStartDate) {
        const roleStart = new Date(employee.roleStartDate);
        const now = new Date();
        const roleMonths = Math.floor((now.getTime() - roleStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        enriched.timeInRole = roleMonths;
      }
    }

    if (config.includePolicyViolations) {
      // Add policy violation information
      enriched.policyViolations = violations.map(v => v.message).join('; ');
      enriched.violationSeverity = PolicyValidator.getViolationColor(violations);
      enriched.approvalRequired = violations.some(v => v.severity === 'ERROR') ? 'YES' : 'NO';
    }

    if (config.includeMetadata) {
      // Add export metadata
      enriched.exportTimestamp = new Date().toISOString();
      enriched.lastModified = new Date().toISOString();
      enriched.modifiedBy = 'System'; // Could be enhanced to track actual user
    }

    return enriched;
  }

  // Generate CSV content from employee data
  private static generateCSVContent(employees: any[], config: ExportConfig): string {
    if (employees.length === 0) {
      return 'No data to export';
    }

    // Determine column order
    const columnOrder = config.customColumnOrder || DEFAULT_COLUMN_ORDER;
    
    // Get all available columns from the data
    const availableColumns = new Set<string>();
    employees.forEach(emp => {
      Object.keys(emp).forEach(key => availableColumns.add(key));
    });

    // Filter column order to only include available columns
    const finalColumns = columnOrder.filter(col => availableColumns.has(col));
    
    // Add any remaining columns not in the specified order
    availableColumns.forEach(col => {
      if (!finalColumns.includes(col)) {
        finalColumns.push(col);
      }
    });

    // Generate header row
    const headers = finalColumns.map(col => this.formatColumnHeader(col));
    const csvRows = [headers.join(',')];

    // Generate data rows
    employees.forEach(employee => {
      const row = finalColumns.map(column => {
        const value = employee[column];
        return this.formatCSVValue(value);
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  // Format column headers for better readability
  private static formatColumnHeader(columnName: string): string {
    // Convert camelCase to Title Case
    const formatted = columnName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    
    // Handle special cases
    const specialCases: { [key: string]: string } = {
      'Employee Id': 'Employee ID',
      'Base Salary U S D': 'Base Salary (USD)',
      'Job Title': 'Job Title',
      'Department Code': 'Department',
      'Manager Id': 'Manager ID',
      'Hire Date': 'Hire Date',
      'Role Start Date': 'Role Start Date',
      'Last Raise Date': 'Last Raise Date',
      'Last Promotion Date': 'Last Promotion Date',
      'Performance Rating': 'Performance Rating',
      'Business Impact Score': 'Business Impact Score',
      'Retention Risk': 'Retention Risk (%)',
      'Time In Role': 'Time in Role (Months)',
      'Total Tenure': 'Total Tenure (Months)',
      'Proposed Raise': 'Proposed Raise (USD)',
      'New Salary': 'New Salary (USD)',
      'Percent Change': 'Raise Percentage (%)',
      'Policy Violations': 'Policy Violations',
      'Violation Severity': 'Violation Severity',
      'Approval Required': 'Approval Required',
      'Export Timestamp': 'Export Timestamp',
      'Last Modified': 'Last Modified',
      'Modified By': 'Modified By'
    };

    return `"${specialCases[formatted] || formatted}"`;
  }

  // Format individual CSV values with proper escaping
  private static formatCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Convert to string
    let stringValue = String(value);

    // Handle numbers with proper formatting
    if (typeof value === 'number') {
      // Format currency values
      if (value > 1000 && Number.isInteger(value)) {
        stringValue = value.toLocaleString();
      } else if (value % 1 !== 0) {
        // Format decimals to 2 places for percentages and ratios
        stringValue = value.toFixed(2);
      }
    }

    // Handle dates
    if (value instanceof Date) {
      stringValue = value.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // Escape quotes and wrap in quotes if necessary
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      stringValue = `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  // Trigger download of the CSV file
  public static downloadCSV(result: ExportResult): void {
    if (!result.success || !result.downloadUrl) {
      console.error('❌ Cannot download CSV: Export failed or no download URL');
      return;
    }

    try {
      // Create temporary download link
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.fileName;
      link.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
  
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(result.downloadUrl!);
      }, 1000);
      
    } catch (error) {
      console.error('❌ CSV download failed:', error);
    }
  }

  // Generate export preview (first 5 rows) for validation
  public static generatePreview(employees: Employee[], config: Partial<ExportConfig> = {}): string {
    const previewEmployees = employees.slice(0, 5);
    const previewConfig = { ...config, includeMetadata: false };
    
    return this.generateCSVContent(
      previewEmployees.map(emp => this.enrichEmployeeData(emp, [], previewConfig as ExportConfig)),
      previewConfig as ExportConfig
    );
  }

  // Validate export data before processing
  public static validateExportData(employees: Employee[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (employees.length === 0) {
      errors.push('No employee data to export');
    }

    // Check for required fields
    const requiredFields = ['employeeId', 'name'];
    employees.forEach((emp, index) => {
      requiredFields.forEach(field => {
        if (!emp[field as keyof Employee]) {
          errors.push(`Employee at row ${index + 1} is missing required field: ${field}`);
        }
      });
    });

    // Check for data quality issues
    const employeesWithRaises = employees.filter(emp => emp.proposedRaise && emp.proposedRaise > 0);
    if (employeesWithRaises.length === 0) {
      warnings.push('No employees have proposed raises');
    }

    const employeesWithoutSalary = employees.filter(emp => !emp.baseSalaryUSD && !emp.baseSalary);
    if (employeesWithoutSalary.length > 0) {
      warnings.push(`${employeesWithoutSalary.length} employees are missing salary information`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
} 