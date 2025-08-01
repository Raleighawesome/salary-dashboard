import React, { useMemo } from 'react';
import styles from './MetricsCards.module.css';

interface BudgetMetrics {
  totalCurrentSalary: number;
  totalProposedRaises: number;
  remainingBudget: number;
  budgetUtilization: number;
  averageRaisePercent: number;
}

interface MetricsCardsProps {
  totalEmployees: number;
  totalBudget: number;
  budgetCurrency: string;
  budgetMetrics: BudgetMetrics;
  employeeData: any[];
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  totalEmployees,
  totalBudget,
  budgetCurrency,
  budgetMetrics,
  employeeData,
}) => {
  // Calculate additional metrics
  const additionalMetrics = useMemo(() => {
    // Performance distribution
    const performanceRatings = employeeData
      .map(emp => emp.performanceRating)
      .filter(rating => rating && rating > 0);
    
    const avgPerformance = performanceRatings.length > 0
      ? performanceRatings.reduce((sum, rating) => sum + rating, 0) / performanceRatings.length
      : 0;

    // Comparatio analysis
    const comparatios = employeeData
      .map(emp => emp.comparatio)
      .filter(comp => comp && comp > 0);
    
    const avgComparatio = comparatios.length > 0
      ? comparatios.reduce((sum, comp) => sum + comp, 0) / comparatios.length
      : 0;

    // Employees with raises
    const employeesWithRaises = employeeData.filter(emp => 
      emp.proposedRaise && emp.proposedRaise > 0
    ).length;

    // High performers (rating >= 4.0)
    const highPerformers = employeeData.filter(emp => 
      emp.performanceRating && emp.performanceRating >= 4.0
    ).length;

    // At-risk employees (low comparatio or high retention risk)
    const atRiskEmployees = employeeData.filter(emp => 
      (emp.comparatio && emp.comparatio < 0.8) || 
      (emp.retentionRisk && emp.retentionRisk > 70)
    ).length;

    // Currency distribution
    const currencies = new Set(employeeData.map(emp => emp.currency).filter(Boolean));

    return {
      avgPerformance,
      avgComparatio,
      employeesWithRaises,
      highPerformers,
      atRiskEmployees,
      currencyCount: currencies.size,
    };
  }, [employeeData]);

  // Format currency
  const formatCurrency = (amount: number): string => {
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
  };

  // Get status color for metrics
  const getStatusColor = (value: number, thresholds: { good: number; warning: number }): string => {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'critical';
  };

  return (
    <div className={styles.metricsCards}>
      <div className={styles.cardsHeader}>
        <h3 className={styles.cardsTitle}>📊 Key Metrics</h3>
        <p className={styles.cardsSubtitle}>
          Overview of your salary raise allocation and employee metrics
        </p>
      </div>

      <div className={styles.cardsGrid}>
        {/* Budget Overview Card */}
        <div className={`${styles.metricCard} ${styles.budgetCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>💰</div>
            <div className={styles.cardTitle}>Budget Overview</div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.primaryMetric}>
              <div className={styles.metricValue}>
                {formatCurrency(budgetMetrics.totalProposedRaises)}
              </div>
              <div className={styles.metricLabel}>Total Allocated</div>
            </div>
            <div className={styles.secondaryMetrics}>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Budget:</span>
                <span className={styles.secondaryValue}>
                  {formatCurrency(totalBudget)}
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Remaining:</span>
                <span className={`${styles.secondaryValue} ${budgetMetrics.remainingBudget < 0 ? styles.negative : styles.positive}`}>
                  {formatCurrency(budgetMetrics.remainingBudget)}
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Utilization:</span>
                <span className={`${styles.secondaryValue} ${styles[getStatusColor(budgetMetrics.budgetUtilization, { good: 80, warning: 50 })]}`}>
                  {budgetMetrics.budgetUtilization.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Overview Card */}
        <div className={`${styles.metricCard} ${styles.employeeCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>👥</div>
            <div className={styles.cardTitle}>Employee Overview</div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.primaryMetric}>
              <div className={styles.metricValue}>{totalEmployees}</div>
              <div className={styles.metricLabel}>Total Employees</div>
            </div>
            <div className={styles.secondaryMetrics}>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>With Raises:</span>
                <span className={styles.secondaryValue}>
                  {additionalMetrics.employeesWithRaises} ({((additionalMetrics.employeesWithRaises / totalEmployees) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>High Performers:</span>
                <span className={styles.secondaryValue}>
                  {additionalMetrics.highPerformers} ({((additionalMetrics.highPerformers / totalEmployees) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>At Risk:</span>
                <span className={`${styles.secondaryValue} ${additionalMetrics.atRiskEmployees > 0 ? styles.warning : styles.good}`}>
                  {additionalMetrics.atRiskEmployees}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics Card */}
        <div className={`${styles.metricCard} ${styles.performanceCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>⭐</div>
            <div className={styles.cardTitle}>Performance Metrics</div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.primaryMetric}>
              <div className={styles.metricValue}>
                {additionalMetrics.avgPerformance.toFixed(1)}
              </div>
              <div className={styles.metricLabel}>Avg Performance Rating</div>
            </div>
            <div className={styles.secondaryMetrics}>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Avg Comparatio:</span>
                <span className={`${styles.secondaryValue} ${styles[getStatusColor(additionalMetrics.avgComparatio * 100, { good: 90, warning: 80 })]}`}>
                  {(additionalMetrics.avgComparatio * 100).toFixed(1)}%
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Avg Raise %:</span>
                <span className={styles.secondaryValue}>
                  {budgetMetrics.averageRaisePercent.toFixed(1)}%
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Currencies:</span>
                <span className={styles.secondaryValue}>
                  {additionalMetrics.currencyCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Salary Analysis Card */}
        <div className={`${styles.metricCard} ${styles.salaryCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>💵</div>
            <div className={styles.cardTitle}>Salary Analysis</div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.primaryMetric}>
              <div className={styles.metricValue}>
                {formatCurrency(budgetMetrics.totalCurrentSalary / totalEmployees)}
              </div>
              <div className={styles.metricLabel}>Avg Current Salary</div>
            </div>
            <div className={styles.secondaryMetrics}>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Total Payroll:</span>
                <span className={styles.secondaryValue}>
                  {formatCurrency(budgetMetrics.totalCurrentSalary)}
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Avg Raise Amount:</span>
                <span className={styles.secondaryValue}>
                  {additionalMetrics.employeesWithRaises > 0 
                    ? formatCurrency(budgetMetrics.totalProposedRaises / additionalMetrics.employeesWithRaises)
                    : formatCurrency(0)
                  }
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Budget Impact:</span>
                <span className={styles.secondaryValue}>
                  {totalBudget > 0 
                    ? ((budgetMetrics.totalProposedRaises / budgetMetrics.totalCurrentSalary) * 100).toFixed(2)
                    : '0.00'
                  }% of payroll
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Assessment Card */}
        <div className={`${styles.metricCard} ${styles.riskCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>⚠️</div>
            <div className={styles.cardTitle}>Risk Assessment</div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.primaryMetric}>
              <div className={styles.metricValue}>
                {additionalMetrics.atRiskEmployees}
              </div>
              <div className={styles.metricLabel}>At-Risk Employees</div>
            </div>
            <div className={styles.secondaryMetrics}>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Budget Risk:</span>
                <span className={`${styles.secondaryValue} ${budgetMetrics.budgetUtilization > 100 ? styles.critical : budgetMetrics.budgetUtilization > 90 ? styles.warning : styles.good}`}>
                  {budgetMetrics.budgetUtilization > 100 ? 'Over Budget' : 
                   budgetMetrics.budgetUtilization > 90 ? 'High Risk' : 'Low Risk'}
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Policy Violations:</span>
                <span className={styles.secondaryValue}>
                  TBD (Task 6.0)
                </span>
              </div>
              <div className={styles.secondaryMetric}>
                <span className={styles.secondaryLabel}>Data Quality:</span>
                <span className={styles.secondaryValue}>
                  {((employeeData.filter(emp => emp.name && (emp.employeeId || emp.email)).length / totalEmployees) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Card */}
        <div className={`${styles.metricCard} ${styles.statsCard}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>📈</div>
            <div className={styles.cardTitle}>Quick Stats</div>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.quickStats}>
              <div className={styles.quickStat}>
                <div className={styles.quickStatValue}>
                  {((additionalMetrics.employeesWithRaises / totalEmployees) * 100).toFixed(0)}%
                </div>
                <div className={styles.quickStatLabel}>Receiving Raises</div>
              </div>
              <div className={styles.quickStat}>
                <div className={styles.quickStatValue}>
                  {((additionalMetrics.highPerformers / totalEmployees) * 100).toFixed(0)}%
                </div>
                <div className={styles.quickStatLabel}>High Performers</div>
              </div>
              <div className={styles.quickStat}>
                <div className={styles.quickStatValue}>
                  {budgetMetrics.averageRaisePercent.toFixed(1)}%
                </div>
                <div className={styles.quickStatLabel}>Avg Raise</div>
              </div>
              <div className={styles.quickStat}>
                <div className={styles.quickStatValue}>
                  {additionalMetrics.currencyCount}
                </div>
                <div className={styles.quickStatLabel}>Currencies</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsCards; 