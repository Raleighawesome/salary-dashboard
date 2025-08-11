// import { DataParser } from './dataParser'; // Currently unused
import { DataJoiner, type JoinResult, type JoinOptions } from './dataJoiner';
import { NameNormalizer } from '../utils/nameNormalizer';
import { CurrencyConverter } from './currencyConverter';
import { DataStorageService } from './dataStorage';
import type { 
  FileUploadResult, 
  Employee, 
  SalarySheetRow, 
  PerformanceSheetRow 
} from '../types/employee';

export interface ProcessingResult {
  employees: Employee[];
  processingReport: {
    filesProcessed: number;
    totalRowsParsed: number;
    validEmployees: number;
    joinReport?: JoinResult['joinSummary'];
    errors: string[];
    warnings: string[];
  };
  hasSalaryData: boolean;
  hasPerformanceData: boolean;
}

export interface ProcessingOptions extends JoinOptions {
  skipValidation?: boolean;
  autoGenerateFields?: boolean;
  convertCurrencies?: boolean; // Default: true - convert all salaries to USD
  currencyApiKey?: string; // Optional API key for real-time rates
}

export class DataProcessor {
  private static salaryData: SalarySheetRow[] = [];
  private static performanceData: PerformanceSheetRow[] = [];
  private static processedEmployees: Employee[] = [];

  // Process a single uploaded file
  public static async processUploadedFile(
    fileResult: FileUploadResult,
    options: ProcessingOptions = {}
  ): Promise<void> {
    if (fileResult.fileType === 'salary') {
      this.salaryData = fileResult.data as SalarySheetRow[];

    } else if (fileResult.fileType === 'performance') {
      this.performanceData = fileResult.data as PerformanceSheetRow[];

    } else {
      // Unknown type - try to determine based on data content
      const hasBaseSalary = fileResult.data.some((row: any) => 
        row.baseSalary !== undefined && row.baseSalary > 0
      );
      
      if (hasBaseSalary) {
        this.salaryData = fileResult.data as SalarySheetRow[];

      } else {
        this.performanceData = fileResult.data as PerformanceSheetRow[];

      }
    }

    // Auto-process if we have salary data
    if (this.salaryData.length > 0) {
      await this.processEmployeeData(options);
    }
  }

  // Main processing function that joins data and creates employee records
  public static async processEmployeeData(
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let employees: Employee[] = [];
    let joinReport: JoinResult['joinSummary'] | undefined;

    try {


      // Initialize currency converter if needed
      if (options.convertCurrencies !== false) {
        CurrencyConverter.initialize({
          apiKey: options.currencyApiKey,
          fallbackToStaticRates: true,
        });
      }

      if (this.salaryData.length === 0) {
        throw new Error('No salary data available for processing');
      }

      if (this.performanceData.length > 0) {
        // We have both salary and performance data - join them

        
        const joinResult = DataJoiner.joinSalaryAndPerformanceData(
          this.salaryData,
          this.performanceData,
          options
        );

        employees = joinResult.joinedEmployees;
        joinReport = joinResult.joinSummary;

        // Report join results

        
        if (joinReport.unmatchedSalary > 0) {
          warnings.push(`${joinReport.unmatchedSalary} salary records could not be matched with performance data`);
        }
        
        if (joinReport.unmatchedPerformance > 0) {
          warnings.push(`${joinReport.unmatchedPerformance} performance records could not be matched with salary data`);
        }

        // Add validation errors and warnings
        joinResult.validationResults.forEach(result => {
          if (!result.isValid) {
            errors.push(`${result.employeeId}: ${result.errors.join(', ')}`);
          }
          if (result.warnings.length > 0) {
            warnings.push(`${result.employeeId}: ${result.warnings.join(', ')}`);
          }
        });

      } else {
        // Only salary data available - create employees from salary data only

        
        const joinResult = DataJoiner.joinSalaryAndPerformanceData(
          this.salaryData,
          [], // Empty performance array
          options
        );

        employees = joinResult.joinedEmployees;
        warnings.push('No performance data provided - using default values');
      }

      // Additional processing and validation
      employees = await this.enhanceEmployeeData(employees, options);

      // Store processed employees
      this.processedEmployees = employees;
      
      // Store in IndexedDB for persistence
      if (employees.length > 0) {
        await DataStorageService.saveEmployees(employees.map(emp => ({
          employeeId: emp.employeeId,
          email: emp.email,
          name: emp.name,
          country: emp.country,
          currency: emp.currency,
          baseSalary: emp.baseSalary,
          baseSalaryUSD: emp.baseSalaryUSD,
          comparatio: emp.comparatio,
          timeInRole: emp.timeInRole,
          performanceRating: typeof emp.performanceRating === 'string' ? 
            parseFloat(emp.performanceRating) || undefined : emp.performanceRating,
          retentionRisk: emp.retentionRisk,
          proposedRaise: emp.proposedRaise,
          newSalary: emp.newSalary,
          percentChange: emp.percentChange,
          businessImpactScore: emp.businessImpactScore,
          salaryGradeMin: emp.salaryGradeMin,
          salaryGradeMid: emp.salaryGradeMid,
          salaryGradeMax: emp.salaryGradeMax,
          hireDate: emp.hireDate,
          roleStartDate: emp.roleStartDate,
          lastRaiseDate: emp.lastRaiseDate,
        })));
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      errors.push(errorMessage);
      console.error('❌ Processing failed:', errorMessage);
    }

    return {
      employees,
      processingReport: {
        filesProcessed: (this.salaryData.length > 0 ? 1 : 0) + (this.performanceData.length > 0 ? 1 : 0),
        totalRowsParsed: this.salaryData.length + this.performanceData.length,
        validEmployees: employees.length,
        joinReport,
        errors,
        warnings,
      },
      hasSalaryData: this.salaryData.length > 0,
      hasPerformanceData: this.performanceData.length > 0,
    };
  }

  // Enhance employee data with calculated fields and validation
  private static async enhanceEmployeeData(
    employees: Employee[],
    options: ProcessingOptions
  ): Promise<Employee[]> {
    // Convert currencies in batch if enabled
    if (options.convertCurrencies !== false) {
      
      
      const conversions = employees
        .filter(emp => emp.currency && emp.currency !== 'USD')
        .map(emp => ({
          amount: emp.baseSalary,
          fromCurrency: emp.currency,
          toCurrency: 'USD',
          id: emp.employeeId,
        }));

      if (conversions.length > 0) {
        const conversionResults = await CurrencyConverter.convertBatch(conversions);
        
        // Apply conversion results
        const conversionMap = new Map(
          conversionResults.map(result => [result.id, result])
        );

        employees.forEach(employee => {
          const conversion = conversionMap.get(employee.employeeId);
          if (conversion) {
            employee.baseSalaryUSD = conversion.convertedAmount;
  
          } else {
            employee.baseSalaryUSD = employee.baseSalary; // Assume already in USD
          }
        });
      } else {
        // All salaries already in USD
        employees.forEach(employee => {
          employee.baseSalaryUSD = employee.baseSalary;
        });
      }
    }

    return employees.map(employee => {
      const enhanced = { ...employee };

      // Apply comprehensive name normalization
      const nameInput = {
        firstName: enhanced.firstName,
        lastName: enhanced.lastName,
        name: enhanced.name,
      };
      
      const normalizedName = NameNormalizer.normalizeName(nameInput, {
        capitalizeNames: true,
        handleSuffixes: true,
        preserveMiddleName: false,
      });

      // Update with normalized names
      enhanced.name = normalizedName.displayName;
      enhanced.firstName = normalizedName.firstName;
      enhanced.lastName = normalizedName.lastName;

      // Calculate comparatio if missing but we have salary and grade data
      if (!enhanced.comparatio && enhanced.baseSalary && enhanced.salaryGradeMid) {
        enhanced.comparatio = Math.round((enhanced.baseSalary / enhanced.salaryGradeMid) * 100);
      }

      // Set reasonable defaults for missing values
      if (!enhanced.retentionRisk) {
        enhanced.retentionRisk = this.calculateDefaultRetentionRisk(enhanced);
      }

      // Ensure raise calculations are initialized
      enhanced.proposedRaise = enhanced.proposedRaise || 0;
      
      // Calculate newSalary in original currency (proposedRaise is in USD, convert to local)
      const proposedRaiseLocal = enhanced.currency !== 'USD' && enhanced.baseSalary && enhanced.baseSalaryUSD 
        ? (enhanced.proposedRaise * (enhanced.baseSalary / enhanced.baseSalaryUSD))
        : enhanced.proposedRaise;
      enhanced.newSalary = enhanced.baseSalary + proposedRaiseLocal;
      
      // Calculate percentage using USD values for consistency
      enhanced.percentChange = enhanced.baseSalaryUSD > 0 
        ? Math.round(((enhanced.proposedRaise || 0) / enhanced.baseSalaryUSD) * 100)
        : 0;

      // Ensure currency is set
      if (!enhanced.currency) {
        enhanced.currency = enhanced.country === 'IN' ? 'INR' : 'USD';
      }

      // baseSalaryUSD is already set by currency conversion above
      if (!enhanced.baseSalaryUSD) {
        enhanced.baseSalaryUSD = enhanced.baseSalary;
      }

      return enhanced;
    });
  }

  // Calculate default retention risk based on available data
  private static calculateDefaultRetentionRisk(employee: Employee): number {
    let risk = 50; // Base medium risk

    // Adjust based on comparatio
    if (employee.comparatio) {
      if (employee.comparatio < 75) risk += 25; // Significantly underpaid
      else if (employee.comparatio < 85) risk += 15; // Underpaid
      else if (employee.comparatio < 95) risk += 5; // Slightly underpaid
      else if (employee.comparatio > 120) risk -= 10; // Well compensated
      else if (employee.comparatio > 110) risk -= 5; // Slightly overpaid
    }

    // Adjust based on performance rating
    if (employee.performanceRating) {
      const rating = typeof employee.performanceRating === 'number' 
        ? employee.performanceRating 
        : 0; // Default for text ratings
      if (rating >= 4.5) risk -= 20; // Top performer
      else if (rating >= 4.0) risk -= 10; // High performer
      else if (rating >= 3.5) risk -= 5; // Good performer
      else if (rating < 2.5) risk += 15; // Poor performer
    }

    // Adjust based on time in role
    if (employee.timeInRole) {
      if (employee.timeInRole < 6) risk -= 5; // New employees less likely to leave immediately
      else if (employee.timeInRole > 36) risk += 10; // Long tenure might seek change
    }

    return Math.max(0, Math.min(100, risk));
  }

  // Get current processed employees
  public static getProcessedEmployees(): Employee[] {
    return [...this.processedEmployees];
  }

  // Clear all data (for new session)
  public static clearAllData(): void {
    this.salaryData = [];
    this.performanceData = [];
    this.processedEmployees = [];

  }

  // Get processing status
  public static getProcessingStatus(): {
    hasSalaryData: boolean;
    hasPerformanceData: boolean;
    processedEmployeeCount: number;
  } {
    return {
      hasSalaryData: this.salaryData.length > 0,
      hasPerformanceData: this.performanceData.length > 0,
      processedEmployeeCount: this.processedEmployees.length,
    };
  }

  // Re-process data with new options
  public static async reprocessWithOptions(options: ProcessingOptions): Promise<ProcessingResult> {
    return this.processEmployeeData(options);
  }

  // Get detailed processing statistics
  public static getProcessingStatistics(): {
    salaryRecords: number;
    performanceRecords: number;
    processedEmployees: number;
    averageComparatio: number;
    employeesWithPerformanceData: number;
    currencyDistribution: Record<string, number>;
    countryDistribution: Record<string, number>;
  } {
    const employees = this.processedEmployees;
    
    const currencyDistribution: Record<string, number> = {};
    const countryDistribution: Record<string, number> = {};
    let totalComparatio = 0;
    let comparatioCount = 0;
    let employeesWithPerformanceData = 0;

    employees.forEach(emp => {
      // Currency distribution
      if (emp.currency) {
        currencyDistribution[emp.currency] = (currencyDistribution[emp.currency] || 0) + 1;
      }

      // Country distribution
      if (emp.country) {
        countryDistribution[emp.country] = (countryDistribution[emp.country] || 0) + 1;
      }

      // Comparatio calculation
      if (emp.comparatio) {
        totalComparatio += emp.comparatio;
        comparatioCount++;
      }

      // Performance data tracking
      if (emp.performanceRating) {
        employeesWithPerformanceData++;
      }
    });

    return {
      salaryRecords: this.salaryData.length,
      performanceRecords: this.performanceData.length,
      processedEmployees: employees.length,
      averageComparatio: comparatioCount > 0 ? Math.round(totalComparatio / comparatioCount) : 0,
      employeesWithPerformanceData,
      currencyDistribution,
      countryDistribution,
    };
  }
} 