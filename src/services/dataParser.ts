import Papa from 'papaparse';
import * as XLSX from '@e965/xlsx';
import { ErrorHandler } from '../utils/errorHandling';
import type { 
  SalarySheetRow, 
  PerformanceSheetRow, 
  FileUploadResult,
  ValidationResult 
} from '../types/employee';

// Column mapping for flexible CSV headers - Updated for RH Compensation Report format
const SALARY_COLUMN_MAPPINGS: Record<string, keyof SalarySheetRow> = {
  // Employee ID variations - RH format uses "Employee Number"
  'employee_id': 'employeeId',
  'employeeid': 'employeeId',
  'emp_id': 'employeeId',
  'id': 'employeeId',
  'employee id': 'employeeId',
  'employee number': 'employeeId',
  'employee_number': 'employeeId',
  
  // Email variations
  'email': 'email',
  'email_address': 'email',
  'e-mail': 'email',
  'work_email': 'email',
  
  // Name variations - RH format uses "Employee Full name"
  'name': 'name',
  'full_name': 'name',
  'employee_name': 'name',
  'full name': 'name',
  'employee full name': 'name',
  'employee_full_name': 'name',
  'first_name': 'firstName',
  'firstname': 'firstName',
  'first name': 'firstName',
  'last_name': 'lastName',
  'lastname': 'lastName',
  'last name': 'lastName',
  
  // Location and currency - RH format
  'country': 'country',
  'location': 'country',
  'currency': 'currency',
  'curr': 'currency',
  'country iso2': 'country',
  
  // Salary information - RH format specific mappings
  'base_salary': 'baseSalary',
  'basesalary': 'baseSalary',
  'salary': 'baseSalary',
  'annual_salary': 'baseSalary',
  'base salary': 'baseSalary',
  'annual salary': 'baseSalary',
  'base pay all countries': 'baseSalary',
  'total base pay': 'baseSalary',
  'annual calculated base pay all countries': 'baseSalary',
  
  // Salary grade information - RH format specific
  'salary_grade_min': 'salaryGradeMin',
  'grade_min': 'salaryGradeMin',
  'min_salary': 'salaryGradeMin',
  'min pay grade value': 'salaryGradeMin',
  'salary_grade_mid': 'salaryGradeMid',
  'grade_mid': 'salaryGradeMid',
  'mid_salary': 'salaryGradeMid',
  'mid pay grade value': 'salaryGradeMid',
  'salary_grade_max': 'salaryGradeMax',
  'grade_max': 'salaryGradeMax',
  'max_salary': 'salaryGradeMax',
  'max pay grade value': 'salaryGradeMax',
  
  // Comparatio - RH format specific
  'comparatio': 'comparatio',
  
  // Time in role
  'time_in_role': 'timeInRole',
  'months_in_role': 'timeInRole',
  'tenure': 'timeInRole',
  'time in role': 'timeInRole',
  
  // Date fields - specific to user's data format
  'latest hire date': 'hireDate',
  'job entry start date': 'roleStartDate',
  'hire_date': 'hireDate',
  'start_date': 'hireDate',
  'role_start_date': 'roleStartDate',
  'current_role_start': 'roleStartDate',
  
  // Other RH format specific fields
  'last_raise_date': 'lastRaiseDate',
  'last raise date': 'lastRaiseDate',
  'last salary change date': 'lastRaiseDate',
  'department': 'departmentCode',
  'department_code': 'departmentCode',
  'department - cc based': 'departmentCode',
  'job_title': 'jobTitle',
  'title': 'jobTitle',
  'business title': 'jobTitle',
  'job profile': 'jobTitle',
  'job function': 'jobTitle',
  'job family': 'jobTitle',
  'manager_id': 'managerId',
  'manager id': 'managerId',
  'manager employee number': 'managerId',
  'manager_name': 'managerName',
  'manager name': 'managerName',
  'manager full name': 'managerName',
  'manager_full_name': 'managerName',
  'first line manager': 'managerName',
  'direct manager': 'managerName',
  'supervisor': 'managerName',
  'grade band': 'gradeLevel',
  'grade_band': 'gradeLevel',
  'compensation grade profile': 'gradeLevel',
  
  // Salary Range Segment - RH format specific
  'salary range segment': 'salaryRangeSegment',
  'salary_range_segment': 'salaryRangeSegment',
  'range_segment': 'salaryRangeSegment',
  
  // Below Range Minimum - RH format specific
  'below range minimum?': 'belowRangeMinimum',
  'below_range_minimum?': 'belowRangeMinimum',
  'below range minimum': 'belowRangeMinimum',
  'below_range_minimum': 'belowRangeMinimum',
  'is_below_minimum': 'belowRangeMinimum',
};

const PERFORMANCE_COLUMN_MAPPINGS: Record<string, keyof PerformanceSheetRow> = {
  // Employee identification - Details_View format uses "Associate ID" and "Worker"
  'employee_id': 'employeeId',
  'employeeid': 'employeeId',
  'emp_id': 'employeeId',
  'id': 'employeeId',
  'employee id': 'employeeId',
  'employee number': 'employeeId',
  'employee_number': 'employeeId',
  'associate id': 'employeeId',
  'associate_id': 'employeeId',
  'email': 'email',
  'name': 'name',
  'employee_name': 'name',
  'employee full name': 'name',
  'employee_full_name': 'name',
  'worker': 'name',
  
  // Performance data - Details_View format specific
  'performance_rating': 'performanceRating',
  'rating': 'performanceRating',
  'performance': 'performanceRating',
  'perf_rating': 'performanceRating',
  'performance rating': 'performanceRating',
  'overall performance rating': 'performanceRating',
  'overall_performance_rating': 'performanceRating',
  'overall performance rating (current)': 'performanceRating',
  'performance: what (current)': 'performanceRating',
  'performance: how (current)': 'performanceRating',
  
  // RH Talent Assessment Calibration format specific mappings
  'calibrated value: overall performance rating': 'performanceRating',
  'calibrated value: performance: what': 'performanceRating',
  'calibrated value: performance: how': 'performanceRating',
  'pre-calibrated value: overall performance rating': 'performanceRating',
  'calibrated value: identified as future talent?': 'futuretalent',
  'calibrated value: movement readiness': 'movementReadiness',
  'calibrated value: proposed talent actions': 'proposedTalentActions',
  'calibrated value: future talent: growth agility': 'businessImpactScore',
  'calibrated value: future talent: change agility': 'businessImpactScore',
  
  'business_impact': 'businessImpactScore',
  'business_impact_score': 'businessImpactScore',
  'impact_score': 'businessImpactScore',
  'business impact': 'businessImpactScore',
  
  'retention_risk': 'retentionRisk',
  'risk_score': 'retentionRisk',
  'retention risk': 'retentionRisk',
  'flight_risk': 'retentionRisk',
  'identified as future talent?': 'retentionRisk',
  'identified as future talent? (current)': 'retentionRisk',
};

export class DataParser {
  // Parse CSV file using Papaparse
  private static async parseCSV(file: File): Promise<Papa.ParseResult<any>> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (name: string) => name.toLowerCase().trim(),
        transform: (value: string) => value.trim(),
        complete: (results) => resolve(results),
        error: (error) => reject(error),
      });
    });
  }

  // Parse XLSX file using xlsx library
  private static async parseXLSX(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          

          
          // Get first worksheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Try multiple parsing approaches
          
          // Method 1: Raw array format
          const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false,
          });

          
          // Method 2: Object format with first row as headers
          const jsonDataObj = XLSX.utils.sheet_to_json(worksheet, {
            defval: '',
            blankrows: false,
          });

          
          // Method 3: Include blank rows to see everything
          const jsonDataWithBlanks = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: true,
          });

          
          // Method 4: Force a larger range to see if data exists beyond detected range
          const jsonDataForced = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            range: 'A1:Z100', // Force reading up to column Z, row 100
          });

          

          
          // Choose the best method based on results
          let jsonData: any[] = [];
          let useObjectFormat = false;
          
          if (jsonDataObj.length > 0) {
            // Use object format if available
            jsonData = jsonDataObj;
            useObjectFormat = true;

          } else if (jsonDataForced.length > 1) {
            // Use forced range if it found more data
            jsonData = jsonDataForced;

          } else if (jsonDataRaw.length > 1) {
            // Use raw format if we have more than just headers
            jsonData = jsonDataRaw;

          } else if (jsonDataWithBlanks.length > 1) {
            // Last resort: use format with blanks
            jsonData = jsonDataWithBlanks;

          } else {

            reject(new Error('Worksheet contains only headers, no data rows'));
            return;
          }
          
          if (jsonData.length === 0) {
            reject(new Error('Worksheet is empty'));
            return;
          }
          
          let objects: any[] = [];
          
          if (useObjectFormat) {
            // Data is already in object format
            objects = jsonData.map((row: any) => {
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                const normalizedKey = key.toLowerCase().trim();
                normalizedRow[normalizedKey] = row[key]?.toString().trim() || '';
              });
              return normalizedRow;
            });
            
    
          } else {
            // Data is in array format, need to convert to objects
            const headers = (jsonData[0] as any[])
              .filter(h => h !== null && h !== undefined && h !== '')
              .map(h => h.toString().toLowerCase().trim());
            

            
            // Convert data rows to objects
            objects = (jsonData.slice(1) as any[][])
              .filter(row => {
                // Keep rows that have at least one non-empty cell
                return row && row.some(cell => 
                  cell !== null && 
                  cell !== undefined && 
                  cell !== '' && 
                  String(cell).trim() !== ''
                );
              })
              .map((row: any[]) => {
                const obj: any = {};
                headers.forEach((header, index) => {
                  const cellValue = row[index];
                  obj[header] = cellValue !== null && cellValue !== undefined 
                    ? cellValue.toString().trim() 
                    : '';
                });
                return obj;
              });
          }
          

          
          resolve(objects);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Map column names to standard field names
  private static mapColumns<T>(
    data: any[], 
    mappings: Record<string, keyof T>
  ): T[] {

    
    return data.map((row, rowIndex) => {
      const mappedRow: any = {};
      
      Object.keys(row).forEach(key => {
        const normalizedKey = key.toLowerCase().trim();
        const mappedField = mappings[normalizedKey];
        
        if (mappedField) {
          let value = row[key];
          
                     // Handle numeric fields
           if (typeof value === 'string' && value !== '') {
             // Try to parse as number for numeric fields (excluding performanceRating which can be text)
             const numericFields = ['baseSalary', 'salaryGradeMin', 'salaryGradeMid', 
                                  'salaryGradeMax', 'timeInRole', 'businessImpactScore', 'retentionRisk'];
             
             if (numericFields.includes(mappedField as string)) {
               // Remove currency symbols, commas, quotes, and other formatting
               const cleanValue = value
                 .replace(/["']/g, '') // Remove quotes
                 .replace(/[$,£€¥₹]/g, '') // Remove currency symbols
                 .replace(/[^\d.-]/g, '') // Keep only digits, dots, and dashes
                 .trim();
               
               const numValue = parseFloat(cleanValue);
               if (!isNaN(numValue)) {
                 value = numValue;
               }
             }
             
             // Handle performanceRating field - keep as text but normalize
             if (mappedField === 'performanceRating') {
               // Keep text-based performance ratings as-is, just trim whitespace
               value = value.trim();
               
               // Handle percentage format if present
               if (value.includes('%')) {
                 const cleanValue = value.replace('%', '').trim();
                 const numValue = parseFloat(cleanValue);
                 if (!isNaN(numValue)) {
                   value = numValue / 100; // Convert percentage to decimal
                 }
               }
             }
             
             // Handle retentionRisk field - convert Yes/No to numeric if needed
             if (mappedField === 'retentionRisk') {
               const lowerValue = value.toLowerCase().trim();
               if (lowerValue === 'yes' || lowerValue === 'y' || lowerValue === 'true') {
                 value = 1; // High retention risk
               } else if (lowerValue === 'no' || lowerValue === 'n' || lowerValue === 'false') {
                 value = 0; // Low retention risk
               }
               // Otherwise keep as original value (could be numeric or text)
             }
           }
          
          mappedRow[mappedField] = value;
        }
      });
      
      // Debug: Log first few mapped rows
      if (rowIndex < 3) {

      }
      
      return mappedRow as T;
    });
  }

  // Validate salary data
  private static validateSalaryData(data: SalarySheetRow[]): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    data.forEach((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Required fields validation - Employee ID is required, email is optional
      if (!row.employeeId) {
        errors.push('Employee ID is required');
      }
      
      if (!row.name && !row.firstName && !row.lastName) {
        errors.push('Employee name is required');
      }
      
      if (!row.baseSalary || row.baseSalary <= 0) {
        errors.push('Valid base salary is required');
      }
      
      if (!row.country) {
        warnings.push('Country/location information is missing');
      }
      
      if (!row.currency) {
        warnings.push('Currency information is missing');
      }
      
      // Data type validation
      if (row.baseSalary && typeof row.baseSalary !== 'number') {
        errors.push('Base salary must be a number');
      }
      
      if (row.timeInRole && (typeof row.timeInRole !== 'number' || row.timeInRole < 0)) {
        warnings.push('Time in role should be a positive number (months)');
      }
      
      results.push({
        isValid: errors.length === 0,
        errors,
        warnings,
        employeeId: row.employeeId || `Row ${index + 1}`,
      });
    });
    
    return results;
  }

  // Validate performance data
  private static validatePerformanceData(data: PerformanceSheetRow[]): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    data.forEach((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Required fields validation - Employee ID is required, email is optional
      if (!row.employeeId) {
        errors.push('Employee ID is required');
      }
      
      // Data type validation - allow both text and numeric performance ratings
      if (row.performanceRating !== undefined && row.performanceRating !== null) {
        // Accept both text-based ratings (like "Successful Performer") and numeric ratings
        if (typeof row.performanceRating === 'number' && 
            (row.performanceRating < 0 || row.performanceRating > 5)) {
          warnings.push('Numeric performance rating should be between 0 and 5');
        }
        // For text-based ratings, we'll accept any non-empty string
        else if (typeof row.performanceRating === 'string' && 
                 row.performanceRating.trim() === '') {
          warnings.push('Performance rating cannot be empty');
        }
      }
      
      if (row.retentionRisk && 
          (typeof row.retentionRisk !== 'number' || 
           row.retentionRisk < 0 || row.retentionRisk > 100)) {
        warnings.push('Retention risk should be between 0 and 100');
      }
      
      results.push({
        isValid: errors.length === 0,
        errors,
        warnings,
        employeeId: row.employeeId || `Row ${index + 1}`,
      });
    });
    
    return results;
  }

  // Main parsing function with comprehensive error handling
  public static async parseFile(
    file: File, 
    expectedType: 'salary' | 'performance' | 'unknown'
  ): Promise<FileUploadResult> {
    try {
      // Step 1: Pre-validation of file
      const fileValidationErrors = ErrorHandler.validateFile(file);
      
      if (fileValidationErrors.some(e => e.severity === 'ERROR')) {
        const errorMessages = fileValidationErrors
          .filter(e => e.severity === 'ERROR')
          .map(e => e.message);
        
        return {
          fileName: file.name,
          fileType: 'unknown',
          rowCount: 0,
          validRows: 0,
          errors: errorMessages,
          data: [],
        };
      }
      
      // Log warnings but continue
      const warnings = fileValidationErrors.filter(e => e.severity === 'WARNING');
      if (warnings.length > 0) {
        console.warn('File validation warnings:', warnings);
      }
      // Step 2: Parse file content
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let rawData: any[] = [];
      
      try {
        if (fileExtension === 'csv') {
          const parseResult = await this.parseCSV(file);
          if (parseResult.errors.length > 0) {
            const parseErrors = parseResult.errors.map(e => `CSV parsing error: ${e.message || e.type}`);
            throw new Error(parseErrors.join('; '));
          }
          rawData = parseResult.data;
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
          rawData = await this.parseXLSX(file);
        } else {
          throw new Error(`Unsupported file type: ${fileExtension}. Please use CSV, XLSX, or XLS files.`);
        }
      } catch (parseError) {
        console.error('❌ File parsing failed:', parseError);
        return {
          fileName: file.name,
          fileType: 'unknown',
          rowCount: 0,
          validRows: 0,
          errors: [`Failed to parse file: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`],
          data: [],
        };
      }
      
      if (rawData.length === 0) {
        return {
          fileName: file.name,
          fileType: 'unknown',
          rowCount: 0,
          validRows: 0,
          errors: ['File is empty or contains no valid data rows'],
          data: [],
        };
      }
      
      // Step 3: Validate data structure
      const structureValidation = ErrorHandler.validateDataStructure(rawData, file.name);
      
      if (!structureValidation.isValid) {
        const errorMessages = structureValidation.errors.map(e => e.message);
        const warningMessages = structureValidation.warnings.map(w => `Warning: ${w.message}`);
        
        return {
          fileName: file.name,
          fileType: structureValidation.fileInfo.detectedFormat,
          rowCount: rawData.length,
          validRows: 0,
          errors: [...errorMessages, ...warningMessages],
          data: [],
        };
      }
      
      // Log structure validation results
      // Step 4: Map columns and validate based on expected type
      let mappedData: any[] = [];
      let validationResults: ValidationResult[] = [];
      let finalType: 'salary' | 'performance' | 'unknown' = expectedType;
      
      // Use detected format if type is unknown
      if (expectedType === 'unknown') {
        finalType = structureValidation.fileInfo.detectedFormat;
      }
      
      // Check if this is a combined salary+performance file (like RH format)
      const hasPerformanceColumns = rawData.length > 0 && Object.keys(rawData[0]).some(key => 
        key.toLowerCase().includes('performance') || key.toLowerCase().includes('rating')
      );
      
      try {
        if (finalType === 'salary' || finalType === 'unknown') {
  
          const salaryData = this.mapColumns(rawData, SALARY_COLUMN_MAPPINGS);
          
          // If this looks like a combined file, also map performance data
          if (hasPerformanceColumns) {

            const performanceData = this.mapColumns(rawData, PERFORMANCE_COLUMN_MAPPINGS);
            
            // Merge performance data into salary data
            salaryData.forEach((salaryRow, index) => {
              const performanceRow = performanceData[index];
              if (performanceRow) {
                // Add performance fields to salary row
                if (performanceRow.performanceRating) {
                  (salaryRow as any).performanceRating = performanceRow.performanceRating;
                }
                if (performanceRow.businessImpactScore) {
                  (salaryRow as any).businessImpactScore = performanceRow.businessImpactScore;
                }
                if (performanceRow.retentionRisk) {
                  (salaryRow as any).retentionRisk = performanceRow.retentionRisk;
                }
              }
            });
          }
          
          const salaryValidation = this.validateSalaryData(salaryData);
          const validSalaryRows = salaryValidation.filter(v => v.isValid).length;
          const salaryValidityRate = validSalaryRows / salaryValidation.length;
          

          
          if (salaryValidityRate > 0.1 || expectedType === 'salary') { // Very low threshold for better flexibility
            mappedData = salaryData;
            validationResults = salaryValidation;
            finalType = 'salary';
          } else if (expectedType === 'unknown') {
            // Try performance mapping

            const performanceData = this.mapColumns(rawData, PERFORMANCE_COLUMN_MAPPINGS);
            const performanceValidation = this.validatePerformanceData(performanceData);
            const validPerformanceRows = performanceValidation.filter(v => v.isValid).length;
            const performanceValidityRate = validPerformanceRows / performanceValidation.length;
            

            
            if (performanceValidityRate > salaryValidityRate) {
              mappedData = performanceData;
              validationResults = performanceValidation;
              finalType = 'performance';
            } else {
              mappedData = salaryData;
              validationResults = salaryValidation;
              finalType = 'salary';
            }
          }
        }
        
        if (finalType === 'performance') {
          const performanceData = this.mapColumns(rawData, PERFORMANCE_COLUMN_MAPPINGS);
          validationResults = this.validatePerformanceData(performanceData);
          mappedData = performanceData;
        }
        
      } catch (mappingError) {
        console.error('❌ Column mapping failed:', mappingError);
        return {
          fileName: file.name,
          fileType: finalType,
          rowCount: rawData.length,
          validRows: 0,
          errors: [`Column mapping failed: ${mappingError instanceof Error ? mappingError.message : 'Unknown mapping error'}`],
          data: [],
        };
      }
      
      // Step 5: Process validation results and prepare output

      const validRows = validationResults.filter(v => v.isValid);
      const allErrors: string[] = [];
      const allWarnings: string[] = [];
      
      // Collect validation errors and warnings
      validationResults.forEach((result, index) => {
        if (!result.isValid) {
          const rowErrors = result.errors.map(err => `Row ${index + 2}: ${err}`);
          allErrors.push(...rowErrors);
        }
        if (result.warnings.length > 0) {
          const rowWarnings = result.warnings.map(warn => `Row ${index + 2}: ${warn}`);
          allWarnings.push(...rowWarnings);
        }
      });
      
      // Add structure validation warnings to the output
      const structureWarnings = structureValidation.warnings.map(w => `Data structure: ${w.message}`);
      allWarnings.push(...structureWarnings);
      
      // Filter mapped data to only include valid rows
      const validMappedData = mappedData.filter((_, index) => 
        validationResults[index].isValid
      );
      
      // Combine errors and warnings for final output
      const finalErrors = [...allErrors];
      if (allWarnings.length > 0) {
        finalErrors.push(...allWarnings.map(w => `Warning: ${w}`));
      }
      

      
      return {
        fileName: file.name,
        fileType: finalType,
        rowCount: rawData.length,
        validRows: validRows.length,
        errors: finalErrors,
        data: validMappedData,
      };
      
    } catch (error) {
      console.error('❌ Critical error during file parsing:', error);
      
      // Return a structured error response
      return {
        fileName: file.name,
        fileType: 'unknown',
        rowCount: 0,
        validRows: 0,
        errors: [
          `Critical parsing error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          'Please check your file format and try again. Supported formats: CSV, XLSX, XLS',
          'Ensure your file contains the required columns: employeeId, name, and relevant data fields'
        ],
        data: [],
      };
    }
  }
} 