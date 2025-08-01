// Comprehensive error handling utilities for file processing and data validation

export interface ValidationError {
  type: 'MISSING_COLUMN' | 'INVALID_DATA_TYPE' | 'MISSING_REQUIRED_DATA' | 'INVALID_FORMAT' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE_TYPE' | 'CORRUPTED_FILE' | 'DUPLICATE_DATA' | 'INCONSISTENT_DATA';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  field?: string;
  row?: number;
  value?: any;
  suggestion?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  fileInfo: {
    name: string;
    size: number;
    type: string;
    detectedFormat: 'salary' | 'performance' | 'unknown';
    rowCount: number;
    columnCount: number;
  };
  dataQuality: {
    completenessScore: number; // 0-100%
    consistencyScore: number; // 0-100%
    validRowCount: number;
    invalidRowCount: number;
    duplicateCount: number;
  };
}

export interface DataValidationOptions {
  strictMode: boolean;
  maxFileSize: number;
  requiredColumns: string[];
  allowedFileTypes: string[];
  maxRows: number;
  validateDataTypes: boolean;
  checkDuplicates: boolean;
}

// Default validation options
const DEFAULT_VALIDATION_OPTIONS: DataValidationOptions = {
  strictMode: false,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  requiredColumns: ['employeeId', 'name'],
  allowedFileTypes: ['.csv', '.xlsx', '.xls'],
  maxRows: 10000,
  validateDataTypes: true,
  checkDuplicates: true,
};

export class ErrorHandler {
  // Validate file before processing
  public static validateFile(
    file: File,
    options: Partial<DataValidationOptions> = {}
  ): ValidationError[] {
    const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const errors: ValidationError[] = [];

    console.log(`🔍 Validating file: ${file.name} (${file.size} bytes)`);

    // Check file size
    if (file.size > opts.maxFileSize) {
      errors.push({
        type: 'FILE_TOO_LARGE',
        severity: 'ERROR',
        message: `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(opts.maxFileSize)})`,
        suggestion: 'Please reduce the file size or split into smaller files',
      });
    }

    // Check file type
    const fileExtension = this.getFileExtension(file.name);
    if (!opts.allowedFileTypes.includes(fileExtension)) {
      errors.push({
        type: 'UNSUPPORTED_FILE_TYPE',
        severity: 'ERROR',
        message: `File type "${fileExtension}" is not supported`,
        suggestion: `Please use one of: ${opts.allowedFileTypes.join(', ')}`,
      });
    }

    // Check for empty file
    if (file.size === 0) {
      errors.push({
        type: 'CORRUPTED_FILE',
        severity: 'ERROR',
        message: 'File appears to be empty',
        suggestion: 'Please check the file and try again',
      });
    }

    return errors;
  }

  // Validate parsed data structure
  public static validateDataStructure(
    data: any[],
    fileName: string,
    options: Partial<DataValidationOptions> = {}
  ): FileValidationResult {
    const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    console.log(`🔍 Validating data structure for ${fileName}: ${data.length} rows`);
    
    if (data.length > 0) {
      console.log('📝 Available columns:', Object.keys(data[0]));
      console.log('🔍 Required columns:', opts.requiredColumns);
    }

    // Check if data is empty
    if (!data || data.length === 0) {
      errors.push({
        type: 'MISSING_REQUIRED_DATA',
        severity: 'ERROR',
        message: 'No data found in file',
        suggestion: 'Please check that the file contains data and is properly formatted',
      });

      return {
        isValid: false,
        errors,
        warnings,
        fileInfo: {
          name: fileName,
          size: 0,
          type: 'unknown',
          detectedFormat: 'unknown',
          rowCount: 0,
          columnCount: 0,
        },
        dataQuality: {
          completenessScore: 0,
          consistencyScore: 0,
          validRowCount: 0,
          invalidRowCount: 0,
          duplicateCount: 0,
        },
      };
    }

    // Get column information
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    const columnCount = columns.length;

    // Detect file format
    const detectedFormat = this.detectFileFormat(columns);

    // Check for required columns with flexible mapping
    const missingColumns = opts.requiredColumns.filter(col => {
      if (col === 'employeeId') {
        // Check for various employee ID column names
        return !columns.some(dataCol => {
          const normalizedCol = dataCol.toLowerCase().trim();
          return normalizedCol.includes('employee') && normalizedCol.includes('id') ||
                 normalizedCol.includes('employee') && normalizedCol.includes('number') ||
                 normalizedCol.includes('associate') && normalizedCol.includes('id') ||
                 normalizedCol === 'id' ||
                 normalizedCol === 'employeeid' ||
                 normalizedCol === 'emp_id';
        });
      }
      if (col === 'name') {
        // Check for various name column variations
        return !columns.some(dataCol => {
          const normalizedCol = dataCol.toLowerCase().trim();
          return normalizedCol.includes('name') ||
                 normalizedCol === 'worker' ||
                 normalizedCol.includes('employee') && normalizedCol.includes('full');
        });
      }
      // Default fallback for other columns
      return !columns.some(dataCol => 
        dataCol.toLowerCase().includes(col.toLowerCase())
      );
    });

    if (missingColumns.length > 0) {
      console.log('❌ Missing columns detected:', missingColumns);
      console.log('📋 Column matching details:');
      opts.requiredColumns.forEach(reqCol => {
        const found = missingColumns.includes(reqCol);
        console.log(`  - ${reqCol}: ${found ? '❌ MISSING' : '✅ FOUND'}`);
      });
      
      errors.push({
        type: 'MISSING_COLUMN',
        severity: 'ERROR',
        message: `Missing required columns: ${missingColumns.join(', ')}`,
        suggestion: 'Please ensure your file contains all required columns',
      });
    } else {
      console.log('✅ All required columns found');
    }

    // Analyze data quality
    const qualityResults = this.analyzeDataQuality(data);

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      fileInfo: {
        name: fileName,
        size: JSON.stringify(data).length,
        type: this.getFileExtension(fileName),
        detectedFormat,
        rowCount: data.length,
        columnCount,
      },
      dataQuality: qualityResults,
    };
  }

  // Detect file format based on column names
  private static detectFileFormat(columns: string[]): 'salary' | 'performance' | 'unknown' {
    const normalizedColumns = columns.map(col => col.toLowerCase());
    
    const salaryIndicators = ['salary', 'basesalary', 'compensation', 'pay'];
    const performanceIndicators = ['performance', 'rating', 'review', 'score'];
    
    const hasSalaryColumns = salaryIndicators.some(indicator => 
      normalizedColumns.some(col => col.includes(indicator))
    );
    
    const hasPerformanceColumns = performanceIndicators.some(indicator => 
      normalizedColumns.some(col => col.includes(indicator))
    );

    if (hasSalaryColumns && !hasPerformanceColumns) {
      return 'salary';
    } else if (hasPerformanceColumns && !hasSalaryColumns) {
      return 'performance';
    } else if (hasSalaryColumns && hasPerformanceColumns) {
      return 'salary'; // Combined file
    }

    return 'unknown';
  }

  // Analyze data quality
  private static analyzeDataQuality(data: any[]): {
    completenessScore: number;
    consistencyScore: number;
    validRowCount: number;
    invalidRowCount: number;
    duplicateCount: number;
  } {
    let validRowCount = 0;
    let totalFields = 0;
    let filledFields = 0;
    const seenRecords = new Set<string>();
    let duplicateCount = 0;

    for (const row of data) {
      let rowValid = true;
      const rowFields = Object.values(row);
      totalFields += rowFields.length;

      // Count filled fields
      const rowFilledFields = rowFields.filter(value => 
        value !== null && 
        value !== undefined && 
        value !== '' && 
        String(value).trim() !== ''
      ).length;
      filledFields += rowFilledFields;

      // Check for duplicates
      const identifier = row.employeeId || row.email || JSON.stringify(row);
      if (seenRecords.has(identifier)) {
        duplicateCount++;
        rowValid = false;
      } else {
        seenRecords.add(identifier);
      }

      if (rowValid) {
        validRowCount++;
      }
    }

    const completenessScore = totalFields > 0 ? (filledFields / totalFields) * 100 : 0;
    const consistencyScore = data.length > 0 ? (validRowCount / data.length) * 100 : 0;

    return {
      completenessScore,
      consistencyScore,
      validRowCount,
      invalidRowCount: data.length - validRowCount,
      duplicateCount,
    };
  }

  // Utility functions
  private static getFileExtension(fileName: string): string {
    return fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  }

  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format errors for user display
  public static formatErrorsForDisplay(result: FileValidationResult): {
    summary: string;
    details: string[];
    canProceed: boolean;
    recommendations: string[];
  } {
    const { errors, warnings, fileInfo, dataQuality } = result;
    
    let summary = '';
    const details: string[] = [];
    const recommendations: string[] = [];

    if (errors.length === 0 && warnings.length === 0) {
      summary = `✅ File validation passed! Found ${fileInfo.rowCount} rows with ${dataQuality.validRowCount} valid records.`;
    } else if (errors.length === 0) {
      summary = `⚠️ File has ${warnings.length} warnings but can be processed.`;
    } else {
      summary = `❌ File has ${errors.length} errors that must be fixed before processing.`;
    }

    // Add error details
    errors.forEach(error => {
      details.push(`❌ ${error.message}`);
      if (error.suggestion) {
        recommendations.push(error.suggestion);
      }
    });

    // Add warning details
    warnings.forEach(warning => {
      details.push(`⚠️ ${warning.message}`);
      if (warning.suggestion) {
        recommendations.push(warning.suggestion);
      }
    });

    return {
      summary,
      details,
      canProceed: errors.length === 0,
      recommendations: [...new Set(recommendations)],
    };
  }
} 