// Salary calculation utilities for employee detail views and metrics

export interface EmployeeTenureInfo {
  totalTenureMonths: number;
  timeInRoleMonths: number;
  yearsOfService: number;
  monthsInCurrentRole: number;
  tenureBand: 'New' | 'Developing' | 'Experienced' | 'Veteran';
  lastRaiseMonthsAgo?: number;
}

export interface RetentionRiskFactors {
  comparatioRisk: number; // 0-40 points
  performanceRisk: number; // 0-30 points  
  tenureRisk: number; // 0-20 points
  marketRisk: number; // 0-10 points
  totalRisk: number; // 0-100
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  riskFactors: string[];
}

export interface SalaryAnalysis {
  currentSalary: number;
  salaryGradeMin: number;
  salaryGradeMid: number;
  salaryGradeMax: number;
  comparatio: number;
  positionInRange: 'Below Range' | 'Low' | 'Target' | 'High' | 'Above Range';
  roomForGrowth: number; // Dollars to midpoint or max
  marketPosition: 'Below Market' | 'Competitive' | 'Above Market';
}

export class EmployeeCalculations {
  
  public static excelSerialToDate(serial: number): Date {
    // Excel serial date starts at 1900-01-01 = 1 (but Excel incorrectly treats 1900 as leap year)
    // Unix epoch is 1970-01-01, so we convert days to milliseconds.
    // Offset 25569 = days between 1899-12-30 and 1970-01-01.
    const utcDays = serial - 25569;
    const utcSeconds = utcDays * 86400;
    return new Date(utcSeconds * 1000);
  }

  /**
   * Attempts to parse many common date representations that appear in HR exports:
   *  • ISO strings (yyyy-mm-dd or with time)
   *  • US locale (mm/dd/yyyy)
   *  • UK/EU locale (dd/mm/yyyy)
   *  • Excel serial numbers (both numeric and numeric-string)
   */
  public static parseDate(value: any): Date | null {
    if (value === undefined || value === null || value === '') return null;

    // Already a valid Date
    if (value instanceof Date && !isNaN(value.getTime())) return value;

    // Excel serial number – could arrive as number or numeric string
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(numeric) && numeric > 59) { // serial dates below 60 are 1900-02-28 or earlier – unlikely for modern data
      const excelDate = this.excelSerialToDate(numeric);
      if (!isNaN(excelDate.getTime())) return excelDate;
    }

    // Native Date parsing (handles ISO and many locale variants)
    const native = new Date(value);
    if (!isNaN(native.getTime())) return native;

    // Attempt to handle dd/mm/yyyy or mm/dd/yyyy ambiguities
    if (typeof value === 'string' && value.includes('/')) {
      const parts = value.split(/[\/]/).map(p => p.trim());
      if (parts.length === 3) {
        let day = Number(parts[1]);
        let month = Number(parts[0]) - 1; // assume mm/dd/yyyy
        let year = Number(parts[2]);
        // If day seems > 12 assume dd/mm/yyyy ordering
        if (day > 12) {
          day = Number(parts[0]);
          month = Number(parts[1]) - 1;
        }
        // Handle two-digit years
        if (year < 100) year += 2000;
        const alt = new Date(year, month, day);
        if (!isNaN(alt.getTime())) return alt;
      }
    }

    return null; // Could not parse
  }

  /**
   * Formats a date value into the user's locale or returns 'Not Available' if invalid.
   */
  public static formatDate(value: any, locale: string = 'en-US'): string {
    const date = this.parseDate(value);
    return date ? date.toLocaleDateString(locale) : 'Not Available';
  }

  // Calculate employee tenure information
  public static calculateTenure(
    hireDate?: string,
    roleStartDate?: string,
    lastRaiseDate?: string
  ): EmployeeTenureInfo {
    const now = new Date();
    
    // Use new flexible parsing helpers
    const hire = this.parseDate(hireDate) || now;
    const roleStart = this.parseDate(roleStartDate) || hire;
    const lastRaise = this.parseDate(lastRaiseDate);

    // Calculate total tenure
    const totalTenureMs = now.getTime() - hire.getTime();
    const totalTenureMonths = Math.floor(totalTenureMs / (1000 * 60 * 60 * 24 * 30.44));
    
    // Calculate time in current role
    const roleMs = now.getTime() - roleStart.getTime();
    const timeInRoleMonths = Math.floor(roleMs / (1000 * 60 * 60 * 24 * 30.44));
    
    // Calculate time since last raise
    const lastRaiseMonthsAgo = lastRaise 
      ? Math.floor((now.getTime() - lastRaise.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      : undefined;

    // Determine tenure band
    let tenureBand: EmployeeTenureInfo['tenureBand'];
    if (timeInRoleMonths < 12) tenureBand = 'New';
    else if (timeInRoleMonths < 36) tenureBand = 'Developing';
    else if (timeInRoleMonths < 72) tenureBand = 'Experienced';
    else tenureBand = 'Veteran';

    return {
      totalTenureMonths,
      timeInRoleMonths,
      yearsOfService: Math.floor(totalTenureMonths / 12),
      monthsInCurrentRole: timeInRoleMonths,
      tenureBand,
      lastRaiseMonthsAgo,
    };
  }

  // Calculate comprehensive retention risk
  public static calculateRetentionRisk(
    employee: any,
    tenureInfo: EmployeeTenureInfo
  ): RetentionRiskFactors {
    const factors: string[] = [];
    let comparatioRisk = 0;
    let performanceRisk = 0;
    let tenureRisk = 0;
    let marketRisk = 0;

    // Comparatio-based risk (0-40 points)
    const comparatio = employee.comparatio || 
                      employee['comparatio_percent'] || 
                      employee['comp_ratio'] || 
                      0;
    if (comparatio < 75) {
      comparatioRisk = 40;
      factors.push('Significantly below salary grade midpoint');
    } else if (comparatio < 85) {
      comparatioRisk = 25;
      factors.push('Below competitive salary range');
    } else if (comparatio < 95) {
      comparatioRisk = 10;
      factors.push('Slightly below target compensation');
    } else if (comparatio > 120) {
      comparatioRisk = 5;
      factors.push('Above market rate - potential budget risk');
    }

    // Performance-based risk (0-30 points)
    const performanceRating = employee.performanceRating || 
                             employee['performance_rating'] || 
                             employee['rating'] || 
                             employee['performance'];
    
    if (typeof performanceRating === 'string') {
      const rating = performanceRating.toLowerCase();
      if (rating.includes('high') || rating.includes('excellent') || rating.includes('impact')) {
        performanceRisk = 0; // High performers are low flight risk
        factors.push('High performer - valuable retention target');
      } else if (rating.includes('successful') || rating.includes('good')) {
        performanceRisk = 10;
      } else {
        performanceRisk = 30;
        factors.push('Performance concerns may affect motivation');
      }
    } else if (typeof performanceRating === 'number') {
      if (performanceRating >= 4.5) performanceRisk = 0;
      else if (performanceRating >= 4.0) performanceRisk = 5;
      else if (performanceRating >= 3.5) performanceRisk = 15;
      else performanceRisk = 30;
    }

    // Tenure-based risk (0-20 points)
    // Also check employee.timeInRole field directly
    const timeInRoleMonths = tenureInfo.timeInRoleMonths || 
                            employee.timeInRole || 
                            employee['time_in_role'] || 
                            employee['months_in_role'] || 
                            0;
    
    if (timeInRoleMonths < 6) {
      tenureRisk = 5; // New employees less likely to leave immediately
    } else if (timeInRoleMonths > 48) {
      tenureRisk = 15;
      factors.push('Long tenure - may seek new challenges');
    } else if (timeInRoleMonths > 24) {
      tenureRisk = 10;
    }

    // Time since last raise risk
    if (tenureInfo.lastRaiseMonthsAgo && tenureInfo.lastRaiseMonthsAgo > 24) {
      tenureRisk += 10;
      factors.push(`No raise in ${tenureInfo.lastRaiseMonthsAgo} months`);
    }

    // Market conditions risk (0-10 points)
    if (employee.jobTitle?.toLowerCase().includes('engineer') || 
        employee.jobTitle?.toLowerCase().includes('developer') ||
        employee.jobTitle?.toLowerCase().includes('manager')) {
      marketRisk = 10;
      factors.push('High-demand role in current market');
    } else {
      marketRisk = 5;
    }

    const totalRisk = Math.min(100, comparatioRisk + performanceRisk + tenureRisk + marketRisk);

    let riskLevel: RetentionRiskFactors['riskLevel'];
    if (totalRisk < 20) riskLevel = 'Low';
    else if (totalRisk < 40) riskLevel = 'Medium';
    else if (totalRisk < 70) riskLevel = 'High';
    else riskLevel = 'Critical';

    return {
      comparatioRisk,
      performanceRisk,
      tenureRisk,
      marketRisk,
      totalRisk,
      riskLevel,
      riskFactors: factors,
    };
  }

  // Analyze salary position and market competitiveness
  public static analyzeSalary(employee: any): SalaryAnalysis {
    // Try multiple field names for salary data
    // Use original currency (baseSalary) first for comparatio calculations, fallback to USD
    const currentSalary = employee.baseSalary || 
                         employee.baseSalaryUSD || 
                         employee['base_salary'] || 
                         employee['salary'] || 
                         employee['annual_salary'] || 
                         0;
    
    const salaryGradeMin = employee.salaryGradeMin || 
                          employee['salary_grade_min'] || 
                          employee['grade_min'] || 
                          (currentSalary * 0.8);
    
    const salaryGradeMid = employee.salaryGradeMid || 
                          employee['salary_grade_mid'] || 
                          employee['grade_mid'] || 
                          (currentSalary * 1.1);
    
    const salaryGradeMax = employee.salaryGradeMax || 
                          employee['salary_grade_max'] || 
                          employee['grade_max'] || 
                          (currentSalary * 1.4);
    
    const comparatio = salaryGradeMid > 0 ? (currentSalary / salaryGradeMid) * 100 : 0;

    // Determine position in range
    let positionInRange: SalaryAnalysis['positionInRange'];
    if (currentSalary < salaryGradeMin) positionInRange = 'Below Range';
    else if (comparatio < 90) positionInRange = 'Low';
    else if (comparatio <= 110) positionInRange = 'Target';
    else if (currentSalary <= salaryGradeMax) positionInRange = 'High';
    else positionInRange = 'Above Range';

    // Calculate room for growth
    const roomForGrowth = positionInRange === 'Below Range' || positionInRange === 'Low'
      ? salaryGradeMid - currentSalary
      : salaryGradeMax - currentSalary;

    // Determine market position
    let marketPosition: SalaryAnalysis['marketPosition'];
    if (comparatio < 85) marketPosition = 'Below Market';
    else if (comparatio <= 115) marketPosition = 'Competitive';
    else marketPosition = 'Above Market';

    return {
      currentSalary,
      salaryGradeMin,
      salaryGradeMid,
      salaryGradeMax,
      comparatio,
      positionInRange,
      roomForGrowth,
      marketPosition,
    };
  }

  // Calculate optimal raise recommendation
  public static calculateOptimalRaise(
    employee: any,
    tenureInfo: EmployeeTenureInfo,
    retentionRisk: RetentionRiskFactors,
    salaryAnalysis: SalaryAnalysis,
    budgetConstraints: { available: number; maxPercent: number }
  ): {
    recommendedAmount: number;
    recommendedPercent: number;
    reasoning: string[];
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
  } {
    const reasoning: string[] = [];
    let recommendedPercent = 0;
    
    // Base raise recommendation
    if (salaryAnalysis.positionInRange === 'Below Range') {
      recommendedPercent = 8;
      reasoning.push('Below salary grade minimum - market adjustment needed');
    } else if (salaryAnalysis.positionInRange === 'Low') {
      recommendedPercent = 6;
      reasoning.push('Below competitive range - retention risk');
    } else if (salaryAnalysis.positionInRange === 'Target') {
      recommendedPercent = 3;
      reasoning.push('Within target range - merit increase');
    } else {
      recommendedPercent = 2;
      reasoning.push('Above target - minimal adjustment');
    }

    // Performance adjustments
    if (typeof employee.performanceRating === 'string') {
      const rating = employee.performanceRating.toLowerCase();
      if (rating.includes('high') || rating.includes('excellent') || rating.includes('impact')) {
        recommendedPercent += 3;
        reasoning.push('Exceptional performance bonus');
      } else if (rating.includes('successful')) {
        recommendedPercent += 1;
        reasoning.push('Solid performance recognition');
      }
    }

    // Retention risk adjustments
    if (retentionRisk.riskLevel === 'Critical') {
      recommendedPercent += 4;
      reasoning.push('Critical retention risk - significant adjustment needed');
    } else if (retentionRisk.riskLevel === 'High') {
      recommendedPercent += 2;
      reasoning.push('High retention risk - proactive adjustment');
    }

    // Tenure considerations
    if (tenureInfo.lastRaiseMonthsAgo && tenureInfo.lastRaiseMonthsAgo > 18) {
      recommendedPercent += 1;
      reasoning.push('Overdue for increase');
    }

    // Cap at budget constraints
    recommendedPercent = Math.min(recommendedPercent, budgetConstraints.maxPercent);
    
    // Use USD salary for raise calculation to ensure budget consistency
    const usdSalary = employee.baseSalaryUSD || employee.baseSalary || salaryAnalysis.currentSalary;
    const recommendedAmount = Math.round((usdSalary * recommendedPercent) / 100);

    // Determine priority
    let priority: 'Low' | 'Medium' | 'High' | 'Critical';
    if (retentionRisk.riskLevel === 'Critical' || salaryAnalysis.positionInRange === 'Below Range') {
      priority = 'Critical';
    } else if (retentionRisk.riskLevel === 'High' || recommendedPercent >= 6) {
      priority = 'High';
    } else if (recommendedPercent >= 3) {
      priority = 'Medium';
    } else {
      priority = 'Low';
    }

    return {
      recommendedAmount,
      recommendedPercent,
      reasoning,
      priority,
    };
  }

  // Format currency with proper locale
  public static formatCurrency(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  }

  // Format percentage
  public static formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  // Calculate trend data for charts
  public static generateSalaryTrend(
    currentSalary: number,
    yearsBack: number = 3
  ): Array<{ year: string; salary: number; increase: number }> {
    const trend = [];
    const currentYear = new Date().getFullYear();
    
    // Estimate historical data based on current salary
    // This would ideally come from historical data
    for (let i = yearsBack; i >= 0; i--) {
      const year = (currentYear - i).toString();
      const estimatedIncrease = i === 0 ? 0 : Math.random() * 0.05 + 0.02; // 2-7% historical
      const estimatedSalary = i === 0 
        ? currentSalary 
        : Math.round(currentSalary / Math.pow(1.04, i)); // Estimated historical salary
      
      trend.push({
        year,
        salary: estimatedSalary,
        increase: estimatedIncrease * 100,
      });
    }
    
    return trend;
  }
} 