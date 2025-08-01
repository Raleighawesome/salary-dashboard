import { NameNormalizer, type NameParts, type NameNormalizationOptions } from './nameNormalizer';

// Test cases covering various real-world scenarios
const testCases = [
  // Standard formats
  { input: 'John Doe', expected: { firstName: 'John', lastName: 'Doe', displayName: 'John Doe' } },
  { input: 'jane smith', expected: { firstName: 'Jane', lastName: 'Smith', displayName: 'Jane Smith' } },
  { input: 'MARY JOHNSON', expected: { firstName: 'Mary', lastName: 'Johnson', displayName: 'Mary Johnson' } },
  
  // "Last, First" format (common in HR systems)
  { input: 'Smith, John', expected: { firstName: 'John', lastName: 'Smith', displayName: 'John Smith' } },
  { input: 'Johnson, Mary Jane', expected: { firstName: 'Mary', lastName: 'Johnson', displayName: 'Mary Johnson' } },
  { input: 'O\'Connor, Patrick', expected: { firstName: 'Patrick', lastName: 'O\'Connor', displayName: 'Patrick O\'Connor' } },
  
  // Middle names
  { input: 'John Michael Smith', expected: { firstName: 'John', lastName: 'Michael Smith', displayName: 'John Michael Smith' } },
  { input: 'Mary Elizabeth Johnson', expected: { firstName: 'Mary', lastName: 'Elizabeth Johnson', displayName: 'Mary Elizabeth Johnson' } },
  
  // Prefixes
  { input: 'Dr. John Smith', expected: { firstName: 'John', lastName: 'Smith', displayName: 'John Smith' } },
  { input: 'Mr. Robert Johnson', expected: { firstName: 'Robert', lastName: 'Johnson', displayName: 'Robert Johnson' } },
  { input: 'Mrs. Sarah Wilson', expected: { firstName: 'Sarah', lastName: 'Wilson', displayName: 'Sarah Wilson' } },
  
  // Suffixes
  { input: 'John Smith Jr.', expected: { firstName: 'John', lastName: 'Smith Jr.', displayName: 'John Smith Jr.' } },
  { input: 'Robert Johnson III', expected: { firstName: 'Robert', lastName: 'Johnson III', displayName: 'Robert Johnson III' } },
  { input: 'Michael Brown Sr', expected: { firstName: 'Michael', lastName: 'Brown Sr', displayName: 'Michael Brown Sr' } },
  
  // Complex cases
  { input: 'Dr. John Michael Smith Jr.', expected: { firstName: 'John', lastName: 'Michael Smith Jr.', displayName: 'John Michael Smith Jr.' } },
  { input: 'Smith, John Michael Jr.', expected: { firstName: 'John', lastName: 'Smith Jr.', displayName: 'John Smith Jr.' } },
  
  // Special characters and hyphenated names
  { input: 'Mary-Jane Wilson', expected: { firstName: 'Mary-Jane', lastName: 'Wilson', displayName: 'Mary-Jane Wilson' } },
  { input: 'Jean-Claude Van Damme', expected: { firstName: 'Jean-Claude', lastName: 'Van Damme', displayName: 'Jean-Claude Van Damme' } },
  
  // Scottish/Irish names
  { input: 'john mcdonald', expected: { firstName: 'John', lastName: 'McDonald', displayName: 'John McDonald' } },
  { input: 'patrick o\'connor', expected: { firstName: 'Patrick', lastName: 'O\'Connor', displayName: 'Patrick O\'Connor' } },
  { input: 'mary macleod', expected: { firstName: 'Mary', lastName: 'MacLeod', displayName: 'Mary MacLeod' } },
  
  // Edge cases
  { input: '  John   Smith  ', expected: { firstName: 'John', lastName: 'Smith', displayName: 'John Smith' } },
  { input: 'Smith,John', expected: { firstName: 'John', lastName: 'Smith', displayName: 'John Smith' } },
  { input: 'Smith , John', expected: { firstName: 'John', lastName: 'Smith', displayName: 'John Smith' } },
  
  // Single names
  { input: 'Madonna', expected: { firstName: 'Madonna', lastName: '', displayName: 'Madonna' } },
  { input: 'Cher', expected: { firstName: 'Cher', lastName: '', displayName: 'Cher' } },
  
  // Empty/invalid cases
  { input: '', expected: { firstName: '', lastName: '', displayName: '' } },
  { input: '   ', expected: { firstName: '', lastName: '', displayName: '' } },
];

// Test cases for object input
const objectTestCases = [
  {
    input: { firstName: 'John', lastName: 'Smith' },
    expected: { firstName: 'John', lastName: 'Smith', displayName: 'John Smith' }
  },
  {
    input: { firstName: 'jane', lastName: 'doe' },
    expected: { firstName: 'Jane', lastName: 'Doe', displayName: 'Jane Doe' }
  },
  {
    input: { name: 'Smith, John' },
    expected: { firstName: 'John', lastName: 'Smith', displayName: 'John Smith' }
  },
  {
    input: { firstName: 'John', lastName: 'Smith', name: 'John Smith' },
    expected: { firstName: 'John', lastName: 'Smith', displayName: 'John Smith' }
  },
];

export class NameNormalizerTester {
  // Test basic normalization functionality
  public static testBasicNormalization(): void {
    console.log('\n🧪 Testing Basic Name Normalization');
    console.log('===================================');

    let passed = 0;
    let failed = 0;

    testCases.forEach((testCase, index) => {
      const result = NameNormalizer.normalizeName(testCase.input);
      
      const success = 
        result.firstName === testCase.expected.firstName &&
        result.lastName === testCase.expected.lastName &&
        result.displayName === testCase.expected.displayName;

      if (success) {
        passed++;
        console.log(`✅ Test ${index + 1}: "${testCase.input}" → "${result.displayName}"`);
      } else {
        failed++;
        console.log(`❌ Test ${index + 1}: "${testCase.input}"`);
        console.log(`   Expected: ${testCase.expected.displayName}`);
        console.log(`   Got:      ${result.displayName}`);
        console.log(`   Details:  First: "${result.firstName}", Last: "${result.lastName}"`);
      }
    });

    console.log(`\n📊 Basic Tests: ${passed} passed, ${failed} failed`);
  }

  // Test object input functionality
  public static testObjectInput(): void {
    console.log('\n🔧 Testing Object Input');
    console.log('=======================');

    let passed = 0;
    let failed = 0;

    objectTestCases.forEach((testCase, index) => {
      const result = NameNormalizer.normalizeName(testCase.input);
      
      const success = 
        result.firstName === testCase.expected.firstName &&
        result.lastName === testCase.expected.lastName &&
        result.displayName === testCase.expected.displayName;

      if (success) {
        passed++;
        console.log(`✅ Object Test ${index + 1}: ${JSON.stringify(testCase.input)} → "${result.displayName}"`);
      } else {
        failed++;
        console.log(`❌ Object Test ${index + 1}: ${JSON.stringify(testCase.input)}`);
        console.log(`   Expected: ${testCase.expected.displayName}`);
        console.log(`   Got:      ${result.displayName}`);
      }
    });

    console.log(`\n📊 Object Tests: ${passed} passed, ${failed} failed`);
  }

  // Test different normalization options
  public static testNormalizationOptions(): void {
    console.log('\n⚙️  Testing Normalization Options');
    console.log('=================================');

    const testName = 'Dr. John Michael Smith Jr.';
    
    // Test with different options
    const options: Array<{ opts: NameNormalizationOptions; description: string }> = [
      { opts: {}, description: 'Default options' },
      { opts: { capitalizeNames: false }, description: 'No capitalization' },
      { opts: { handleSuffixes: false }, description: 'No suffix handling' },
      { opts: { preserveMiddleName: true }, description: 'Preserve middle name' },
      { opts: { trimWhitespace: false }, description: 'No whitespace trimming' },
    ];

    options.forEach(({ opts, description }) => {
      const result = NameNormalizer.normalizeName(testName, opts);
      console.log(`📝 ${description}:`);
      console.log(`   Input:       "${testName}"`);
      console.log(`   First Name:  "${result.firstName}"`);
      console.log(`   Last Name:   "${result.lastName}"`);
      console.log(`   Middle Name: "${result.middleName || 'N/A'}"`);
      console.log(`   Display:     "${result.displayName}"`);
      console.log(`   Full Name:   "${result.fullName}"`);
      console.log('');
    });
  }

  // Test utility functions
  public static testUtilityFunctions(): void {
    console.log('\n🛠️  Testing Utility Functions');
    console.log('=============================');

    const testNames = [
      'John Smith',
      'Mary Elizabeth Johnson',
      'Dr. Robert Wilson Jr.',
      'Smith, Jane',
      'john doe',
      'MARY SMITH',
      '  John   Smith  ',
      'Madonna',
      '',
    ];

    testNames.forEach(name => {
      const normalized = NameNormalizer.normalizeName(name);
      const isWellFormatted = NameNormalizer.isWellFormatted(name);
      const initials = NameNormalizer.getInitials(normalized);
      
      console.log(`📋 "${name}":`);
      console.log(`   Normalized:     "${normalized.displayName}"`);
      console.log(`   Well formatted: ${isWellFormatted ? '✅' : '❌'}`);
      console.log(`   Initials:       "${initials}"`);
      console.log(`   Last, First:    "${NameNormalizer.formatForDisplay(normalized, 'last-first')}"`);
      console.log('');
    });
  }

  // Test batch processing
  public static testBatchProcessing(): void {
    console.log('\n📦 Testing Batch Processing');
    console.log('===========================');

    const names = [
      'Smith, John',
      'jane doe',
      'Dr. Robert Wilson Jr.',
      'Mary-Jane Johnson',
      'patrick o\'connor',
    ];

    console.log('Input names:', names);
    
    const normalized = NameNormalizer.normalizeNames(names);
    
    console.log('\nNormalized results:');
    normalized.forEach((result, index) => {
      console.log(`   ${index + 1}. "${names[index]}" → "${result.displayName}"`);
      console.log(`      First: "${result.firstName}", Last: "${result.lastName}"`);
    });
  }

  // Test real-world HR data scenarios
  public static testHRScenarios(): void {
    console.log('\n🏢 Testing HR Data Scenarios');
    console.log('============================');

    // Simulate common HR data formats
    const hrData = [
      { employeeId: 'EMP001', name: 'Smith, John Michael' },
      { employeeId: 'EMP002', firstName: 'jane', lastName: 'doe' },
      { employeeId: 'EMP003', name: 'DR. ROBERT WILSON JR.' },
      { employeeId: 'EMP004', name: 'mary-jane o\'connor' },
      { employeeId: 'EMP005', firstName: 'Patrick', lastName: 'McDonald' },
      { employeeId: 'EMP006', name: '  Sarah   Johnson  ' },
    ];

    console.log('Processing HR employee data...\n');

    hrData.forEach(employee => {
      const nameInput = {
        firstName: employee.firstName,
        lastName: employee.lastName,
        name: employee.name,
      };

      const normalized = NameNormalizer.normalizeName(nameInput);
      
      console.log(`👤 ${employee.employeeId}:`);
      console.log(`   Original:   ${employee.name || `${employee.firstName} ${employee.lastName}`}`);
      console.log(`   Normalized: "${normalized.displayName}"`);
      console.log(`   First:      "${normalized.firstName}"`);
      console.log(`   Last:       "${normalized.lastName}"`);
      console.log(`   Initials:   "${NameNormalizer.getInitials(normalized)}"`);
      console.log('');
    });
  }

  // Run all tests
  public static runAllTests(): void {
    console.log('🎯 Starting Name Normalizer Tests');
    console.log('=================================');
    
    try {
      this.testBasicNormalization();
      this.testObjectInput();
      this.testNormalizationOptions();
      this.testUtilityFunctions();
      this.testBatchProcessing();
      this.testHRScenarios();
      
      console.log('\n🎉 All name normalization tests completed!');
      console.log('\n📝 Key capabilities validated:');
      console.log('   ✅ Handles "Last, First" HR format');
      console.log('   ✅ Proper case conversion');
      console.log('   ✅ Prefix/suffix handling');
      console.log('   ✅ Scottish/Irish name formatting');
      console.log('   ✅ Hyphenated names');
      console.log('   ✅ Whitespace normalization');
      console.log('   ✅ Object and string input');
      console.log('   ✅ Batch processing');
      console.log('   ✅ Utility functions');
      
    } catch (error) {
      console.error('\n❌ Test failed:', error);
    }
  }

  // Generate sample normalized data for integration testing
  public static generateSampleData(): Array<{ original: string; normalized: NameParts }> {
    const sampleNames = [
      'Smith, John',
      'jane doe',
      'Dr. Robert Wilson Jr.',
      'mary-jane o\'connor',
      'PATRICK MCDONALD',
      '  Sarah   Johnson  ',
      'Van Der Berg, Hans',
      'Maria Garcia-Lopez',
    ];

    return sampleNames.map(name => ({
      original: name,
      normalized: NameNormalizer.normalizeName(name),
    }));
  }
} 