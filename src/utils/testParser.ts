import { DataParser } from '../services/dataParser';

// Helper to build a fake File from CSV text
function buildCsvFile(name: string, content: string): File {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], name, { type: 'text/csv' });
}

describe('DataParser CSV/XLSX header detection and mapping', () => {
  test('parses CSV where header is on first row', async () => {
    const csv = [
      'Employee Number,Employee Full name,Overall Performance Rating,Identified as Future Talent?,Movement Readiness',
      '1001,Jane Doe,Successful Performer,Yes,Ready Later',
    ].join('\n');

    const file = buildCsvFile('performance.csv', csv);
    const result = await DataParser.parseFile(file as any, 'performance');

    expect(result.fileType).toBe('performance');
    expect(result.validRows).toBe(1);
    const row: any = (result.data as any[])[0];
    expect(row.employeeId).toBe('1001');
    expect(row.name).toBe('Jane Doe');
    expect(row.performanceRating).toBe('Successful Performer');
    expect(row.futuretalent).toBe('Yes');
    expect(row.movementReadiness).toContain('Ready');
  });

  test('parses CSV where first row is blank and header is second row', async () => {
    const csv = [
      ',,,,,',
      'Employee Number,Employee Full name,Overall Performance Rating,Identified as Future Talent?,Movement Readiness',
      '1002,John Smith,High Impact Performer,No,Ready Now',
    ].join('\n');

    const file = buildCsvFile('performance-blank-first.csv', csv);
    const result = await DataParser.parseFile(file as any, 'performance');

    expect(result.fileType).toBe('performance');
    expect(result.validRows).toBe(1);
    const row: any = (result.data as any[])[0];
    expect(row.employeeId).toBe('1002');
    expect(row.name).toBe('John Smith');
    expect(row.performanceRating).toBe('High Impact Performer');
    expect(row.futuretalent).toBe('No');
    expect(row.movementReadiness).toBe('Ready Now');
  });
});

// Test function to validate parser works with example files
export async function testParserWithExampleFiles(): Promise<void> {
  try {
    console.log('🧪 Testing DataParser with example files...');
    
    // Test CSV file parsing
    console.log('\n📄 Testing CSV file...');
    const csvPath = new URL('../assets/RH_Compensation_Report_w_Hierarchy_-_Manager.csv', import.meta.url);
    const csvResponse = await fetch(csvPath);
    const csvBlob = await csvResponse.blob();
    const csvFile = new File([csvBlob], 'RH_Compensation_Report_w_Hierarchy_-_Manager.csv', { type: 'text/csv' });
    
    const csvResult = await DataParser.parseFile(csvFile, 'salary');
    console.log('CSV Results:', {
      fileName: csvResult.fileName,
      fileType: csvResult.fileType,
      rowCount: csvResult.rowCount,
      validRows: csvResult.validRows,
      errorCount: csvResult.errors.length,
      firstFewRows: csvResult.data.slice(0, 3)
    });
    
    // Test XLSX file parsing
    console.log('\n📊 Testing XLSX file...');
    const xlsxPath = new URL('../assets/Details_View.xlsx', import.meta.url);
    const xlsxResponse = await fetch(xlsxPath);
    const xlsxBlob = await xlsxResponse.blob();
    const xlsxFile = new File([xlsxBlob], 'Details_View.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const xlsxResult = await DataParser.parseFile(xlsxFile, 'unknown');
    console.log('XLSX Results:', {
      fileName: xlsxResult.fileName,
      fileType: xlsxResult.fileType,
      rowCount: xlsxResult.rowCount,
      validRows: xlsxResult.validRows,
      errorCount: xlsxResult.errors.length,
      firstFewRows: xlsxResult.data.slice(0, 3)
    });
    
    console.log('\n✅ Parser test completed successfully!');
    
    // Validate key fields were parsed correctly
    const sampleSalaryData = csvResult.data[0] as any;
    console.log('\n🔍 Sample parsed salary data:');
    console.log('Employee ID:', sampleSalaryData.employeeId);
    console.log('Name:', sampleSalaryData.name);
    console.log('Base Salary:', sampleSalaryData.baseSalary);
    console.log('Currency:', sampleSalaryData.currency);
    console.log('Country:', sampleSalaryData.country);
    console.log('Performance Rating:', sampleSalaryData.performanceRating);
    console.log('Salary Grade Min:', sampleSalaryData.salaryGradeMin);
    console.log('Salary Grade Mid:', sampleSalaryData.salaryGradeMid);
    console.log('Salary Grade Max:', sampleSalaryData.salaryGradeMax);
    
  } catch (error) {
    console.error('❌ Parser test failed:', error);
    throw error;
  }
}

// Manual test runner for development
if (typeof window !== 'undefined') {
  // Browser environment - can be called from console
  (window as any).testParser = testParserWithExampleFiles;
} 