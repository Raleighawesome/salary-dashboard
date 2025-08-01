import type { 
  SalarySheetRow, 
  PerformanceSheetRow, 
  Employee,
  ValidationResult 
} from '../types/employee';
import { NameNormalizer } from '../utils/nameNormalizer';

export interface JoinResult {
  joinedEmployees: Employee[];
  unmatchedSalaryRows: SalarySheetRow[];
  unmatchedPerformanceRows: PerformanceSheetRow[];
  joinSummary: {
    totalSalaryRows: number;
    totalPerformanceRows: number;
    successfulJoins: number;
    emailMatches: number;
    idMatches: number;
    unmatchedSalary: number;
    unmatchedPerformance: number;
  };
  validationResults: ValidationResult[];
}

export interface JoinOptions {
  preferEmailMatch?: boolean; // Default: true - prefer email over ID matching
  requireExactNameMatch?: boolean; // Default: false - allow fuzzy name matching
  generateMissingFields?: boolean; // Default: true - generate calculated fields
}

export class DataJoiner {
  // Normalize names for better matching
  private static normalizeName(name: string): string {
    if (!name) return '';
    
    // Handle "Last, First" format common in HR systems
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`.trim();
      }
    }
    
    // Standard normalization
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  // Extract employee identifier for matching
  private static getEmployeeKey(row: SalarySheetRow | PerformanceSheetRow): {
    id?: string;
    email?: string;
    normalizedName?: string;
  } {
    return {
      id: row.employeeId?.toString().trim() || undefined,
      email: row.email?.toLowerCase().trim() || undefined,
      normalizedName: row.name ? this.normalizeName(row.name) : undefined,
    };
  }

  // Find matching performance record for a salary record
  private static findPerformanceMatch(
    salaryRow: SalarySheetRow,
    performanceRows: PerformanceSheetRow[],
    options: JoinOptions
  ): { match?: PerformanceSheetRow; matchType: 'id' | 'email' | 'name' | 'none' } {
    const salaryKey = this.getEmployeeKey(salaryRow);
    
    // Try ID match first (if not preferring email)
    if (!options.preferEmailMatch && salaryKey.id) {
      const idMatch = performanceRows.find(p => {
        const perfKey = this.getEmployeeKey(p);
        return perfKey.id && perfKey.id === salaryKey.id;
      });
      if (idMatch) return { match: idMatch, matchType: 'id' };
    }

    // Try email match
    if (salaryKey.email) {
      const emailMatch = performanceRows.find(p => {
        const perfKey = this.getEmployeeKey(p);
        return perfKey.email && perfKey.email === salaryKey.email;
      });
      if (emailMatch) return { match: emailMatch, matchType: 'email' };
    }

    // Try ID match (if we preferred email first)
    if (options.preferEmailMatch && salaryKey.id) {
      const idMatch = performanceRows.find(p => {
        const perfKey = this.getEmployeeKey(p);
        return perfKey.id && perfKey.id === salaryKey.id;
      });
      if (idMatch) return { match: idMatch, matchType: 'id' };
    }

    // Try name match as fallback (if not requiring exact match)
    if (!options.requireExactNameMatch && salaryKey.normalizedName) {
      const nameMatch = performanceRows.find(p => {
        const perfKey = this.getEmployeeKey(p);
        return perfKey.normalizedName && 
               this.calculateNameSimilarity(salaryKey.normalizedName!, perfKey.normalizedName) > 0.8;
      });
      if (nameMatch) return { match: nameMatch, matchType: 'name' };
    }

    return { matchType: 'none' };
  }

  // Calculate name similarity using simple string matching
  private static calculateNameSimilarity(name1: string, name2: string): number {
    if (name1 === name2) return 1.0;
    
    const words1 = name1.split(' ').filter(w => w.length > 1);
    const words2 = name2.split(' ').filter(w => w.length > 1);
    
    let matches = 0;
    const totalWords = Math.max(words1.length, words2.length);
    
    words1.forEach(word1 => {
      if (words2.some(word2 => 
        word1.includes(word2) || word2.includes(word1) || 
        this.levenshteinDistance(word1, word2) <= 1
      )) {
        matches++;
      }
    });
    
    return matches / totalWords;
  }

  // Simple Levenshtein distance for name matching
  private static levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[b.length][a.length];
  }

  // Generate calculated fields for employee records
  private static generateCalculatedFields(
    salaryData: SalarySheetRow,
    performanceData?: PerformanceSheetRow
  ): Partial<Employee> {
    const employee: Partial<Employee> = {};

    // Normalize name using the NameNormalizer utility
    const nameInput = {
      firstName: salaryData.firstName,
      lastName: salaryData.lastName,
      name: salaryData.name,
    };
    
    const normalizedName = NameNormalizer.normalizeName(nameInput, {
      capitalizeNames: true,
      handleSuffixes: true,
      preserveMiddleName: false, // Include middle names in lastName for simplicity
    });

    // Apply normalized name parts
    employee.name = normalizedName.displayName;
    employee.firstName = normalizedName.firstName;
    employee.lastName = normalizedName.lastName;

    // Calculate comparatio if we have salary and grade info
    if (salaryData.baseSalary && salaryData.salaryGradeMid) {
      employee.comparatio = Math.round((salaryData.baseSalary / salaryData.salaryGradeMid) * 100);
    }

    // Initialize raise-related fields
    employee.proposedRaise = 0;
    employee.newSalary = salaryData.baseSalary || 0;
    employee.percentChange = 0;

    // Set default retention risk if not provided
    if (!performanceData?.retentionRisk) {
      // Calculate basic retention risk based on comparatio and performance
      let risk = 50; // Default medium risk
      
      if (employee.comparatio) {
        if (employee.comparatio < 80) risk += 20; // Below market
        if (employee.comparatio > 120) risk -= 10; // Above market
      }
      
      if (performanceData?.performanceRating) {
        const rating = typeof performanceData.performanceRating === 'number' 
          ? performanceData.performanceRating 
          : 0; // Default for text ratings, let other logic handle text-based ratings
        if (rating >= 4) risk -= 15; // High performer
        if (rating <= 2) risk += 15; // Low performer
      }
      
      employee.retentionRisk = Math.max(0, Math.min(100, risk));
    }

    return employee;
  }

  // Main joining function
  public static joinSalaryAndPerformanceData(
    salaryRows: SalarySheetRow[],
    performanceRows: PerformanceSheetRow[],
    options: JoinOptions = {}
  ): JoinResult {
    // Set default options
    const joinOptions: Required<JoinOptions> = {
      preferEmailMatch: options.preferEmailMatch ?? true,
      requireExactNameMatch: options.requireExactNameMatch ?? false,
      generateMissingFields: options.generateMissingFields ?? true,
    };

    const joinedEmployees: Employee[] = [];
    const unmatchedSalaryRows: SalarySheetRow[] = [];
    const unmatchedPerformanceRows: PerformanceSheetRow[] = [...performanceRows];
    const validationResults: ValidationResult[] = [];

    let emailMatches = 0;
    let idMatches = 0;

    // Process each salary row
    salaryRows.forEach((salaryRow, index) => {
      const matchResult = this.findPerformanceMatch(salaryRow, unmatchedPerformanceRows, joinOptions);
      
      let employee: Employee;
      
      if (matchResult.match) {
        // Found a match - merge the data
        const performanceRow = matchResult.match;
        
        // Remove the matched performance row from unmatched list
        const perfIndex = unmatchedPerformanceRows.indexOf(performanceRow);
        if (perfIndex > -1) {
          unmatchedPerformanceRows.splice(perfIndex, 1);
        }

        // Count match types for reporting
        if (matchResult.matchType === 'email') emailMatches++;
        if (matchResult.matchType === 'id') idMatches++;

        // Create merged employee record
        employee = {
          employeeId: salaryRow.employeeId || performanceRow.employeeId || '',
          email: salaryRow.email || performanceRow.email || '',
          name: salaryRow.name || performanceRow.name || '',
          firstName: salaryRow.firstName || '',
          lastName: salaryRow.lastName || '',
          country: salaryRow.country || '',
          currency: salaryRow.currency || 'USD',
          baseSalary: salaryRow.baseSalary || 0,
          baseSalaryUSD: salaryRow.baseSalary || 0, // Will be converted later
          comparatio: 0, // Will be calculated
          timeInRole: salaryRow.timeInRole || 0,
          performanceRating: performanceRow.performanceRating,
          retentionRisk: performanceRow.retentionRisk || 50,
          proposedRaise: 0,
          newSalary: salaryRow.baseSalary || 0,
          percentChange: 0,
          businessImpactScore: performanceRow.businessImpactScore,
          salaryGradeMin: salaryRow.salaryGradeMin,
          salaryGradeMid: salaryRow.salaryGradeMid,
          salaryGradeMax: salaryRow.salaryGradeMax,
          hireDate: salaryRow.hireDate,
          roleStartDate: salaryRow.roleStartDate,
          lastRaiseDate: salaryRow.lastRaiseDate,
          departmentCode: salaryRow.departmentCode,
          jobTitle: salaryRow.jobTitle,
          managerId: salaryRow.managerId,
          managerName: salaryRow.managerName,
          futuretalent: performanceRow.futuretalent,
          movementReadiness: performanceRow.movementReadiness,
          proposedTalentActions: performanceRow.proposedTalentActions,
        };

      } else {
        // No performance match - create employee from salary data only
        employee = {
          employeeId: salaryRow.employeeId || '',
          email: salaryRow.email || '',
          name: salaryRow.name || '',
          firstName: salaryRow.firstName || '',
          lastName: salaryRow.lastName || '',
          country: salaryRow.country || '',
          currency: salaryRow.currency || 'USD',
          baseSalary: salaryRow.baseSalary || 0,
          baseSalaryUSD: salaryRow.baseSalary || 0,
          comparatio: 0,
          timeInRole: salaryRow.timeInRole || 0,
          retentionRisk: 50, // Default medium risk
          proposedRaise: 0,
          newSalary: salaryRow.baseSalary || 0,
          percentChange: 0,
          salaryGradeMin: salaryRow.salaryGradeMin,
          salaryGradeMid: salaryRow.salaryGradeMid,
          salaryGradeMax: salaryRow.salaryGradeMax,
          hireDate: salaryRow.hireDate,
          roleStartDate: salaryRow.roleStartDate,
          lastRaiseDate: salaryRow.lastRaiseDate,
          departmentCode: salaryRow.departmentCode,
          jobTitle: salaryRow.jobTitle,
          managerId: salaryRow.managerId,
          managerName: salaryRow.managerName,
          futuretalent: undefined,
          movementReadiness: undefined,
          proposedTalentActions: undefined,
        };

        unmatchedSalaryRows.push(salaryRow);
      }

      // Generate calculated fields if enabled
      if (joinOptions.generateMissingFields) {
        const calculatedFields = this.generateCalculatedFields(salaryRow, matchResult.match);
        Object.assign(employee, calculatedFields);
      }

      // Validate the joined employee record
      const validation = this.validateJoinedEmployee(employee, index);
      validationResults.push(validation);

      if (validation.isValid) {
        joinedEmployees.push(employee);
      }
    });

    return {
      joinedEmployees,
      unmatchedSalaryRows,
      unmatchedPerformanceRows,
      joinSummary: {
        totalSalaryRows: salaryRows.length,
        totalPerformanceRows: performanceRows.length,
        successfulJoins: joinedEmployees.length,
        emailMatches,
        idMatches,
        unmatchedSalary: unmatchedSalaryRows.length,
        unmatchedPerformance: unmatchedPerformanceRows.length,
      },
      validationResults,
    };
  }

  // Validate joined employee record
  private static validateJoinedEmployee(employee: Employee, index: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation - Employee ID is required, email is optional
    if (!employee.employeeId) {
      errors.push('Employee must have an ID');
    }

    if (!employee.name) {
      errors.push('Employee name is required');
    }

    if (!employee.baseSalary || employee.baseSalary <= 0) {
      errors.push('Valid base salary is required');
    }

    // Data quality warnings
    if (!employee.performanceRating) {
      warnings.push('No performance rating available');
    }

    if (!employee.country) {
      warnings.push('Country information missing');
    }

    if (!employee.currency) {
      warnings.push('Currency information missing');
    }

    if (employee.comparatio && (employee.comparatio < 50 || employee.comparatio > 200)) {
      warnings.push('Comparatio seems unusually high or low');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      employeeId: employee.employeeId || `Row ${index + 1}`,
    };
  }

  // Helper method to create employees from performance data only (for unmatched performance records)
  public static createEmployeesFromPerformanceOnly(
    performanceRows: PerformanceSheetRow[]
  ): Employee[] {
    return performanceRows.map(row => ({
      employeeId: row.employeeId || '',
      email: row.email || '',
      name: row.name || '',
      firstName: '',
      lastName: '',
      country: '',
      currency: 'USD',
      baseSalary: 0,
      baseSalaryUSD: 0,
      comparatio: 0,
      timeInRole: 0,
      performanceRating: row.performanceRating,
      retentionRisk: row.retentionRisk || 50,
      proposedRaise: 0,
      newSalary: 0,
      percentChange: 0,
      businessImpactScore: row.businessImpactScore,
    }));
  }
} 