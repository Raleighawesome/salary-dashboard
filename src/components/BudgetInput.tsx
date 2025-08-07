import React, { useState, useCallback, useEffect } from 'react';
import styles from './BudgetInput.module.css';
import { ModernSelect } from './ModernSelect';

interface BudgetInputProps {
  initialBudget: number;
  initialCurrency: string;
  onBudgetChange: (budget: number, currency: string) => void;
  currentUsage: number;
  utilizationPercent: number;
}

// Common currencies for salary budgets
const COMMON_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
];

// Convert currencies to options format for ModernSelect
const CURRENCY_OPTIONS = COMMON_CURRENCIES.map(curr => ({
  value: curr.code,
  label: `${curr.code} (${curr.symbol})`,
  icon: curr.symbol
}));

export const BudgetInput: React.FC<BudgetInputProps> = ({
  initialBudget,
  initialCurrency,
  onBudgetChange,
  currentUsage,
  utilizationPercent,
}) => {
  const [budget, setBudget] = useState<string>(initialBudget.toString());
  const [currency, setCurrency] = useState<string>(initialCurrency);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');

  // Update local state when props change
  useEffect(() => {
    setBudget(initialBudget.toString());
    setCurrency(initialCurrency);
  }, [initialBudget, initialCurrency]);

  // Validate budget input
  const validateBudget = useCallback((value: string): boolean => {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      setValidationError('Please enter a valid number');
      return false;
    }
    
    if (numValue < 0) {
      setValidationError('Budget cannot be negative');
      return false;
    }
    
    if (numValue > 1000000000) { // 1 billion limit
      setValidationError('Budget amount is too large');
      return false;
    }
    
    setValidationError('');
    return true;
  }, []);

  // Handle budget input change
  const handleBudgetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBudget(value);
    
    // Real-time validation
    if (value.trim() !== '') {
      validateBudget(value);
    } else {
      setValidationError('');
    }
  }, [validateBudget]);

  // Handle currency change
  const handleCurrencyChange = useCallback((newCurrency: string) => {
    setCurrency(newCurrency);
    
    // If we have a valid budget, update immediately
    const numBudget = parseFloat(budget);
    if (!isNaN(numBudget) && numBudget >= 0) {
      onBudgetChange(numBudget, newCurrency);
    }
  }, [budget, onBudgetChange]);

  // Handle budget submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateBudget(budget)) {
      const numBudget = parseFloat(budget);
      onBudgetChange(numBudget, currency);
      setIsEditing(false);
    }
  }, [budget, currency, validateBudget, onBudgetChange]);

  // Handle edit mode toggle
  const toggleEdit = useCallback(() => {
    setIsEditing(!isEditing);
    if (isEditing) {
      // Cancel editing - revert to original values
      setBudget(initialBudget.toString());
      setCurrency(initialCurrency);
      setValidationError('');
    }
  }, [isEditing, initialBudget, initialCurrency]);

  // Format currency display
  const formatCurrency = useCallback((amount: number, currencyCode: string): string => {
    const currencyInfo = COMMON_CURRENCIES.find(c => c.code === currencyCode);
    const symbol = currencyInfo?.symbol || currencyCode;
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      // Fallback formatting if currency is not supported
      return `${symbol} ${amount.toLocaleString()}`;
    }
  }, []);

  // Calculate remaining budget
  const remainingBudget = initialBudget - currentUsage;
  const isOverBudget = remainingBudget < 0;

  // Get utilization status
  const getUtilizationStatus = (): 'low' | 'medium' | 'high' | 'over' => {
    if (utilizationPercent > 100) return 'over';
    if (utilizationPercent > 80) return 'high';
    if (utilizationPercent > 50) return 'medium';
    return 'low';
  };

  const utilizationStatus = getUtilizationStatus();

  return (
    <div className={styles.budgetInput}>
      <div className={styles.budgetHeader}>
        <h3 className={styles.budgetTitle}>💰 Raise Budget Management</h3>
        <p className={styles.budgetDescription}>
          Set your total budget for salary raises and track utilization in real-time
        </p>
      </div>

      <div className={styles.budgetContent}>
        {/* Budget Input Form */}
        <div className={styles.budgetForm}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Total Budget:</label>
              <div className={styles.inputRow}>
                <ModernSelect
                  value={currency}
                  onChange={handleCurrencyChange}
                  options={CURRENCY_OPTIONS}
                  disabled={!isEditing}
                  variant="compact"
                  className={styles.currencySelect}
                />
                
                <input
                  type="number"
                  value={budget}
                  onChange={handleBudgetChange}
                  placeholder="Enter budget amount"
                  className={`${styles.budgetInput} ${validationError ? styles.error : ''}`}
                  disabled={!isEditing}
                  min="0"
                  step="1000"
                />
                
                <button
                  type="button"
                  onClick={toggleEdit}
                  className={`${styles.editButton} ${isEditing ? styles.cancel : styles.edit}`}
                >
                  {isEditing ? '✕' : '✏️'}
                </button>
                
                {isEditing && (
                  <button
                    type="submit"
                    className={styles.saveButton}
                    disabled={!!validationError || budget.trim() === ''}
                  >
                    ✓
                  </button>
                )}
              </div>
              
              {validationError && (
                <div className={styles.errorMessage}>
                  ⚠️ {validationError}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Budget Visualization */}
        <div className={styles.budgetVisualization}>
          <div className={styles.budgetStats}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Budget</div>
              <div className={styles.statValue}>
                {formatCurrency(initialBudget, currency)}
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
      </div>

    </div>
  );
};

export default BudgetInput; 