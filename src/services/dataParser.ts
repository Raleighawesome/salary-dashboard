import Papa from 'papaparse';
import * as XLSX from '@e965/xlsx';
import { ErrorHandler } from '../utils/errorHandling';
import type { 
  SalarySheetRow, 
  PerformanceSheetRow, 
  FileUploadResult,
  ValidationResult 
} from '../types/employee';

// Required columns for different file types
const REQUIRED_SALARY_COLUMNS = ['employeeId', 'name', 'baseSalary'];
const REQUIRED_PERFORMANCE_COLUMNS = ['employeeId', 'name'];

// Workday-specific metadata patterns to ignore
const WORKDAY_METADATA_PATTERNS = [
  /^report\s*generated/i,
  /^run\s*date/i,
  /^filters\s*applied/i,
  /^parameters/i,
  /^total\s*count/i,
  /^\s*$/, // Empty rows
  /^page\s*\d+/i,
  /^workday/i,
  /^report\s*name/i,
  /^company/i,
  /^export\s*date/i,
];

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
  
  // Fix: Map "identified as future talent?" to futuretalent, not retentionRisk
  'identified as future talent?': 'futuretalent',
  'identified as future talent? (current)': 'futuretalent',
  
  // Add missing movement readiness mapping for non-calibrated data
  'movement readiness': 'movementReadiness',
};

export class DataParser {
  
  // Auto-clean Workday exports by removing metadata and empty rows
  private static cleanWorkdayData(rawData: any[]): { cleanedData: any[], detectedHeaderRow: number, removedRows: number } {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return { cleanedData: [], detectedHeaderRow: -1, removedRows: 0 };
    }

    let headerRowIndex = -1;
    let removedRows = 0;
    
    // Find the actual header row by looking for data patterns
    for (let i = 0; i < Math.min(rawData.length, 20); i++) {
      const row = rawData[i];
      
      // Skip if row is empty or has very few non-empty cells
      if (!row || (Array.isArray(row) && row.filter(cell => cell && cell.toString().trim()).length < 3)) {
        removedRows++;
        continue;
      }
      
      // Check if this row matches Workday metadata patterns
      // For array-based rows (pre-header XLSX extraction), we can safely scan the first cell.
      // For object-based rows (already header-mapped), do NOT treat empty first property as metadata,
      // since many real data rows legitimately have blanks in the first column (e.g., "Ratings Changed?").
      let isMetadata = false;
      if (Array.isArray(row)) {
        const firstCell = row[0];
        isMetadata = WORKDAY_METADATA_PATTERNS.some(pattern => 
          pattern.test(String(firstCell || '').trim())
        );
      } else {
        isMetadata = false;
      }
      
      if (isMetadata) {
        removedRows++;
        continue;
      }
      
      // Check if this looks like a header row
      if (Array.isArray(row)) {
        // For array format, check if cells contain typical header names
        const hasHeaderLikeContent = row.some(cell => {
          const cellStr = String(cell || '').toLowerCase();
          return cellStr.includes('employee') || 
                 cellStr.includes('name') || 
                 cellStr.includes('salary') || 
                 cellStr.includes('performance') ||
                 cellStr.includes('comparatio') ||
                 cellStr.includes('grade');
        });
        
        if (hasHeaderLikeContent) {
          headerRowIndex = i;
          break;
        }
      } else {
        // For object format, this is already processed data
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      // No clear header found, assume first non-empty row is header
      headerRowIndex = removedRows;
    }
    
    // Clean the data starting from the header row
    const cleanedData = rawData.slice(headerRowIndex);
    
    // Remove any remaining empty rows
    const finalCleanedData = cleanedData.filter(row => {
      if (!row) return false;
      
      if (Array.isArray(row)) {
        return row.some(cell => cell && cell.toString().trim());
      } else {
        return Object.values(row).some(value => value && value.toString().trim());
      }
    });
    
    const totalRemovedRows = rawData.length - finalCleanedData.length;
    
    return { 
      cleanedData: finalCleanedData, 
      detectedHeaderRow: headerRowIndex,
      removedRows: totalRemovedRows 
    };
  }
  
  // Validate that required columns are present after mapping
  private static validateRequiredColumns(
    mappedData: any[], 
    fileType: 'salary' | 'performance'
  ): { isValid: boolean; missingColumns: string[]; errors: string[] } {
    const requiredColumns = fileType === 'salary' ? REQUIRED_SALARY_COLUMNS : REQUIRED_PERFORMANCE_COLUMNS;
    const errors: string[] = [];
    const missingColumns: string[] = [];
    
    if (mappedData.length === 0) {
      return { isValid: false, missingColumns: [], errors: ['No data rows found after cleaning'] };
    }
    
    // Check if required columns exist in the mapped data
    const firstRow = mappedData[0];
    const availableColumns = Object.keys(firstRow);
    
    for (const requiredCol of requiredColumns) {
      if (!availableColumns.includes(requiredCol)) {
        missingColumns.push(requiredCol);
      }
    }
    
    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
    }
    
    // Additional validation for salary files
    if (fileType === 'salary') {
      const rowsWithValidSalary = mappedData.filter(row => {
        const salary = parseFloat(row.baseSalary);
        return !isNaN(salary) && salary > 0;
      });
      
      if (rowsWithValidSalary.length === 0) {
        errors.push('No rows contain valid salary data');
      } else if (rowsWithValidSalary.length < mappedData.length * 0.5) {
        errors.push(`Only ${rowsWithValidSalary.length} of ${mappedData.length} rows contain valid salary data`);
      }
    }
    
    return { 
      isValid: missingColumns.length === 0 && errors.length === 0, 
      missingColumns, 
      errors 
    };
  }
  
  // Detect Workday file format and suggest corrections
  private static analyzeWorkdayFormat(rawData: any[]): {
    isWorkdayFormat: boolean;
    formatType: 'compensation' | 'talent' | 'unknown';
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    let isWorkdayFormat = false;
    let formatType: 'compensation' | 'talent' | 'unknown' = 'unknown';
    
    // Look for Workday-specific column patterns
    const allText = JSON.stringify(rawData).toLowerCase();
    
    if (allText.includes('workday') || allText.includes('compensation report') || allText.includes('hierarchy')) {
      isWorkdayFormat = true;
      
      if (allText.includes('compensation') || allText.includes('salary') || allText.includes('grade')) {
        formatType = 'compensation';
        suggestions.push('Detected Workday Compensation Report format');
      } else if (allText.includes('talent') || allText.includes('performance') || allText.includes('calibration')) {
        formatType = 'talent';
        suggestions.push('Detected Workday Talent Assessment format');
      }
    }
    
    // Check for common Workday export issues
    if (rawData.length > 0 && Array.isArray(rawData[0])) {
      const hasEmptyFirstRows = rawData.slice(0, 5).every((row: any[]) => 
        !row || row.filter((cell: any) => cell && cell.toString().trim()).length < 2
      );
      
      if (hasEmptyFirstRows) {
        suggestions.push('File contains metadata rows that will be automatically cleaned');
      }
    }
    
    return { isWorkdayFormat, formatType, suggestions };
  }
  // Parse CSV file using Papaparse with robust header detection
  // NOTE: Some Workday exports place a blank or metadata row first and the real
  // headers on the second row. We scan the first N rows to detect the header.
  private static async parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: false,
        complete: (results) => {
          try {
            const rows: any[][] = results.data as any[][];
            if (!Array.isArray(rows) || rows.length === 0) {
              resolve([]);
              return;
            }

            // Find header row among the first few rows (accounts for empty first row)
            let headerRowIndex = -1;
            let headers: string[] = [];

            for (let i = 0; i < Math.min(rows.length, 20); i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              // Count meaningful cells
              const nonEmpty = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
              if (nonEmpty.length < 3) continue;

              const rowText = row.map(c => String(c || '')).join(' ').toLowerCase();
              const hasHeaderKeywords = [
                'employee', 'associate', 'name', 'worker', 'id', 'salary', 'performance',
                'rating', 'talent', 'calibrated', 'movement', 'readiness', 'manager', 'department'
              ].some(k => rowText.includes(k));

              if (hasHeaderKeywords) {
                headerRowIndex = i;
                headers = row.map(c => String(c || '').trim());
                break;
              }
            }

            // Fallback: first non-empty row
            if (headerRowIndex === -1) {
              for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const row = rows[i];
                if (row && row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length >= 3) {
                  headerRowIndex = i;
                  headers = row.map(c => String(c || '').trim());
                  break;
                }
              }
            }

            if (headerRowIndex === -1 || headers.length === 0) {
              throw new Error('Could not detect headers in CSV file');
            }

            // Normalize headers and build objects for subsequent rows
            const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
            const dataRows = rows.slice(headerRowIndex + 1).filter(r => Array.isArray(r));

            const objects = dataRows
              .map((row) => {
                const obj: Record<string, any> = {};
                normalizedHeaders.forEach((h, idx) => {
                  const val = row[idx];
                  obj[h] = val !== null && val !== undefined ? String(val).trim() : '';
                });
                return obj;
              })
              // Keep rows that have at least a couple of non-empty values
              .filter(obj => Object.values(obj).filter(v => v !== '').length >= Math.min(2, normalizedHeaders.length * 0.2));

            resolve(objects);
          } catch (err) {
            reject(err);
          }
        },
        error: (error) => reject(error),
      });
    });
  }

  // Parse XLSX file with enhanced empty row and header detection
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
          
          // Get raw data with blank rows to see the full structure
      const rawDataWithBlanks: any[][] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: true,
            range: undefined // Read entire sheet
          });
          
          console.log(`📊 XLSX parsing - found ${rawDataWithBlanks.length} total rows`);
          console.log(`📋 First 5 rows:`, rawDataWithBlanks.slice(0, 5));
          
          // Find the actual header row by scanning for column names
          let headerRowIndex = -1;
          let headers: string[] = [];
          
          for (let i = 0; i < Math.min(rawDataWithBlanks.length, 20); i++) {
            const row = rawDataWithBlanks[i] as any[];
            
            // Skip completely empty rows
            if (!row || row.length === 0 || row.every((cell: any) => !cell || cell.toString().trim() === '')) {
              console.log(`📋 Skipping empty row ${i}`);
              continue;
            }
            
            // Count non-empty cells
            const nonEmptyCells = row.filter((cell: any) => cell && cell.toString().trim() !== '');
            console.log(`📋 Row ${i} has ${nonEmptyCells.length} non-empty cells:`, nonEmptyCells.slice(0, 5));
            
            if (nonEmptyCells.length >= 3) { // Need at least 3 columns for a valid header
              // Check if this looks like a header row
              const rowText = row.join(' ').toLowerCase();
              const hasHeaderKeywords = [
                'employee', 'name', 'id', 'salary', 'performance', 'rating', 
                'comparatio', 'grade', 'manager', 'department', 'email', 'worker',
                'business title', 'job', 'talent', 'assessment', 'calibration'
              ].some(keyword => rowText.includes(keyword));
              
              console.log(`📋 Row ${i} header keywords check:`, hasHeaderKeywords, '- content:', rowText.substring(0, 100));
              
              if (hasHeaderKeywords) {
                headerRowIndex = i;
                headers = row
                  .map(cell => cell ? cell.toString().trim() : '')
                  .filter(cell => cell !== ''); // Keep all non-empty headers
                
                console.log(`✅ Found header row at index ${i} with ${headers.length} columns`);
                console.log(`📋 Headers:`, headers.slice(0, 10));
                break;
              }
            }
          }
          
          // If no keyword-based header found, look for first row with sufficient data
          if (headerRowIndex === -1) {
            for (let i = 0; i < Math.min(rawDataWithBlanks.length, 10); i++) {
              const row = rawDataWithBlanks[i] as any[];
              if (row && row.filter(cell => cell && cell.toString().trim()).length >= 3) {
                headerRowIndex = i;
                headers = row
                  .map(cell => cell ? cell.toString().trim() : '')
                  .filter(cell => cell !== '');
                
                console.log(`📋 Using first data row as headers at index ${i}`);
                break;
              }
            }
          }
          
          if (headerRowIndex === -1 || headers.length === 0) {
            reject(new Error('Could not find valid header row in XLSX file. Please ensure the file contains column headers.'));
            return;
          }
          
          // Normalize headers to lowercase for consistent mapping
          const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
          
          // Extract data rows starting after the header
          const dataRows: any[][] = rawDataWithBlanks.slice(headerRowIndex + 1)
            .filter((row: any[], index: number) => {
              if (!row || row.length === 0) return false;
              
              // Keep rows that have meaningful data
              const nonEmptyValues = row.filter((cell: any) => 
                cell !== null && 
                cell !== undefined && 
                cell !== '' && 
                String(cell).trim() !== ''
              );
              
              const hasMinimumData = nonEmptyValues.length >= Math.min(2, headers.length * 0.2);
              
              if (!hasMinimumData) {
                console.log(`📋 Filtering out row ${headerRowIndex + 1 + index} - insufficient data:`, nonEmptyValues.length, 'values');
              }
              
              return hasMinimumData;
            });
          
          console.log(`📊 Processing ${dataRows.length} data rows from XLSX`);
          
          // Convert to objects using detected headers
          const objects = dataRows.map((row: any[]) => {
            const obj: any = {};
            
            // Map each header to its corresponding cell value
            normalizedHeaders.forEach((header, colIndex) => {
              const cellValue = row[colIndex];
              obj[header] = cellValue !== null && cellValue !== undefined 
                ? cellValue.toString().trim() 
                : '';
            });
            
            return obj;
          });
          
          if (objects.length === 0) {
            reject(new Error('No valid data rows found after header row. Please check that your file contains employee data.'));
            return;
          }
          
          console.log(`✅ Successfully parsed XLSX: ${objects.length} rows, ${normalizedHeaders.length} columns`);
          console.log(`📋 Sample row:`, objects[0]);
          console.log(`📋 Available columns:`, normalizedHeaders.slice(0, 15));
          
          resolve(objects);
        } catch (error) {
          console.error('❌ XLSX parsing error:', error);
          reject(new Error(`XLSX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read XLSX file'));
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
           // New CSV parser returns array of objects directly
           rawData = await this.parseCSV(file);
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
      
      // Step 2.5: Analyze Workday format and auto-clean data
      const workdayAnalysis = this.analyzeWorkdayFormat(rawData);
      const cleaningResult = this.cleanWorkdayData(rawData);
      
      console.log(`📊 Data cleaning results:`, {
        originalRows: rawData.length,
        cleanedRows: cleaningResult.cleanedData.length,
        removedRows: cleaningResult.removedRows,
        detectedHeaderRow: cleaningResult.detectedHeaderRow,
        isWorkdayFormat: workdayAnalysis.isWorkdayFormat,
        formatType: workdayAnalysis.formatType
      });
      
      // Use cleaned data for further processing
      rawData = cleaningResult.cleanedData;
      
      if (rawData.length === 0) {
        return {
          fileName: file.name,
          fileType: 'unknown',
          rowCount: cleaningResult.removedRows,
          validRows: 0,
          errors: ['File contains no valid data rows after cleaning metadata'],
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
      const hasPerformanceColumns = rawData.length > 0 && Object.keys(rawData[0]).some(key => {
        const lowerKey = key.toLowerCase();
        return lowerKey.includes('performance') || 
               lowerKey.includes('rating') ||
               lowerKey.includes('talent') ||
               lowerKey.includes('calibrated') ||
               lowerKey.includes('movement') ||
               lowerKey.includes('readiness');
      });
      
      
      try {
        if (finalType === 'salary' || finalType === 'unknown') {
  
          const salaryData = this.mapColumns(rawData, SALARY_COLUMN_MAPPINGS);
          
          // If this looks like a combined file, also map performance data
          if (hasPerformanceColumns) {
            console.log('🔍 Performance columns detected, mapping performance data...');

            const performanceData = this.mapColumns(rawData, PERFORMANCE_COLUMN_MAPPINGS);
            console.log('🔍 Sample mapped performance data:', performanceData[0]);
            
            // Merge performance data into salary data
            salaryData.forEach((salaryRow, index) => {
              const performanceRow = performanceData[index];
              if (performanceRow) {
                // Add performance fields to salary row (including empty/null values)
                // Use !== undefined check instead of truthy check to preserve empty strings and nulls
                if (performanceRow.performanceRating !== undefined) {
                  (salaryRow as any).performanceRating = performanceRow.performanceRating;
                }
                if (performanceRow.businessImpactScore !== undefined) {
                  (salaryRow as any).businessImpactScore = performanceRow.businessImpactScore;
                }
                if (performanceRow.retentionRisk !== undefined) {
                  (salaryRow as any).retentionRisk = performanceRow.retentionRisk;
                }
                // Add missing performance fields
                if (performanceRow.futuretalent !== undefined) {
                  (salaryRow as any).futuretalent = performanceRow.futuretalent;
                }
                if (performanceRow.movementReadiness !== undefined) {
                  (salaryRow as any).movementReadiness = performanceRow.movementReadiness;
                }
                if (performanceRow.proposedTalentActions !== undefined) {
                  (salaryRow as any).proposedTalentActions = performanceRow.proposedTalentActions;
                }
                
              }
            });
          }
          
          // Validate required columns for salary data
          const requiredColumnValidation = this.validateRequiredColumns(salaryData, 'salary');
          if (!requiredColumnValidation.isValid) {
            return {
              fileName: file.name,
              fileType: 'salary',
              rowCount: rawData.length + cleaningResult.removedRows,
              validRows: 0,
              errors: [
                ...requiredColumnValidation.errors,
                ...workdayAnalysis.suggestions.map(s => `Info: ${s}`)
              ],
              data: [],
            };
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
          
          // Validate required columns for performance data
          const requiredColumnValidation = this.validateRequiredColumns(performanceData, 'performance');
          if (!requiredColumnValidation.isValid) {
            return {
              fileName: file.name,
              fileType: 'performance',
              rowCount: rawData.length + cleaningResult.removedRows,
              validRows: 0,
              errors: [
                ...requiredColumnValidation.errors,
                ...workdayAnalysis.suggestions.map(s => `Info: ${s}`)
              ],
              data: [],
            };
          }
          
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
      
      // Add Workday-specific analysis results
      if (workdayAnalysis.isWorkdayFormat) {
        allWarnings.push(`Workday format detected: ${workdayAnalysis.formatType}`);
      }
      if (cleaningResult.removedRows > 0) {
        allWarnings.push(`Auto-cleaned ${cleaningResult.removedRows} metadata/empty rows`);
      }
      workdayAnalysis.suggestions.forEach(suggestion => {
        allWarnings.push(`Info: ${suggestion}`);
      });
      
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
        rowCount: rawData.length + cleaningResult.removedRows, // Include cleaned rows in total count
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