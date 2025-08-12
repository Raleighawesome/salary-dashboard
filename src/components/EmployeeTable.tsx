import React, { useState, useMemo, useCallback, useEffect } from 'react';
import styles from './EmployeeTable.module.css';
import { ModernSelect } from './ModernSelect';
import { PolicyValidator } from '../utils/policyValidation';
import { TempFieldStorageService } from '../services/tempFieldStorage';
import { EmployeeCalculations } from '../utils/calculations';

interface EmployeeTableProps {
  employeeData: any[];
  onEmployeeSelect: (employee: any) => void;
  onEmployeeUpdate: (employeeId: string, updates: any) => void;
  budgetCurrency: string;
  totalBudget: number;
  currentBudgetUsage: number;
}

type SortField = 'name' | 'baseSalaryUSD' | 'performanceRating' | 'comparatio' | 'proposedRaise' | 'managerName';
type SortDirection = 'asc' | 'desc';

// Options for ModernSelect components
const FILTER_OPTIONS = [
  { value: 'all', label: 'All Employees', icon: '👥' },
  { value: 'withRaises', label: 'With Proposed Raises', icon: '💰' },
  { value: 'highPerformers', label: 'High Performers', icon: '⭐' },
  { value: 'atRisk', label: 'At Risk', icon: '⚠️' }
];

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 per page', icon: '📋' },
  { value: '25', label: '25 per page', icon: '📄' },
  { value: '50', label: '50 per page', icon: '📑' },
  { value: '100', label: '100 per page', icon: '📚' }
];

export const EmployeeTable: React.FC<EmployeeTableProps> = ({
  employeeData,
  onEmployeeSelect,
  onEmployeeUpdate,
  budgetCurrency,
  totalBudget,
  currentBudgetUsage,
}) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterBy, setFilterBy] = useState<'all' | 'withRaises' | 'highPerformers' | 'atRisk'>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  
  // Inline editing state
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [tempRaiseValues, setTempRaiseValues] = useState<Record<string, string>>({});
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null);
  const [tempSalaryValues, setTempSalaryValues] = useState<Record<string, string>>({});

  // Restore temporary field values on component mount
  useEffect(() => {
    const tempChanges = TempFieldStorageService.getTempChanges();
    const restoredRaiseValues: Record<string, string> = {};
    const restoredSalaryValues: Record<string, string> = {};
    
    tempChanges.forEach(change => {
      if (change.field === 'raisePercent') {
        restoredRaiseValues[change.employeeId] = change.value;
      } else if (change.field === 'baseSalary') {
        restoredSalaryValues[change.employeeId] = change.value;
      }
    });
    
    if (Object.keys(restoredRaiseValues).length > 0) {
      setTempRaiseValues(restoredRaiseValues);
    }
    if (Object.keys(restoredSalaryValues).length > 0) {
      setTempSalaryValues(restoredSalaryValues);
    }
  }, []);

  // Format currency
  const formatCurrency = useCallback((amount: number): string => {
    if (!amount || amount <= 0) return 'N/A';
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: budgetCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${budgetCurrency} ${amount.toLocaleString()}`;
    }
  }, [budgetCurrency]);

  // Format currency with original currency display
  const formatCurrencyWithOriginal = useCallback((amountUSD: number, originalAmount: number, originalCurrency: string): React.ReactElement => {
    if (!amountUSD || amountUSD <= 0) return <span>N/A</span>;
    
    const usdFormatted = formatCurrency(amountUSD);
    
    // Only show original currency if it's different from budget currency
    if (originalCurrency && originalCurrency !== budgetCurrency && originalAmount && originalAmount !== amountUSD) {
      try {
        const originalFormatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: originalCurrency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(originalAmount);
        
        return (
          <div className={styles.currencyDisplay}>
            <div className={styles.primaryCurrency}>{usdFormatted}</div>
            <div className={styles.originalCurrency}>({originalFormatted})</div>
          </div>
        );
      } catch {
        return (
          <div className={styles.currencyDisplay}>
            <div className={styles.primaryCurrency}>{usdFormatted}</div>
            <div className={styles.originalCurrency}>({originalCurrency} {originalAmount.toLocaleString()})</div>
          </div>
        );
      }
    }
    
    return <span>{usdFormatted}</span>;
  }, [budgetCurrency, formatCurrency]);

  // Format percentage
  const formatPercentage = useCallback((value: number): string => {
    if (!value || value <= 0) return 'N/A';
    return `${value.toFixed(1)}%`;
  }, []);

  // Get performance badge
  const getPerformanceBadge = useCallback((rating: string | number): { text: string; className: string } => {
    if (!rating) return { text: 'N/A', className: 'noData' };
    
    // Handle text-based performance ratings from CSV
    if (typeof rating === 'string') {
      const ratingLower = rating.toLowerCase();
      if (ratingLower.includes('high') || ratingLower.includes('excellent') || ratingLower.includes('impact')) {
        return { text: rating, className: 'excellent' };
      }
      if (ratingLower.includes('successful') || ratingLower.includes('good') || ratingLower.includes('meets')) {
        return { text: rating, className: 'good' };
      }
      if (ratingLower.includes('developing') || ratingLower.includes('fair') || ratingLower.includes('partial')) {
        return { text: rating, className: 'fair' };
      }
      if (ratingLower.includes('evolving')) {
        return { text: rating, className: 'poor' };
      }
      if (ratingLower.includes('poor') || ratingLower.includes('below') || ratingLower.includes('needs')) {
        return { text: rating, className: 'poor' };
      }
      // Default for unknown text ratings
      return { text: rating, className: 'good' };
    }
    
    // Handle numeric ratings (legacy support)
    const numRating = Number(rating);
    if (numRating <= 0) return { text: 'N/A', className: 'noData' };
    if (numRating >= 4.5) return { text: 'Excellent', className: 'excellent' };
    if (numRating >= 4.0) return { text: 'Good', className: 'good' };
    if (numRating >= 3.5) return { text: 'Fair', className: 'fair' };
    if (numRating >= 3.0) return { text: 'Poor', className: 'poor' };
    return { text: 'Critical', className: 'critical' };
  }, []);



  // Handle inline editing
  const handleStartEditing = useCallback((employeeId: string, currentRaiseAmount: number) => {
    setEditingEmployeeId(employeeId);
    // Convert dollar amount to percentage for editing
    const employee = employeeData.find(emp => emp.employeeId === employeeId);
    const currentSalary = employee?.baseSalaryUSD || employee?.baseSalary || 0;
    const currentRaisePercent = currentSalary > 0 ? (currentRaiseAmount / currentSalary) * 100 : 0;
    
    setTempRaiseValues({ 
      ...tempRaiseValues, 
      [employeeId]: currentRaisePercent > 0 ? currentRaisePercent.toFixed(1) : '0'
    });
  }, [tempRaiseValues, employeeData]);

  const handleCancelEditing = useCallback(() => {
    // Clear temporary storage for the employee being edited
    if (editingEmployeeId) {
      TempFieldStorageService.removeTempChange(editingEmployeeId, 'raisePercent');
    }
    setEditingEmployeeId(null);
    setTempRaiseValues({});
  }, [editingEmployeeId]);

  const handleCancelSalaryEditing = useCallback(() => {
    // Clear temporary storage for the employee being edited
    if (editingSalaryId) {
      TempFieldStorageService.removeTempChange(editingSalaryId, 'baseSalary');
    }
    setEditingSalaryId(null);
    setTempSalaryValues({});
  }, [editingSalaryId]);

  const handleRaiseInputChange = useCallback((employeeId: string, value: string) => {
    // Allow empty string and valid numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setTempRaiseValues({ 
        ...tempRaiseValues, 
        [employeeId]: value 
      });
      
      // Store in temporary storage for persistence across refreshes
      const currentEmployee = employeeData.find(emp => emp.employeeId === employeeId);
      const originalRaisePercent = currentEmployee?.percentChange || 0;
      TempFieldStorageService.storeTempChange(employeeId, 'raisePercent', value, originalRaisePercent);
    }
  }, [tempRaiseValues, employeeData]);

  const handleSalaryInputChange = useCallback((employeeId: string, value: string) => {
    // Allow empty string and valid numbers (including decimals)
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setTempSalaryValues({ 
        ...tempSalaryValues, 
        [employeeId]: value 
      });
      
      // Store in temporary storage for persistence across refreshes
      const currentEmployee = employeeData.find(emp => emp.employeeId === employeeId);
      const originalSalary = currentEmployee?.baseSalary || currentEmployee?.baseSalaryUSD || 0;
      TempFieldStorageService.storeTempChange(employeeId, 'baseSalary', value, originalSalary);
    }
  }, [tempSalaryValues, employeeData]);

  const handleSaveRaise = useCallback((employee: any) => {
    const newRaisePercentStr = tempRaiseValues[employee.employeeId] || '0';
    const newRaisePercent = parseFloat(newRaisePercentStr) || 0;
    
    // Convert percentage to dollar amount
    const currentSalary = employee.baseSalaryUSD || employee.baseSalary || 0;
    const newRaiseAmount = (newRaisePercent / 100) * currentSalary;
    
    // Calculate updated values
    const newSalary = PolicyValidator.calculateNewSalary(currentSalary, newRaiseAmount);
    const percentChange = newRaisePercent; // This is already the percentage
    
    // Update employee data
    onEmployeeUpdate(employee.employeeId, {
      proposedRaise: newRaiseAmount,
      newSalary: newSalary,
      percentChange: percentChange,
    });
    
    // Clear temporary storage for this field
    TempFieldStorageService.removeTempChange(employee.employeeId, 'raisePercent');
    
    setEditingEmployeeId(null);
    setTempRaiseValues({});
  }, [tempRaiseValues, onEmployeeUpdate]);

  // Handle salary editing
  const handleStartSalaryEditing = useCallback((employeeId: string, currentSalary: number) => {
    setEditingSalaryId(employeeId);
    setTempSalaryValues({ 
      ...tempSalaryValues, 
      [employeeId]: currentSalary > 0 ? currentSalary.toString() : '0'
    });
  }, [tempSalaryValues]);

  const handleSaveSalary = useCallback((employee: any) => {
    const newSalaryStr = tempSalaryValues[employee.employeeId] || '0';
    const newSalary = parseFloat(newSalaryStr) || 0;
    
    if (newSalary <= 0) {
      alert('Please enter a valid salary amount');
      return;
    }
    
    // Determine if we're editing in original currency or USD
    const currentOriginalSalary = employee.baseSalary || 0;
    const currentUSDSalary = employee.baseSalaryUSD || currentOriginalSalary;
    
    // Calculate conversion rate from existing data if available
    let conversionRate = 1;
    if (currentOriginalSalary > 0 && currentUSDSalary > 0 && currentOriginalSalary !== currentUSDSalary) {
      conversionRate = currentUSDSalary / currentOriginalSalary;
    }
    
    // Assume entered salary is in original currency, convert to USD
    const newOriginalSalary = newSalary;
    const newUSDSalary = newSalary * conversionRate;
    
    // Recalculate comparatio based on new original currency salary
    const newComparatio = employee.salaryGradeMid > 0 
      ? Math.round((newOriginalSalary / employee.salaryGradeMid) * 100)
      : 0;
    

    
    // Update employee data with new base salary values only
    // Do NOT modify proposed raise when updating current salary
    onEmployeeUpdate(employee.employeeId, {
      baseSalary: newOriginalSalary,
      baseSalaryUSD: newUSDSalary,
      comparatio: newComparatio,
    });
    
    // Clear temporary storage for this field
    TempFieldStorageService.removeTempChange(employee.employeeId, 'baseSalary');
    
    setEditingSalaryId(null);
    setTempSalaryValues({});
  }, [tempSalaryValues, onEmployeeUpdate]);

  // Get unique managers for filter dropdown
  const uniqueManagers = useMemo(() => {
    const managers = new Set<string>();
    employeeData.forEach(emp => {
      if (emp.managerName && emp.managerName.trim()) {
        managers.add(emp.managerName.trim());
      }
    });
    return Array.from(managers).sort();
  }, [employeeData]);

  // Create manager options for ModernSelect
  const managerOptions = useMemo(() => [
    { value: 'all', label: 'All Managers', icon: '👥' },
    ...uniqueManagers.map(manager => ({
      value: manager,
      label: manager,
      icon: '👤'
    }))
  ], [uniqueManagers]);

  // Get policy violations for an employee
  const getEmployeeViolations = useCallback((employee: any) => {
    const violations = PolicyValidator.validateEmployee(employee);
    
    // Add budget validation if employee has a proposed raise
    if (employee.proposedRaise && employee.proposedRaise > 0) {
      const budgetViolations = PolicyValidator.validateBudget(
        { totalBudget, currentBudgetUsage, employeeCount: employeeData.length },
        employee.proposedRaise
      );
      violations.push(...budgetViolations);
    }
    
    return violations;
  }, [totalBudget, currentBudgetUsage, employeeData.length]);

  // Get adjustment considerations for an employee (matching EmployeeDetail logic)
  const getAdjustmentConsiderations = useCallback((employee: any) => {
    const items: { text: string; severity: 'critical' | 'warning' | 'info' }[] = [];
    
    try {
      // Enhanced data extraction with comprehensive field name fallbacks (from EmployeeDetail)
      const extractFieldValue = (fieldNames: string[], defaultValue: any = null) => {
        for (const fieldName of fieldNames) {
          const value = employee[fieldName];
          if (value !== undefined && value !== null && value !== '') {
            return value;
          }
        }
        return defaultValue;
      };

      // Calculate tenure information using EmployeeCalculations
      const tenureInfo = EmployeeCalculations.calculateTenure(
        extractFieldValue([
          'Latest Hire Date', 'hireDate', 'hire_date', 'start_date',
          'Hire Date', 'Start Date'
        ]),
        extractFieldValue([
          'Job Entry Start Date', 'roleStartDate', 'role_start_date', 'current_role_start',
          'Role Start Date', 'Current Role Start'
        ]),
        extractFieldValue([
          'lastRaiseDate', 'last_raise_date', 'last_increase_date',
          'Last Raise Date', 'Last Salary Change Date', 'Last salary change date'
        ])
      );

      // Current comparatio
      const currentComparatio = employee.comparatio || 0;
      
      // 1) Below minimum (<76% comparatio)
      if (currentComparatio > 0 && currentComparatio < 76) {
        items.push({ text: 'Below minimum range (<76% compa-ratio)', severity: 'critical' });
      } else if (currentComparatio > 0 && currentComparatio <= 84) {
        // 2) <85% comp ratio (only if not already flagged as <76%)
        items.push({ text: '<85% compa-ratio', severity: 'warning' });
      }
      
      // 3) and 4) No merit increase in > 24 months or > 18 months
      const lastRaiseMonthsAgo = tenureInfo?.lastRaiseMonthsAgo || 0;
      if (lastRaiseMonthsAgo > 24) {
        items.push({ text: 'No merit increase in > 24 months', severity: 'warning' });
      } else if (lastRaiseMonthsAgo > 18) {
        items.push({ text: 'No merit increase in > 18 months', severity: 'info' });
      }
      
      // 5) Segment 1 in role > 24 months, if no performance issues
      const isSegment1 = (() => {
        const seg = (employee.salaryRangeSegment || '').toString().toLowerCase();
        return seg === 'segment 1' || seg === '1' || seg.includes('segment 1');
      })();
      const timeInRoleMonths = tenureInfo?.timeInRoleMonths || 0;
      const derivedRating = employee.performanceRating ||
        employee['CALIBRATED VALUE: Overall Performance Rating'] ||
        employee['calibrated value: overall performance rating'] ||
        '';
      const perfClass = getPerformanceBadge(derivedRating).className;
      const hasPerformanceIssues = perfClass === 'poor' || perfClass === 'critical';
      
      if (isSegment1 && timeInRoleMonths > 24 && !hasPerformanceIssues) {
        items.push({ text: 'Segment 1, >24 months in role, no performance issues', severity: 'info' });
      }
    } catch (error) {
      console.error('Error calculating adjustment considerations:', error);
    }
    
    return items;
  }, [getPerformanceBadge]);

  // Calculate real-time values for display
  const calculateRealTimeValues = useCallback((employee: any) => {
    // Use USD for display calculations
    const currentSalaryUSD = employee.baseSalaryUSD || employee.baseSalary || 0;
    const proposedRaise = employee.proposedRaise || 0;
    const newSalaryUSD = PolicyValidator.calculateNewSalary(currentSalaryUSD, proposedRaise);
    const percentChange = PolicyValidator.calculateRaisePercent(currentSalaryUSD, proposedRaise);
    
    // Calculate new comparatio using ORIGINAL currency (not USD)
    // proposedRaise is in USD, so we need to convert it to original currency for comparatio calculation
    const currentSalaryOriginal = employee.baseSalary || 0;
    const salaryGradeMid = employee.salaryGradeMid || 0;
    
    let newComparatio = 0;
    if (proposedRaise > 0 && salaryGradeMid > 0 && currentSalaryOriginal > 0) {
      // Convert USD raise amount to original currency
      const currencyConversionRate = currentSalaryOriginal / (employee.baseSalaryUSD || currentSalaryOriginal);
      const proposedRaiseOriginalCurrency = proposedRaise * currencyConversionRate;
      
      // Calculate new salary in original currency  
      const newSalaryOriginal = currentSalaryOriginal + proposedRaiseOriginalCurrency;
      
      // Calculate comparatio using original currency values
      newComparatio = Math.round((newSalaryOriginal / salaryGradeMid) * 100);
    }
    
    return { newSalary: newSalaryUSD, percentChange, newComparatio };
  }, []);

  // Filter and sort employees
  const processedEmployees = useMemo(() => {
    let filtered = [...employeeData];

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(emp => 
        (emp.name && emp.name.toLowerCase().includes(term)) ||
        (emp.email && emp.email.toLowerCase().includes(term)) ||
        (emp.employeeId && emp.employeeId.toString().toLowerCase().includes(term)) ||
        (emp.jobTitle && emp.jobTitle.toLowerCase().includes(term))
      );
    }

    // Apply category filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(emp => {
        switch (filterBy) {
          case 'withRaises':
            return emp.proposedRaise && emp.proposedRaise > 0;
          case 'highPerformers':
            if (typeof emp.performanceRating === 'string') {
              const ratingLower = emp.performanceRating.toLowerCase();
              return ratingLower.includes('high') || ratingLower.includes('excellent') || ratingLower.includes('impact');
            }
            return emp.performanceRating && emp.performanceRating >= 4.0;
          case 'atRisk':
            return (emp.comparatio && emp.comparatio < 80);
          default:
            return true;
        }
      });
    }

    // Apply manager filter
    if (managerFilter !== 'all') {
      filtered = filtered.filter(emp => {
        return emp.managerName && emp.managerName.trim() === managerFilter;
      });
    }

    // Sort employees
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined values
      if (!aVal && !bVal) return 0;
      if (!aVal) return sortDirection === 'asc' ? 1 : -1;
      if (!bVal) return sortDirection === 'asc' ? -1 : 1;

      // String comparison for names
      if (sortField === 'name') {
        aVal = aVal.toString().toLowerCase();
        bVal = bVal.toString().toLowerCase();
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Numeric comparison
      const numA = parseFloat(aVal) || 0;
      const numB = parseFloat(bVal) || 0;
      
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });

    return filtered;
  }, [employeeData, searchTerm, filterBy, managerFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedEmployees.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedEmployees = processedEmployees.slice(startIndex, endIndex);

  // Handle sorting
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  }, [sortField, sortDirection]);

  // Handle search
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback((value: string) => {
    setFilterBy(value as any);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  // Handle manager filter change
  const handleManagerFilterChange = useCallback((value: string) => {
    setManagerFilter(value);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  // Handle page size change
  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // Get sort icon
  const getSortIcon = useCallback((field: SortField): string => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  }, [sortField, sortDirection]);

  return (
    <div className={styles.employeeTable}>
      <div className={styles.tableHeader}>
        <div className={styles.titleSection}>
          <h3 className={styles.tableTitle}>📋 Employee Data Table</h3>
          <p className={styles.tableDescription}>
            Detailed view of all employee data with sorting, filtering, and search
          </p>
        </div>

        {/* Controls */}
        <div className={styles.tableControls}>
          <div className={styles.searchSection}>
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={handleSearch}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterSection}>
            <ModernSelect
              value={filterBy}
              onChange={handleFilterChange}
              options={FILTER_OPTIONS}
              variant="compact"
              className={styles.filterSelect}
            />
          </div>

          <div className={styles.filterSection}>
            <ModernSelect
              value={managerFilter}
              onChange={handleManagerFilterChange}
              options={managerOptions}
              variant="compact"
              className={styles.filterSelect}
            />
          </div>

          <div className={styles.pageSizeSection}>
            <ModernSelect
              value={pageSize.toString()}
              onChange={handlePageSizeChange}
              options={PAGE_SIZE_OPTIONS}
              variant="compact"
              className={styles.pageSizeSelect}
            />
          </div>
        </div>
      </div>

      {/* Table Stats */}
      <div className={styles.tableStats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total:</span>
          <span className={styles.statValue}>{employeeData.length}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Filtered:</span>
          <span className={styles.statValue}>{processedEmployees.length}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Showing:</span>
          <span className={styles.statValue}>
            {startIndex + 1}-{Math.min(endIndex, processedEmployees.length)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Page:</span>
          <span className={styles.statValue}>{currentPage} of {totalPages}</span>
        </div>
        {managerFilter !== 'all' && (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Manager:</span>
            <span className={styles.statValue}>{managerFilter}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('name')}
              >
                Employee {getSortIcon('name')}
              </th>
              <th>Job Title</th>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('baseSalaryUSD')}
              >
                Current Salary {getSortIcon('baseSalaryUSD')}
              </th>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('performanceRating')}
              >
                Performance {getSortIcon('performanceRating')}
              </th>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('comparatio')}
              >
                Comparatio {getSortIcon('comparatio')}
              </th>
              <th 
                className={styles.sortableHeader}
                onClick={() => handleSort('proposedRaise')}
              >
                Proposed Raise {getSortIcon('proposedRaise')}
              </th>
              <th>New Salary</th>
              <th>New Comparatio</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployees.map((employee, index) => {
              const performanceBadge = getPerformanceBadge(employee.performanceRating);
              const violations = getEmployeeViolations(employee);
              const violationColor = PolicyValidator.getViolationColor(violations);
              const considerations = getAdjustmentConsiderations(employee);
              const realTimeValues = calculateRealTimeValues(employee);
              const isEditing = editingEmployeeId === employee.employeeId;
              const currentRaiseValue = isEditing 
                ? tempRaiseValues[employee.employeeId] || '0'
                : employee.proposedRaise?.toString() || '0';

              // Determine row styling priority: proposed raise > policy violations
              const hasProposedRaise = employee.proposedRaise && employee.proposedRaise > 0;
              const rowClass = hasProposedRaise 
                ? `${styles.tableRow} ${styles.proposedRaise}`
                : `${styles.tableRow} ${violationColor !== 'none' ? styles[violationColor] : ''}`;

              return (
                <tr 
                  key={employee.employeeId || employee.email || index} 
                  className={rowClass}
                >
                  <td className={styles.employeeCell}>
                    <div className={styles.employeeInfo}>
                      <div 
                        className={`${styles.employeeName} ${styles.clickableName}`}
                        onClick={() => onEmployeeSelect(employee)}
                        title="Click to view employee details"
                      >
                        {employee.name || 'Unknown'}
                        {considerations.length > 0 && (
                          <span 
                            className={styles.considerationIndicator} 
                            title={considerations.map(c => `- ${c.text}`).join('\n')}
                          >
                            ⚠️
                          </span>
                        )}
                        {hasProposedRaise ? (
                          <span className={styles.violationIndicator} title="Proposed salary adjustment">
                            ✅
                          </span>
                        ) : violations.filter(v => v.type !== 'COMPARATIO_TOO_LOW').length > 0 && (
                          <span className={styles.violationIndicator} title={PolicyValidator.formatViolationMessage(violations.filter(v => v.type !== 'COMPARATIO_TOO_LOW'))}>
                            {violationColor === 'error' ? '🚫' : '⚠️'}
                          </span>
                        )}
                      </div>
                      <div className={styles.employeeId}>
                        {employee.employeeId || employee.email || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td>{employee.jobTitle || 'N/A'}</td>
                  <td className={styles.salaryCell}>
                    {editingSalaryId === employee.employeeId ? (
                      <div className={styles.editingSalary}>
                        <input
                          type="number"
                          value={tempSalaryValues[employee.employeeId] || '0'}
                          onChange={(e) => handleSalaryInputChange(employee.employeeId, e.target.value)}
                          className={styles.salaryInput}
                          min="0"
                          step="1000"
                          placeholder="Enter salary"
                        />
                        <div className={styles.currencyLabel}>
                          {employee.currency || budgetCurrency}
                        </div>
                        <div className={styles.editingActions}>
                          <button
                            onClick={() => handleSaveSalary(employee)}
                            className={styles.saveButton}
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancelSalaryEditing}
                            className={styles.cancelButton}
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className={styles.salaryInfo} 
                        onClick={() => handleStartSalaryEditing(employee.employeeId, employee.baseSalary || employee.baseSalaryUSD || 0)}
                        title="Click to edit current salary"
                      >
                        {formatCurrencyWithOriginal(
                          employee.baseSalaryUSD || employee.baseSalary,
                          employee.baseSalary,
                          employee.currency
                        )}
                        <span className={styles.editIcon}>✏️</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[performanceBadge.className]}`}>
                      {employee.performanceRating || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.comparatioCell}>
                      <div className={styles.comparatioValue}>
                        {employee.comparatio > 0 ? formatPercentage(employee.comparatio) : 'N/A'}
                      </div>
                      {employee.comparatio > 0 && (
                        <div className={`${styles.comparatioBar} ${
                          employee.comparatio >= 90 ? styles.high :
                          employee.comparatio >= 80 ? styles.medium : styles.low
                        }`}>
                          <div 
                            className={styles.comparatioFill}
                            style={{ width: `${Math.min(employee.comparatio, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={styles.raiseCell}>
                    {isEditing ? (
                      <div className={styles.editingRaise}>
                        <input
                          type="number"
                          value={currentRaiseValue}
                          onChange={(e) => handleRaiseInputChange(employee.employeeId, e.target.value)}
                          className={styles.raiseInput}
                          min="0"
                          max="50"
                          step="0.1"
                          placeholder="0.0"
                        />
                        <span className={styles.percentSign}>%</span>
                        <div className={styles.editingActions}>
                          <button
                            onClick={() => handleSaveRaise(employee)}
                            className={styles.saveButton}
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancelEditing}
                            className={styles.cancelButton}
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.raiseInfo} onClick={() => handleStartEditing(employee.employeeId, employee.proposedRaise || 0)}>
                        {employee.proposedRaise > 0 ? (
                          <>
                            <span className={`${styles.badge} ${styles.raisePill} ${
                              realTimeValues.percentChange > 10 ? styles.high :
                              realTimeValues.percentChange > 5 ? styles.medium : styles.good
                            }`}>
                              {formatPercentage(realTimeValues.percentChange)}
                            </span>
                            <div className={styles.raiseAmount}>
                              ({formatCurrency(employee.proposedRaise)})
                            </div>
                          </>
                        ) : (
                          <span className={styles.noRaise}>Click to add raise %</span>
                        )}
                        <span className={styles.editIcon}>✏️</span>
                      </div>
                    )}
                  </td>
                  <td className={styles.newSalaryCell}>
                    {employee.proposedRaise > 0 ? (
                      <>
                        <div className={styles.salaryValue}>
                          {formatCurrencyWithOriginal(
                            realTimeValues.newSalary,
                            employee.baseSalary && employee.currency && employee.currency !== budgetCurrency 
                              ? (realTimeValues.newSalary * (employee.baseSalary / (employee.baseSalaryUSD || employee.baseSalary)))
                              : realTimeValues.newSalary,
                            employee.currency
                          )}
                        </div>
                        <div className={styles.salaryChange}>
                          +{formatCurrency(realTimeValues.newSalary - (employee.baseSalaryUSD || employee.baseSalary))}
                        </div>
                      </>
                    ) : (
                      <span className={styles.noChange}>-</span>
                    )}
                  </td>
                  <td className={styles.newComparatioCell}>
                    {employee.proposedRaise > 0 ? (
                      <div className={styles.comparatioCell}>
                        <div className={styles.comparatioValue}>
                          {realTimeValues.newComparatio > 0 ? formatPercentage(realTimeValues.newComparatio) : 'N/A'}
                        </div>
                        {realTimeValues.newComparatio > 0 && (
                          <div className={`${styles.comparatioBar} ${
                            realTimeValues.newComparatio >= 90 ? styles.high :
                            realTimeValues.newComparatio >= 80 ? styles.medium : styles.low
                          }`}>
                            <div 
                              className={styles.comparatioFill}
                              style={{ width: `${Math.min(realTimeValues.newComparatio, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={styles.noChange}>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {processedEmployees.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <div className={styles.emptyTitle}>No employees found</div>
          <div className={styles.emptyDescription}>
            {searchTerm ? 
              `No employees match "${searchTerm}". Try adjusting your search terms.` :
              'No employees match the current filter. Try selecting a different filter.'
            }
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageButton}
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          <button
            className={styles.pageButton}
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          
          <div className={styles.pageNumbers}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNum}
                  className={`${styles.pageNumber} ${currentPage === pageNum ? styles.active : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            className={styles.pageButton}
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
          <button
            className={styles.pageButton}
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
};

export default EmployeeTable; 