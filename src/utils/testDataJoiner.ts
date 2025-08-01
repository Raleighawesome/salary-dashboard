import { DataJoiner, type JoinOptions } from '../services/dataJoiner';
import { DataProcessor } from '../services/dataProcessor';
import type { SalarySheetRow, PerformanceSheetRow } from '../types/employee';

// Sample test data
const sampleSalaryData: SalarySheetRow[] = [
  {
    employeeId: 'EMP001',
    email: 'john.doe@company.com',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    country: 'US',
    currency: 'USD',
    baseSalary: 85000,
    timeInRole: 24,
    salaryGradeMin: 70000,
    salaryGradeMid: 85000,
    salaryGradeMax: 100000,
    departmentCode: 'ENG',
    jobTitle: 'Software Engineer',
    managerId: 'MGR001',
  },
  {
    employeeId: 'EMP002',
    email: 'jane.smith@company.com',
    name: 'Jane Smith',
    firstName: 'Jane',
    lastName: 'Smith',
    country: 'US',
    currency: 'USD',
    baseSalary: 95000,
    timeInRole: 36,
    salaryGradeMin: 80000,
    salaryGradeMid: 95000,
    salaryGradeMax: 110000,
    departmentCode: 'ENG',
    jobTitle: 'Senior Software Engineer',
    managerId: 'MGR001',
  },
  {
    employeeId: 'EMP003',
    email: 'alice.johnson@company.com',
    name: 'Alice Johnson',
    firstName: 'Alice',
    lastName: 'Johnson',
    country: 'IN',
    currency: 'INR',
    baseSalary: 1500000,
    timeInRole: 18,
    salaryGradeMin: 1200000,
    salaryGradeMid: 1500000,
    salaryGradeMax: 1800000,
    departmentCode: 'ENG',
    jobTitle: 'Software Engineer',
    managerId: 'MGR002',
  },
  {
    // This employee has no performance data match
    employeeId: 'EMP004',
    email: 'bob.wilson@company.com',
    name: 'Bob Wilson',
    firstName: 'Bob',
    lastName: 'Wilson',
    country: 'US',
    currency: 'USD',
    baseSalary: 78000,
    timeInRole: 12,
    salaryGradeMin: 65000,
    salaryGradeMid: 80000,
    salaryGradeMax: 95000,
    departmentCode: 'QA',
    jobTitle: 'QA Engineer',
    managerId: 'MGR003',
  },
];

const samplePerformanceData: PerformanceSheetRow[] = [
  {
    employeeId: 'EMP001',
    email: 'john.doe@company.com',
    name: 'John Doe',
    performanceRating: 4.2,
    retentionRisk: 30,
    businessImpactScore: 85,
  },
  {
    employeeId: 'EMP002',
    email: 'jane.smith@company.com',
    name: 'Jane Smith',
    performanceRating: 4.8,
    retentionRisk: 15,
    businessImpactScore: 95,
  },
  {
    employeeId: 'EMP003',
    email: 'alice.johnson@company.com',
    name: 'Alice Johnson',
    performanceRating: 3.9,
    retentionRisk: 45,
    businessImpactScore: 78,
  },
  {
    // This performance record has no salary match
    employeeId: 'EMP005',
    email: 'charlie.brown@company.com',
    name: 'Charlie Brown',
    performanceRating: 4.1,
    retentionRisk: 25,
    businessImpactScore: 82,
  },
];

// Test different matching scenarios
const edgeCaseData: {
  salary: SalarySheetRow[];
  performance: PerformanceSheetRow[];
} = {
  salary: [
    {
      // Test name normalization - "Last, First" format
      employeeId: 'EMP100',
      email: 'test1@company.com',
      name: 'Johnson, Mike',
      country: 'US',
      currency: 'USD',
      baseSalary: 70000,
      timeInRole: 15,
    },
    {
      // Test email-only matching (no employee ID)
      email: 'test2@company.com',
      name: 'Sarah Connor',
      country: 'US',
      currency: 'USD',
      baseSalary: 88000,
      timeInRole: 22,
    },
    {
      // Test fuzzy name matching
      employeeId: 'EMP102',
      name: 'Robert Smith Jr',
      country: 'US',
      currency: 'USD',
      baseSalary: 92000,
      timeInRole: 30,
    },
  ],
  performance: [
    {
      employeeId: 'EMP100',
      email: 'test1@company.com',
      name: 'Mike Johnson', // Different name format
      performanceRating: 3.8,
      retentionRisk: 40,
    },
    {
      // Email match only
      email: 'test2@company.com',
      name: 'Sarah T Connor', // Slightly different name
      performanceRating: 4.5,
      retentionRisk: 20,
    },
    {
      employeeId: 'EMP102',
      name: 'Bob Smith', // Fuzzy name match
      performanceRating: 4.0,
      retentionRisk: 35,
    },
  ],
};

export class DataJoinerTester {
  // Test basic joining functionality
  public static async testBasicJoin(): Promise<void> {
    console.log('\n🧪 Testing Basic Data Joining');
    console.log('==============================');

    const result = DataJoiner.joinSalaryAndPerformanceData(
      sampleSalaryData,
      samplePerformanceData
    );

    console.log(`✅ Join Results:`);
    console.log(`   - Total salary records: ${result.joinSummary.totalSalaryRows}`);
    console.log(`   - Total performance records: ${result.joinSummary.totalPerformanceRows}`);
    console.log(`   - Successful joins: ${result.joinSummary.successfulJoins}`);
    console.log(`   - Email matches: ${result.joinSummary.emailMatches}`);
    console.log(`   - ID matches: ${result.joinSummary.idMatches}`);
    console.log(`   - Unmatched salary: ${result.joinSummary.unmatchedSalary}`);
    console.log(`   - Unmatched performance: ${result.joinSummary.unmatchedPerformance}`);

    // Display joined employees
    console.log('\n📋 Joined Employees:');
    result.joinedEmployees.forEach((emp, index) => {
      console.log(`   ${index + 1}. ${emp.name} (${emp.employeeId})`);
      console.log(`      - Salary: ${emp.currency} ${emp.baseSalary.toLocaleString()}`);
      console.log(`      - Performance: ${emp.performanceRating || 'N/A'}`);
      console.log(`      - Retention Risk: ${emp.retentionRisk}%`);
      console.log(`      - Comparatio: ${emp.comparatio || 'N/A'}%`);
    });

    // Display validation issues
    const invalidEmployees = result.validationResults.filter(r => !r.isValid);
    if (invalidEmployees.length > 0) {
      console.log('\n❌ Validation Errors:');
      invalidEmployees.forEach(emp => {
        console.log(`   - ${emp.employeeId}: ${emp.errors.join(', ')}`);
      });
    }

    const employeesWithWarnings = result.validationResults.filter(r => r.warnings.length > 0);
    if (employeesWithWarnings.length > 0) {
      console.log('\n⚠️  Validation Warnings:');
      employeesWithWarnings.forEach(emp => {
        console.log(`   - ${emp.employeeId}: ${emp.warnings.join(', ')}`);
      });
    }
  }

  // Test edge cases and different matching strategies
  public static async testEdgeCases(): Promise<void> {
    console.log('\n🔬 Testing Edge Cases');
    console.log('=====================');

    // Test different join options
    const testOptions: JoinOptions[] = [
      { preferEmailMatch: true },
      { preferEmailMatch: false },
      { requireExactNameMatch: true },
      { requireExactNameMatch: false },
    ];

    for (const options of testOptions) {
      console.log(`\n📝 Testing with options:`, options);
      
      const result = DataJoiner.joinSalaryAndPerformanceData(
        edgeCaseData.salary,
        edgeCaseData.performance,
        options
      );

      console.log(`   Successful joins: ${result.joinSummary.successfulJoins}/3`);
      console.log(`   Email matches: ${result.joinSummary.emailMatches}`);
      console.log(`   ID matches: ${result.joinSummary.idMatches}`);
      
      // Show which employees were matched
      result.joinedEmployees.forEach(emp => {
        const hasPerf = emp.performanceRating !== undefined;
        console.log(`   - ${emp.name}: ${hasPerf ? '✅ Matched' : '❌ No match'}`);
      });
    }
  }

  // Test full processing workflow
  public static async testFullProcessing(): Promise<void> {
    console.log('\n🚀 Testing Full Processing Workflow');
    console.log('===================================');

    // Clear any existing data
    DataProcessor.clearAllData();

    // Simulate processing salary file
    const salaryFileResult = {
      fileName: 'test_salary.csv',
      fileType: 'salary' as const,
      validRows: sampleSalaryData.length,
      totalRows: sampleSalaryData.length,
      rowCount: sampleSalaryData.length,
      data: sampleSalaryData,
      errors: [],
      warnings: [],
    };

    await DataProcessor.processUploadedFile(salaryFileResult);
    console.log('📄 Processed salary file');

    // Simulate processing performance file
    const performanceFileResult = {
      fileName: 'test_performance.xlsx',
      fileType: 'performance' as const,
      validRows: samplePerformanceData.length,
      totalRows: samplePerformanceData.length,
      rowCount: samplePerformanceData.length,
      data: samplePerformanceData,
      errors: [],
      warnings: [],
    };

    await DataProcessor.processUploadedFile(performanceFileResult);
    console.log('📊 Processed performance file');

    // Get processing result
    const result = await DataProcessor.processEmployeeData();
    
    console.log('\n📈 Processing Results:');
    console.log(`   Files processed: ${result.processingReport.filesProcessed}`);
    console.log(`   Total rows parsed: ${result.processingReport.totalRowsParsed}`);
    console.log(`   Valid employees: ${result.processingReport.validEmployees}`);
    
    if (result.processingReport.joinReport) {
      console.log(`   Successful joins: ${result.processingReport.joinReport.successfulJoins}`);
    }

    if (result.processingReport.errors.length > 0) {
      console.log('\n❌ Processing Errors:');
      result.processingReport.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }

    if (result.processingReport.warnings.length > 0) {
      console.log('\n⚠️  Processing Warnings:');
      result.processingReport.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }

    // Get processing statistics
    const stats = DataProcessor.getProcessingStatistics();
    console.log('\n📊 Processing Statistics:');
    console.log(`   Average comparatio: ${stats.averageComparatio}%`);
    console.log(`   Employees with performance data: ${stats.employeesWithPerformanceData}/${stats.processedEmployees}`);
    console.log(`   Currency distribution:`, stats.currencyDistribution);
    console.log(`   Country distribution:`, stats.countryDistribution);
  }

  // Run all tests
  public static async runAllTests(): Promise<void> {
    console.log('🎯 Starting Data Joiner Tests');
    console.log('=============================');
    
    try {
      await this.testBasicJoin();
      await this.testEdgeCases();
      await this.testFullProcessing();
      
      console.log('\n✅ All tests completed successfully!');
    } catch (error) {
      console.error('\n❌ Test failed:', error);
    }
  }

  // Generate sample data for manual testing
  public static generateSampleData(): {
    salaryData: SalarySheetRow[];
    performanceData: PerformanceSheetRow[];
  } {
    return {
      salaryData: sampleSalaryData,
      performanceData: samplePerformanceData,
    };
  }
} 