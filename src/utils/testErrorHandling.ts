// Test utility for error handling system
import { ErrorHandler, type FileValidationResult } from './errorHandling';

// Test data samples for validation
const createTestFile = (name: string, size: number, content: string): File => {
  const blob = new Blob([content], { type: 'text/csv' });
  Object.defineProperty(blob, 'name', { value: name });
  Object.defineProperty(blob, 'size', { value: size });
  return blob as File;
};

// Sample test data
const validSalaryData = [
  {
    employeeId: 'EMP001',
    email: 'john.doe@company.com',
    name: 'John Doe',
    baseSalary: 75000,
    currency: 'USD',
    country: 'US',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
  },
  {
    employeeId: 'EMP002',
    email: 'jane.smith@company.com',
    name: 'Jane Smith',
    baseSalary: 85000,
    currency: 'USD',
    country: 'US',
    department: 'Engineering',
    jobTitle: 'Senior Software Engineer',
  },
];

const invalidSalaryData = [
  {
    // Missing required fields
    name: 'Invalid Employee',
    baseSalary: 'not-a-number',
    currency: '',
  },
  {
    employeeId: 'EMP003',
    email: 'invalid-email',
    name: '',
    baseSalary: -50000,
    currency: 'INVALID',
  },
];

const mixedQualityData = [
  ...validSalaryData,
  ...invalidSalaryData,
  {
    employeeId: 'EMP004',
    email: 'partial@company.com',
    name: 'Partial Employee',
    // Missing salary data
    currency: 'EUR',
    country: 'DE',
  },
];

export class ErrorHandlingTester {
  // Test file validation
  public static testFileValidation(): void {
    console.log('🧪 Testing File Validation...\n');

    // Test valid file
    const validFile = createTestFile('salary_data.csv', 1024 * 1024, 'test content'); // 1MB
    const validErrors = ErrorHandler.validateFile(validFile);
    console.log('✅ Valid file test:', validErrors.length === 0 ? 'PASSED' : 'FAILED');
    if (validErrors.length > 0) {
      console.log('   Unexpected errors:', validErrors.map(e => e.message));
    }

    // Test oversized file
    const oversizedFile = createTestFile('large_file.csv', 100 * 1024 * 1024, 'content'); // 100MB
    const oversizedErrors = ErrorHandler.validateFile(oversizedFile);
    console.log('📏 Oversized file test:', oversizedErrors.some(e => e.type === 'FILE_TOO_LARGE') ? 'PASSED' : 'FAILED');

    // Test unsupported file type
    const unsupportedFile = createTestFile('data.txt', 1024, 'content');
    const unsupportedErrors = ErrorHandler.validateFile(unsupportedFile);
    console.log('🚫 Unsupported file test:', unsupportedErrors.some(e => e.type === 'UNSUPPORTED_FILE_TYPE') ? 'PASSED' : 'FAILED');

    // Test empty file
    const emptyFile = createTestFile('empty.csv', 0, '');
    const emptyErrors = ErrorHandler.validateFile(emptyFile);
    console.log('📄 Empty file test:', emptyErrors.some(e => e.type === 'CORRUPTED_FILE') ? 'PASSED' : 'FAILED');

    console.log('\n');
  }

  // Test data structure validation
  public static testDataStructureValidation(): void {
    console.log('🧪 Testing Data Structure Validation...\n');

    // Test valid data
    const validResult = ErrorHandler.validateDataStructure(validSalaryData, 'valid_salary.csv');
    console.log('✅ Valid data test:', validResult.isValid ? 'PASSED' : 'FAILED');
    console.log(`   Detected format: ${validResult.fileInfo.detectedFormat}`);
    console.log(`   Data quality: ${validResult.dataQuality.completenessScore.toFixed(1)}% complete`);

    // Test invalid data
    const invalidResult = ErrorHandler.validateDataStructure(invalidSalaryData, 'invalid_salary.csv');
    console.log('❌ Invalid data test:', !invalidResult.isValid ? 'PASSED' : 'FAILED');
    console.log(`   Errors found: ${invalidResult.errors.length}`);

    // Test empty data
    const emptyResult = ErrorHandler.validateDataStructure([], 'empty.csv');
    console.log('📄 Empty data test:', !emptyResult.isValid ? 'PASSED' : 'FAILED');

    // Test mixed quality data
    const mixedResult = ErrorHandler.validateDataStructure(mixedQualityData, 'mixed_quality.csv');
    console.log('⚠️ Mixed quality test:', mixedResult.isValid ? 'PASSED' : 'FAILED');
    console.log(`   Quality score: ${mixedResult.dataQuality.completenessScore.toFixed(1)}%`);
    console.log(`   Valid rows: ${mixedResult.dataQuality.validRowCount}/${mixedResult.fileInfo.rowCount}`);

    console.log('\n');
  }

  // Test error formatting
  public static testErrorFormatting(): void {
    console.log('🧪 Testing Error Formatting...\n');

    // Create a validation result with mixed errors and warnings
    const testResult: FileValidationResult = {
      isValid: false,
      errors: [
        {
          type: 'MISSING_COLUMN',
          severity: 'ERROR',
          message: 'Missing required column: employeeId',
          suggestion: 'Please add an employeeId column to your file',
        },
        {
          type: 'INVALID_DATA_TYPE',
          severity: 'ERROR',
          message: 'Invalid salary value in row 3',
          field: 'baseSalary',
          row: 3,
          value: 'not-a-number',
          suggestion: 'Salary should be a numeric value',
        },
      ],
      warnings: [
        {
          type: 'MISSING_REQUIRED_DATA',
          severity: 'WARNING',
          message: 'Some employees are missing email addresses',
          suggestion: 'Email addresses help with data accuracy',
        },
        {
          type: 'INCONSISTENT_DATA',
          severity: 'WARNING',
          message: 'Multiple currencies detected',
          suggestion: 'Consider enabling currency conversion',
        },
      ],
      fileInfo: {
        name: 'test_file.csv',
        size: 2048,
        type: '.csv',
        detectedFormat: 'salary',
        rowCount: 100,
        columnCount: 8,
      },
      dataQuality: {
        completenessScore: 75.5,
        consistencyScore: 82.3,
        validRowCount: 85,
        invalidRowCount: 15,
        duplicateCount: 3,
      },
    };

    const formatted = ErrorHandler.formatErrorsForDisplay(testResult);
    
    console.log('📋 Error formatting test:');
    console.log(`   Summary: ${formatted.summary}`);
    console.log(`   Can proceed: ${formatted.canProceed}`);
    console.log(`   Details count: ${formatted.details.length}`);
    console.log(`   Recommendations count: ${formatted.recommendations.length}`);
    
    console.log('\n   Formatted details:');
    formatted.details.forEach((detail, index) => {
      console.log(`   ${index + 1}. ${detail}`);
    });

    console.log('\n   Recommendations:');
    formatted.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    console.log('\n');
  }

  // Test format detection
  public static testFormatDetection(): void {
    console.log('🧪 Testing Format Detection...\n');

    // Test salary format detection
    const salaryData = [
      { employeeId: 'EMP001', name: 'John', baseSalary: 75000, currency: 'USD' }
    ];
    const salaryResult = ErrorHandler.validateDataStructure(salaryData, 'salary_test.csv');
    console.log('💰 Salary format detection:', salaryResult.fileInfo.detectedFormat === 'salary' ? 'PASSED' : 'FAILED');

    // Test performance format detection
    const performanceData = [
      { employeeId: 'EMP001', name: 'John', performanceRating: 4.5, businessImpact: 'High' }
    ];
    const performanceResult = ErrorHandler.validateDataStructure(performanceData, 'performance_test.csv');
    console.log('📈 Performance format detection:', performanceResult.fileInfo.detectedFormat === 'performance' ? 'PASSED' : 'FAILED');

    // Test unknown format detection
    const unknownData = [
      { id: '1', description: 'Some random data', value: 'test' }
    ];
    const unknownResult = ErrorHandler.validateDataStructure(unknownData, 'unknown_test.csv');
    console.log('❓ Unknown format detection:', unknownResult.fileInfo.detectedFormat === 'unknown' ? 'PASSED' : 'FAILED');

    console.log('\n');
  }

  // Test data quality analysis
  public static testDataQualityAnalysis(): void {
    console.log('🧪 Testing Data Quality Analysis...\n');

    // Test high quality data
    const highQualityResult = ErrorHandler.validateDataStructure(validSalaryData, 'high_quality.csv');
    console.log('⭐ High quality data test:');
    console.log(`   Completeness: ${highQualityResult.dataQuality.completenessScore.toFixed(1)}%`);
    console.log(`   Consistency: ${highQualityResult.dataQuality.consistencyScore.toFixed(1)}%`);
    console.log(`   Valid rows: ${highQualityResult.dataQuality.validRowCount}/${highQualityResult.fileInfo.rowCount}`);

    // Test low quality data
    const lowQualityResult = ErrorHandler.validateDataStructure(invalidSalaryData, 'low_quality.csv');
    console.log('\n💔 Low quality data test:');
    console.log(`   Completeness: ${lowQualityResult.dataQuality.completenessScore.toFixed(1)}%`);
    console.log(`   Consistency: ${lowQualityResult.dataQuality.consistencyScore.toFixed(1)}%`);
    console.log(`   Valid rows: ${lowQualityResult.dataQuality.validRowCount}/${lowQualityResult.fileInfo.rowCount}`);

    console.log('\n');
  }

  // Run all tests
  public static runAllTests(): void {
    console.log('🚀 Starting Error Handling System Tests\n');
    console.log('=' .repeat(50));

    this.testFileValidation();
    this.testDataStructureValidation();
    this.testFormatDetection();
    this.testDataQualityAnalysis();
    this.testErrorFormatting();

    console.log('=' .repeat(50));
    console.log('✅ Error Handling System Tests Completed!\n');
  }

  // Test with real-world scenarios
  public static testRealWorldScenarios(): void {
    console.log('🌍 Testing Real-World Scenarios...\n');

    // Scenario 1: HR file with missing data
    const hrFileWithMissingData = [
      { employeeId: 'EMP001', email: 'john@company.com', name: 'John Doe', baseSalary: 75000, currency: 'USD' },
      { employeeId: 'EMP002', email: '', name: 'Jane Smith', baseSalary: '', currency: 'USD' }, // Missing email and salary
      { employeeId: '', email: 'bob@company.com', name: 'Bob Johnson', baseSalary: 65000, currency: 'EUR' }, // Missing ID
    ];

    const hrResult = ErrorHandler.validateDataStructure(hrFileWithMissingData, 'hr_missing_data.csv');
    console.log('📊 HR file with missing data:');
    console.log(`   Completeness: ${hrResult.dataQuality.completenessScore.toFixed(1)}%`);
    console.log(`   Errors: ${hrResult.errors.length}, Warnings: ${hrResult.warnings.length}`);

    // Scenario 2: International company with multiple currencies
    const internationalData = [
      { employeeId: 'US001', name: 'Alice', baseSalary: 100000, currency: 'USD', country: 'US' },
      { employeeId: 'UK001', name: 'Bob', baseSalary: 75000, currency: 'GBP', country: 'UK' },
      { employeeId: 'DE001', name: 'Charlie', baseSalary: 80000, currency: 'EUR', country: 'DE' },
      { employeeId: 'IN001', name: 'David', baseSalary: 1500000, currency: 'INR', country: 'IN' },
    ];

    const intlResult = ErrorHandler.validateDataStructure(internationalData, 'international_salaries.csv');
    console.log('\n🌐 International company data:');
    console.log(`   Format detected: ${intlResult.fileInfo.detectedFormat}`);
    console.log(`   Data quality: ${intlResult.dataQuality.completenessScore.toFixed(1)}%`);
    console.log(`   Warnings: ${intlResult.warnings.length}`);

    console.log('\n');
  }
}

// Export for use in development/testing
export default ErrorHandlingTester; 