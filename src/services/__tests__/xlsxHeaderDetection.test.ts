import { DataParser } from '../../services/dataParser';

// Build a minimal in-memory XLSX using a CSV fallback approach is non-trivial in jsdom.
// Instead, we validate the cleaning logic that runs after XLSX parsing by simulating
// "object rows" that represent post-header mapped rows. This ensures we don't drop
// valid rows as metadata when the first column is blank.

describe('Workday cleaning does not drop valid object rows', () => {
  it('keeps object rows even if first property is blank-like', () => {
    const clean = (DataParser as unknown as { cleanWorkdayData: (rows: any[]) => any }).cleanWorkdayData?.bind(DataParser)
      // Fallback accessor to private via index signature
      || (DataParser as any).cleanWorkdayData.bind(DataParser);

    const rows = [
      // Simulated mapped object rows (after header detection)
      { 'ratings changed?': '', 'associate id': '1001', worker: 'Jane Doe', 'calibrated value: overall performance rating': 'Successful Performer' },
      { 'ratings changed?': '', 'associate id': '1002', worker: 'John Smith', 'calibrated value: overall performance rating': 'High Impact Performer' },
    ];

    const { cleanedData, removedRows } = clean(rows);
    expect(removedRows).toBe(0);
    expect(cleanedData).toHaveLength(2);
  });
});


