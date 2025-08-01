import React, { useState, useMemo, useCallback } from 'react';
import { EmployeeCalculations } from '../utils/calculations';
import styles from './EmployeeDetail.module.css';

interface EmployeeDetailProps {
  employee: any;
  onClose: () => void;
  onEmployeeUpdate: (employeeId: string, updates: any) => void;
  budgetCurrency: string;
  totalBudget: number;
  currentBudgetUsage: number;
}

export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({
  employee,
  onClose,
  onEmployeeUpdate,
  budgetCurrency,
  totalBudget,
  currentBudgetUsage,
}) => {
  // Validate employee data
  if (!employee) {
    console.error('❌ EmployeeDetail: No employee data provided');
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h2>❌ Error: No Employee Data</h2>
            <button className={styles.closeButton} onClick={onClose}>✕</button>
          </div>
          <div style={{ padding: '24px' }}>
            <p>Employee data is missing or invalid. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  // State for inline editing
  const [isEditingRaise, setIsEditingRaise] = useState(false);
  const [tempProposedRaise, setTempProposedRaise] = useState(employee.proposedRaise || 0);
  const [aiRecommendationApplied, setAiRecommendationApplied] = useState(false);

  // Calculate comprehensive employee analysis
  const analysis = useMemo(() => {
    // Enhanced data extraction with comprehensive field name fallbacks
    const extractFieldValue = (fieldNames: string[], defaultValue: any = null) => {
      for (const fieldName of fieldNames) {
        const value = employee[fieldName];
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
      return defaultValue;
    };

    // Extract salary information with proper separation of local vs USD amounts
    const baseSalaryUSD = extractFieldValue([
      'baseSalaryUSD', 'base_salary_usd', 'salary_usd', 'annual_salary_usd',
      'Base Salary USD', 'Annual Salary USD', 'USD Salary'
    ], 0);

    const baseSalary = extractFieldValue([
      'baseSalary', 'base_salary', 'salary', 'annual_salary',
      'Base Salary', 'Annual Salary', 'Base Pay All Countries', 'Total Base Pay',
      'Annual Calculated Base Pay All Countries'
    ], baseSalaryUSD); // Fallback to USD if local currency not available

    const salaryGradeMin = extractFieldValue([
      'salaryGradeMin', 'salary_grade_min', 'grade_min', 'min_salary',
      'Min Pay Grade Value', 'Salary Grade Min'
    ], baseSalaryUSD * 0.8);

    const salaryGradeMid = extractFieldValue([
      'salaryGradeMid', 'salary_grade_mid', 'grade_mid', 'mid_salary',
      'Mid Pay Grade Value', 'Salary Grade Mid'
    ], baseSalaryUSD * 1.1);

    const salaryGradeMax = extractFieldValue([
      'salaryGradeMax', 'salary_grade_max', 'grade_max', 'max_salary',
      'Max Pay Grade Value', 'Salary Grade Max'
    ], baseSalaryUSD * 1.4);

    const comparatio = extractFieldValue([
      'comparatio', 'Comparatio', 'comp_ratio', 'comparatio_percent'
    ], salaryGradeMid > 0 ? Math.round((baseSalary / salaryGradeMid) * 100) : 0);

    const performanceRating = extractFieldValue([
      'performanceRating', 'performance_rating', 'rating', 'performance',
      'Performance Rating', 'Overall Performance Rating', 'Performance: What (Current)',
      'Performance: How (Current)', 'Overall Performance Rating (Current)'
    ]);

    const timeInRole = extractFieldValue([
      'timeInRole', 'time_in_role', 'months_in_role', 'tenure',
      'Time in Role', 'Months in Role'
    ], 0);

    // Create enhanced employee object with extracted values
    const enhancedEmployee = {
      ...employee,
      baseSalary,
      baseSalaryUSD,
      salaryGradeMin,
      salaryGradeMid,
      salaryGradeMax,
      comparatio,
      performanceRating,
      timeInRole
    };

    // Calculate tenure information (5.5)
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
        'Last Raise Date', 'Last Salary Change Date'
      ])
    );

    // Analyze salary position (5.2) using enhanced employee data
    const salaryAnalysis = EmployeeCalculations.analyzeSalary(enhancedEmployee);

    // Calculate retention risk (5.5)
    const retentionRisk = EmployeeCalculations.calculateRetentionRisk(
      enhancedEmployee,
      tenureInfo
    );

    // Note: Salary trend removed as requested

    // Calculate optimal raise recommendation
    const budgetConstraints = {
      available: totalBudget - currentBudgetUsage,
      maxPercent: employee.location?.toLowerCase().includes('india') ? 10 : 12,
    };

    const raiseRecommendation = EmployeeCalculations.calculateOptimalRaise(
      enhancedEmployee,
      tenureInfo,
      retentionRisk,
      salaryAnalysis,
      budgetConstraints
    );

    return {
      tenureInfo,
      salaryAnalysis,
      retentionRisk,
      raiseRecommendation,
    };
  }, [employee, totalBudget, currentBudgetUsage]);


  // Handle proposed raise editing
  const handleProposedRaiseEdit = useCallback(() => {
    setIsEditingRaise(true);
  }, []);

  const handleProposedRaiseSave = useCallback(() => {
    onEmployeeUpdate(employee.employeeId || employee.id, { proposedRaise: tempProposedRaise });
    setIsEditingRaise(false);
  }, [employee.employeeId, employee.id, tempProposedRaise, onEmployeeUpdate]);

  const handleProposedRaiseCancel = useCallback(() => {
    setTempProposedRaise(employee.proposedRaise || 0);
    setIsEditingRaise(false);
  }, [employee.proposedRaise]);

  // Handle applying AI recommendation
  const handleApplyAIRecommendation = useCallback(() => {
    try {
      const recommendedAmount = analysis.raiseRecommendation.recommendedAmount;
      
      if (typeof recommendedAmount !== 'number' || recommendedAmount < 0) {
        console.error('Invalid recommendation amount:', recommendedAmount);
        return;
      }

      // Log with USD first, local currency in parentheses if different
      const employeeCurrency = employee.currency || 'USD';
      let logMessage = `🤖 Applying AI recommendation: ${formatCurrencyDisplay(recommendedAmount, 'USD')}`;
      
      if (employeeCurrency !== 'USD' && employee.baseSalary && employee.baseSalaryUSD && employee.baseSalaryUSD > 0) {
        const conversionRate = employee.baseSalary / employee.baseSalaryUSD;
        const localAmount = recommendedAmount * conversionRate;
        logMessage += ` (${formatCurrencyDisplay(localAmount, employeeCurrency)})`;
      }
      
  
      
      onEmployeeUpdate(employee.employeeId || employee.id, { proposedRaise: recommendedAmount });
      setTempProposedRaise(recommendedAmount);
      setIsEditingRaise(false);
      
      // Show success indicator
      setAiRecommendationApplied(true);
      
      // Reset success indicator after 3 seconds
      setTimeout(() => {
        setAiRecommendationApplied(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error applying AI recommendation:', error);
    }
  }, [analysis.raiseRecommendation.recommendedAmount, employee.employeeId, employee.id, onEmployeeUpdate]);

  // Format currency display (5.4)
  const formatCurrencyDisplay = useCallback((amount: number, currency?: string) => {
    const displayCurrency = currency || budgetCurrency;
    return EmployeeCalculations.formatCurrency(amount, displayCurrency);
  }, [budgetCurrency]);

  // Calculate new salary with proposed raise
  const newSalary = useMemo(() => {
    return analysis.salaryAnalysis.currentSalary + (employee.proposedRaise || 0);
  }, [analysis.salaryAnalysis.currentSalary, employee.proposedRaise]);

  const newSalaryPercent = useMemo(() => {
    if (analysis.salaryAnalysis.currentSalary === 0) return 0;
    return ((employee.proposedRaise || 0) / analysis.salaryAnalysis.currentSalary) * 100;
  }, [analysis.salaryAnalysis.currentSalary, employee.proposedRaise]);

  // Get performance badge (matching EmployeeTable logic)
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

  // Calculate new comparatio when there's a proposed raise (matching EmployeeTable logic)
  const newComparatio = useMemo(() => {
    const proposedRaise = employee.proposedRaise || 0;
    if (proposedRaise <= 0) return 0;
    
    // Use the same logic as EmployeeTable - calculate using original currency
    const currentSalaryOriginal = employee.baseSalary || 0;
    const salaryGradeMid = employee.salaryGradeMid || analysis.salaryAnalysis.salaryGradeMid || 0;
    
    if (salaryGradeMid <= 0 || currentSalaryOriginal <= 0) return 0;
    
    // Convert USD raise amount to original currency (matching EmployeeTable.tsx lines 294-296)
    const currencyConversionRate = currentSalaryOriginal / (employee.baseSalaryUSD || currentSalaryOriginal);
    const proposedRaiseOriginalCurrency = proposedRaise * currencyConversionRate;
    
    // Calculate new salary in original currency  
    const newSalaryOriginal = currentSalaryOriginal + proposedRaiseOriginalCurrency;
    
    // Calculate comparatio using original currency values (matching EmployeeTable.tsx line 302)
    return Math.round((newSalaryOriginal / salaryGradeMid) * 100);
  }, [employee.proposedRaise, employee.baseSalary, employee.baseSalaryUSD, employee.salaryGradeMid, analysis.salaryAnalysis.salaryGradeMid]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.employeeName}>
              👤 {employee.name || employee.firstName + ' ' + employee.lastName || 'Unknown Employee'}
            </h2>
            <p className={styles.jobTitle}>
              {employee.jobTitle || employee['Business Title'] || employee['Job Profile'] || 'No Title Available'}
            </p>
            <div className={styles.basicInfo}>
              <span className={styles.location}>
                📍 {employee.country || employee.location || 'Unknown Location'}
              </span>
              <span className={styles.employeeId}>
                ID: {employee.employeeId || employee.id || employee.email || 'Unknown ID'}
              </span>
              <span className={styles.manager}>
                👤 Manager: {employee.managerName || employee['Manager Full name'] || 'Not Assigned'}
              </span>
              <span className={styles.tenure}>
                🕒 {analysis.tenureInfo.yearsOfService > 0 
                  ? `${analysis.tenureInfo.yearsOfService} years, ${analysis.tenureInfo.totalTenureMonths % 12} months service`
                  : 'Service length unknown'
                }
              </span>
            </div>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.contentGrid}>
          {/* Left Column */}
          <div className={styles.leftColumn}>
            {/* 1. Current Compensation Card */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>💰 Current Compensation</h3>
              <div className={styles.salaryInfo}>
                <div className={styles.currentSalary}>
                  <span className={styles.label}>Base Salary:</span>
                  <span className={styles.value}>
                    {(() => {
                      // Use the properly converted USD value for display
                      const salaryUSD = employee.baseSalaryUSD || 0;
                      const originalCurrency = employee.currency || 'USD';
                      const originalSalary = employee.baseSalary || 0;
                      
                      if (salaryUSD <= 0) {
                        return 'Not Available';
                      }
                      
                      // Always show USD first
                      const usdDisplay = formatCurrencyDisplay(salaryUSD, 'USD');
                      
                      // For non-USD employees, always show original currency in parentheses
                      if (originalCurrency !== 'USD' && originalSalary > 0) {
                        return (
                          <>
                            {usdDisplay}
                            <div className={styles.originalCurrency}>
                              ({formatCurrencyDisplay(originalSalary, originalCurrency)})
                            </div>
                          </>
                        );
                      }
                      
                      return usdDisplay;
                    })()}
                  </span>
                </div>
                <div className={styles.comparatio}>
                  <span className={styles.label}>Comparatio:</span>
                  <span className={styles.value}>
                    {analysis.salaryAnalysis.comparatio > 0 
                      ? EmployeeCalculations.formatPercentage(analysis.salaryAnalysis.comparatio)
                      : 'Not Available'
                    }
                  </span>
                </div>
                <div className={styles.lastRaise}>
                  <span className={styles.label}>Last Raise Received:</span>
                  <span className={styles.value}>
                    {(() => {
                      const lastRaiseDate = employee.lastRaiseDate ||
                        employee['Last salary change date'] ||
                        employee['last_salary_change_date'] ||
                        employee['last_raise_date'] ||
                        employee['Last Raise Date'];
                      
                      const formattedDate = EmployeeCalculations.formatDate(lastRaiseDate);
                      
                      if (formattedDate === 'Not Available') {
                        return formattedDate;
                      }
                      
                      // Calculate months since last raise
                      const parsedDate = EmployeeCalculations.parseDate(lastRaiseDate);
                      if (parsedDate) {
                        const now = new Date();
                        const monthsSince = Math.floor((now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
                        return `${formattedDate} (${monthsSince} months ago)`;
                      }
                      
                      return formattedDate;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Tenure & Experience Card */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🕒 Tenure & Experience</h3>
              <div className={styles.tenureInfo}>
                <div className={styles.tenureDetail}>
                  <span className={styles.label}>Total Service:</span>
                  <span className={styles.value}>
                    {analysis.tenureInfo.totalTenureMonths > 0 
                      ? `${Math.floor(analysis.tenureInfo.totalTenureMonths / 12)} years, ${analysis.tenureInfo.totalTenureMonths % 12} months`
                      : 'Not Available'}
                  </span>
                </div>
                <div className={styles.tenureDetail}>
                  <span className={styles.label}>Time in Role:</span>
                  <span className={styles.value}>
                    {analysis.tenureInfo.timeInRoleMonths > 0 
                      ? `${Math.floor(analysis.tenureInfo.timeInRoleMonths / 12)} years, ${analysis.tenureInfo.timeInRoleMonths % 12} months`
                      : 'Not Available'
                    }
                  </span>
                </div>
                <div className={styles.tenureDetail}>
                  <span className={styles.label}>Hire Date:</span>
                  <span className={styles.value}>
                    {EmployeeCalculations.formatDate(
                      employee.hireDate ||
                      employee['Latest Hire Date'] ||
                      employee['hire_date'] ||
                      employee['start_date'] ||
                      employee['Hire Date'] ||
                      employee['Start Date']
                    )}
                  </span>
                </div>
                <div className={styles.tenureDetail}>
                  <span className={styles.label}>Role Start Date:</span>
                  <span className={styles.value}>
                    {EmployeeCalculations.formatDate(
                      employee.roleStartDate ||
                      employee['Job Entry Start Date'] ||
                      employee['role_start_date'] ||
                      employee['current_role_start'] ||
                      employee['Role Start Date'] ||
                      employee['Current Role Start']
                    )}
                  </span>
                </div>
                <div className={styles.tenureDetail}>
                  <span className={styles.label}>Experience Level:</span>
                  <span className={`${styles.value} ${styles[analysis.tenureInfo.tenureBand.toLowerCase()]}`}>
                    {analysis.tenureInfo.tenureBand}
                  </span>
                </div>
                {analysis.tenureInfo.lastRaiseMonthsAgo && analysis.tenureInfo.lastRaiseMonthsAgo > 0 && (
                  <div className={styles.tenureDetail}>
                    <span className={styles.label}>Last Raise:</span>
                    <span className={styles.value}>
                      {analysis.tenureInfo.lastRaiseMonthsAgo} months ago
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Retention Risk Analysis Card */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>⚠️ Retention Risk Analysis</h3>
              <div className={styles.retentionRisk}>
                <div className={styles.riskScore}>
                  <span className={styles.label}>Risk Level:</span>
                  <span className={`${styles.riskLevel} ${styles[analysis.retentionRisk.riskLevel.toLowerCase()]}`}>
                    {analysis.retentionRisk.riskLevel}
                  </span>
                  <span className={styles.riskPoints}>
                    ({analysis.retentionRisk.totalRisk}/100)
                  </span>
                </div>
                
                <div className={styles.riskBreakdown}>
                  <div className={styles.riskComponent}>
                    <span className={styles.label}>Salary Risk:</span>
                    <span className={styles.value}>{analysis.retentionRisk.comparatioRisk}/40</span>
                  </div>
                  <div className={styles.riskComponent}>
                    <span className={styles.label}>Performance Risk:</span>
                    <span className={styles.value}>{analysis.retentionRisk.performanceRisk}/30</span>
                  </div>
                  <div className={styles.riskComponent}>
                    <span className={styles.label}>Tenure Risk:</span>
                    <span className={styles.value}>{analysis.retentionRisk.tenureRisk}/20</span>
                  </div>
                  <div className={styles.riskComponent}>
                    <span className={styles.label}>Market Risk:</span>
                    <span className={styles.value}>{analysis.retentionRisk.marketRisk}/10</span>
                  </div>
                </div>

                <div className={styles.riskFactors}>
                  <h4>Risk Factors:</h4>
                  <ul>
                    {analysis.retentionRisk.riskFactors.map((factor, index) => (
                      <li key={index}>{factor}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 7. AI Recommendation Card */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🤖 AI Recommendation</h3>
              <div className={styles.recommendation}>
                <div className={styles.recommendedRaise}>
                  <span className={styles.label}>Recommended Raise:</span>
                  <span className={styles.value}>
                    {(() => {
                      const recommendedAmountUSD = analysis.raiseRecommendation.recommendedAmount;
                      const employeeCurrency = employee.currency || 'USD';
                      const percent = analysis.raiseRecommendation.recommendedPercent;
                      
                      if (recommendedAmountUSD <= 0) {
                        return 'Not Available';
                      }
                      
                      // Always show USD first
                      const usdDisplay = `${formatCurrencyDisplay(recommendedAmountUSD, 'USD')} (${EmployeeCalculations.formatPercentage(percent)})`;
                      
                      // If employee currency is not USD, show original currency in parentheses
                      if (employeeCurrency !== 'USD' && employee.baseSalary && employee.baseSalaryUSD && employee.baseSalaryUSD > 0) {
                        const conversionRate = employee.baseSalary / employee.baseSalaryUSD;
                        const recommendedAmountLocal = recommendedAmountUSD * conversionRate;
                        
                        return (
                          <>
                            {usdDisplay}
                            <div className={styles.originalCurrency}>
                              ({formatCurrencyDisplay(recommendedAmountLocal, employeeCurrency)})
                            </div>
                          </>
                        );
                      }
                      
                      return usdDisplay;
                    })()}
                  </span>
                </div>
                <div className={styles.priority}>
                  <span className={styles.label}>Priority:</span>
                  <span className={`${styles.priorityLevel} ${styles[analysis.raiseRecommendation.priority.toLowerCase()]}`}>
                    {analysis.raiseRecommendation.priority}
                  </span>
                </div>
                <div className={styles.reasoning}>
                  <h4>Reasoning:</h4>
                  <ul>
                    {analysis.raiseRecommendation.reasoning.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className={styles.rightColumn}>
            {/* 2. Performance & Impact Card */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>⭐ Performance & Impact</h3>
              <div className={styles.performanceInfo}>
                <div className={styles.performanceDetail}>
                  <span className={styles.label}>Overall Performance Rating:</span>
                  <span className={styles.value}>
                    {(() => {
                      const rating = employee.performanceRating || 
                        employee['CALIBRATED VALUE: Overall Performance Rating'] ||
                        employee['calibrated value: overall performance rating'] ||
                        'Not Available';
                      
                      const performanceBadge = getPerformanceBadge(rating);
                      
                      return (
                        <span className={`${styles.badge} ${styles[performanceBadge.className]}`}>
                          {rating}
                        </span>
                      );
                    })()}
                  </span>
                </div>
                
                <div className={styles.performanceDetail}>
                  <span className={styles.label}>Future:</span>
                  <span className={styles.value}>
                    {employee.futuretalent || 
                     employee['CALIBRATED VALUE: Identified as Future Talent?'] ||
                     employee['calibrated value: identified as future talent?'] ||
                     'Not Specified'}
                  </span>
                </div>

                <div className={styles.performanceDetail}>
                  <span className={styles.label}>Movement Readiness:</span>
                  <span className={styles.value}>
                    {employee.movementReadiness || 
                     employee['CALIBRATED VALUE: Movement Readiness'] ||
                     employee['calibrated value: movement readiness'] ||
                     'Not Specified'}
                  </span>
                </div>
              </div>

              {/* Expandable Proposed Talent Actions */}
              {(employee.proposedTalentActions || 
                employee['CALIBRATED VALUE: Proposed Talent Actions'] ||
                employee['calibrated value: proposed talent actions']) && (
                <div className={styles.talentActionsContainer}>
                  <details className={styles.expandableDetails} open>
                    <summary className={styles.detailsSummary}>
                      💡 Proposed Talent Actions
                    </summary>
                    <div className={styles.talentActionsContent}>
                      {employee.proposedTalentActions || 
                       employee['CALIBRATED VALUE: Proposed Talent Actions'] ||
                       employee['calibrated value: proposed talent actions'] ||
                       'No actions specified'}
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* 4. Salary Grade Range Card */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>📊 Salary Grade Range</h3>
              <div className={styles.salaryRange}>
                <div className={styles.rangeBar}>
                  <div className={styles.rangeLabels}>
                    <span>Min</span>
                    <span>Midpoint</span>
                    <span>Max</span>
                  </div>
                  <div className={styles.rangeVisual}>
                    <div className={styles.rangeTrack}>
                      <div 
                        className={styles.currentPosition}
                        style={{
                          left: `${Math.max(0, Math.min(100, 
                            ((analysis.salaryAnalysis.currentSalary - analysis.salaryAnalysis.salaryGradeMin) / 
                            (analysis.salaryAnalysis.salaryGradeMax - analysis.salaryAnalysis.salaryGradeMin)) * 100
                          ))}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className={styles.rangeValues}>
                    <span>{formatCurrencyDisplay(analysis.salaryAnalysis.salaryGradeMin)}</span>
                    <span>{formatCurrencyDisplay(analysis.salaryAnalysis.salaryGradeMid)}</span>
                    <span>{formatCurrencyDisplay(analysis.salaryAnalysis.salaryGradeMax)}</span>
                  </div>
                </div>
                <div className={styles.rangeDetails}>
                  <div className={styles.rangeDetail}>
                    <span className={styles.label}>Position in Range:</span>
                    <span className={`${styles.value} ${styles[analysis.salaryAnalysis.positionInRange.toLowerCase().replace(' ', '')]}`}>
                      {analysis.salaryAnalysis.positionInRange}
                    </span>
                  </div>
                  <div className={styles.rangeDetail}>
                    <span className={styles.label}>Room for Growth:</span>
                    <span className={styles.value}>
                      {formatCurrencyDisplay(analysis.salaryAnalysis.roomForGrowth)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Proposed Adjustment Card */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🎯 Proposed Adjustment</h3>
              <div className={styles.proposedRaise}>
                <div className={styles.raiseInput}>
                  <span className={styles.label}>Proposed Raise:</span>
                  {isEditingRaise ? (
                    <div className={styles.editingControls}>
                      <input
                        type="number"
                        value={tempProposedRaise}
                        onChange={(e) => setTempProposedRaise(Number(e.target.value))}
                        className={styles.editInput}
                        min="0"
                        step="500"
                      />
                      <button onClick={handleProposedRaiseSave} className={styles.saveButton}>
                        ✓
                      </button>
                      <button onClick={handleProposedRaiseCancel} className={styles.cancelButton}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className={styles.displayValue} onClick={handleProposedRaiseEdit}>
                      <span className={styles.value}>
                        {formatCurrencyDisplay(employee.proposedRaise || 0)}
                      </span>
                      <span className={styles.editIcon}>✏️</span>
                    </div>
                  )}
                </div>
                
                {(employee.proposedRaise || 0) > 0 && (
                  <div className={styles.raiseCalculations}>
                    <div className={styles.calculation}>
                      <span className={styles.label}>New Salary:</span>
                      <span className={styles.value}>
                        {formatCurrencyDisplay(newSalary)}
                      </span>
                    </div>
                    <div className={styles.calculation}>
                      <span className={styles.label}>Percent Increase:</span>
                      <span className={styles.value}>
                        {EmployeeCalculations.formatPercentage(newSalaryPercent)}
                      </span>
                    </div>
                    <div className={styles.calculation}>
                      <span className={styles.label}>New Comparatio:</span>
                      <span className={styles.value}>
                        {newComparatio > 0 
                          ? EmployeeCalculations.formatPercentage(newComparatio)
                          : 'Not Available'
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <div className={styles.actions}>
            <button 
              className={`${styles.applyRecommendation} ${aiRecommendationApplied ? styles.applied : ''}`}
              onClick={handleApplyAIRecommendation}
              disabled={!analysis.raiseRecommendation.recommendedAmount || analysis.raiseRecommendation.recommendedAmount <= 0 || aiRecommendationApplied}
              title={aiRecommendationApplied 
                ? 'AI Recommendation Applied Successfully!'
                : analysis.raiseRecommendation.recommendedAmount > 0 
                  ? (() => {
                      const recommendedAmountUSD = analysis.raiseRecommendation.recommendedAmount;
                      const employeeCurrency = employee.currency || 'USD';
                      
                      // Always show USD first in tooltip
                      const baseTooltip = `Apply recommended raise of ${formatCurrencyDisplay(recommendedAmountUSD, 'USD')}`;
                      
                      // If employee currency is not USD, add original currency
                      if (employeeCurrency !== 'USD' && employee.baseSalary && employee.baseSalaryUSD && employee.baseSalaryUSD > 0) {
                        const conversionRate = employee.baseSalary / employee.baseSalaryUSD;
                        const recommendedAmountLocal = recommendedAmountUSD * conversionRate;
                        return `${baseTooltip} (${formatCurrencyDisplay(recommendedAmountLocal, employeeCurrency)})`;
                      }
                      
                      return baseTooltip;
                    })()
                  : 'No recommendation available'
              }
            >
              {aiRecommendationApplied ? (
                <>✅ Applied Successfully</>
              ) : (
                <>🤖 Apply AI Recommendation</>
              )}
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetail;