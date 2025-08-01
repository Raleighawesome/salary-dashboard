import { DataParser } from '../services/dataParser';

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