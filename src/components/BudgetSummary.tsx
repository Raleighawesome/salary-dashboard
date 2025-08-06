import React, { useMemo } from 'react';
import styles from './BudgetSummary.module.css';

interface BudgetSummaryProps {
  totalBudget: number;
  currentUsage: number;
  currency: string;
}

export const BudgetSummary: React.FC<BudgetSummaryProps> = ({
  totalBudget,
  currentUsage,
  currency,
}) => {
  // Calculate budget metrics
  const { remainingBudget, utilizationPercent, isOverBudget, utilizationStatus } = useMemo(() => {
    const remaining = totalBudget - currentUsage;
    const utilization = totalBudget > 0 ? (currentUsage / totalBudget) * 100 : 0;
    const isOver = remaining < 0;
    
    let status: 'low' | 'medium' | 'high' | 'over';
    if (utilization > 100) status = 'over';
    else if (utilization > 80) status = 'high';
    else if (utilization > 50) status = 'medium';
    else status = 'low';
    
    return {
      remainingBudget: remaining,
      utilizationPercent: utilization,
      isOverBudget: isOver,
      utilizationStatus: status,
    };
  }, [totalBudget, currentUsage]);

  // Format currency
  const formatCurrency = (amount: number, currencyCode: string): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toLocaleString()}`;
    }
  };

  return (
    <div className={styles.budgetSummary}>
      {/* Budget Stats */}
      <div className={styles.budgetStats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Budget</div>
          <div className={styles.statValue}>
            {formatCurrency(totalBudget, currency)}
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Currently Allocated</div>
          <div className={styles.statValue}>
            {formatCurrency(currentUsage, currency)}
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Remaining</div>
          <div className={`${styles.statValue} ${isOverBudget ? styles.negative : styles.positive}`}>
            {formatCurrency(remainingBudget, currency)}
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Utilization</div>
          <div className={`${styles.statValue} ${styles[utilizationStatus]}`}>
            {utilizationPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className={styles.progressSection}>
        <div className={styles.progressLabel}>
          Budget Utilization
          {isOverBudget && <span className={styles.overBudgetWarning}>⚠️ Over Budget</span>}
        </div>
        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${styles[utilizationStatus]}`}
            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
          />
          {utilizationPercent > 100 && (
            <div
              className={styles.overageIndicator}
              style={{ left: '100%' }}
            >
              +{(utilizationPercent - 100).toFixed(1)}%
            </div>
          )}
        </div>
        <div className={styles.progressLabels}>
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

export default BudgetSummary;