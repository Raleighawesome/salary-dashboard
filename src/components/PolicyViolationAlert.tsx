import React, { useState, useCallback } from 'react';
import type { PolicyViolation } from '../types/employee';
import styles from './PolicyViolationAlert.module.css';

interface PolicyViolationAlertProps {
  violations: PolicyViolation[];
  totalBudget: number;
  currentBudgetUsage: number;
  budgetCurrency: string;
  onConfirm: () => void;
  onCancel: () => void;
  isVisible: boolean;
  actionType: 'export' | 'save' | 'approve' | 'validate';
}

interface ViolationSummary {
  errorCount: number;
  warningCount: number;
  budgetOverage: number;
  criticalViolations: PolicyViolation[];
  warningViolations: PolicyViolation[];
}

export const PolicyViolationAlert: React.FC<PolicyViolationAlertProps> = ({
  violations,
  totalBudget,
  currentBudgetUsage,
  budgetCurrency,
  onConfirm,
  onCancel,
  isVisible,
  actionType
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [acknowledgedRisks, setAcknowledgedRisks] = useState(false);

  // Calculate violation summary
  const violationSummary: ViolationSummary = React.useMemo(() => {
    const criticalViolations = violations.filter(v => v.severity === 'ERROR');
    const warningViolations = violations.filter(v => v.severity === 'WARNING');
    const budgetOverage = Math.max(0, currentBudgetUsage - totalBudget);

    return {
      errorCount: criticalViolations.length,
      warningCount: warningViolations.length,
      budgetOverage,
      criticalViolations,
      warningViolations
    };
  }, [violations, currentBudgetUsage, totalBudget]);

  // Handle confirmation with risk acknowledgment
  const handleConfirm = useCallback(() => {
    if (violationSummary.errorCount > 0 && !acknowledgedRisks) {
      // Require explicit acknowledgment for critical violations
      setAcknowledgedRisks(true);
      return;
    }
    onConfirm();
  }, [violationSummary.errorCount, acknowledgedRisks, onConfirm]);

  // Toggle details view
  const toggleDetails = useCallback(() => {
    setShowDetails(!showDetails);
  }, [showDetails]);

  // Get action-specific messaging
  const getActionMessage = () => {
    switch (actionType) {
      case 'export':
        return 'export the salary raise proposals';
      case 'save':
        return 'save the current changes';
      case 'approve':
        return 'approve these salary raises';
      case 'validate':
        return 'acknowledge these policy issues';
      default:
        return 'proceed with this action';
    }
  };

  // Get severity color class
  const getSeverityClass = (severity: 'ERROR' | 'WARNING') => {
    return severity === 'ERROR' ? styles.error : styles.warning;
  };

  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            {violationSummary.errorCount > 0 ? '🚫' : '⚠️'}
          </div>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>
              {violationSummary.errorCount > 0 ? 'Policy Violations Detected' : 'Policy Warnings'}
            </h2>
            <p className={styles.subtitle}>
              Review the following issues before you {getActionMessage()}
            </p>
          </div>
          <button className={styles.closeButton} onClick={onCancel}>×</button>
        </div>

        {/* Summary Section */}
        <div className={styles.summary}>
          <div className={styles.summaryGrid}>
            {violationSummary.errorCount > 0 && (
              <div className={`${styles.summaryCard} ${styles.errorCard}`}>
                <div className={styles.summaryIcon}>🚫</div>
                <div className={styles.summaryContent}>
                  <div className={styles.summaryNumber}>{violationSummary.errorCount}</div>
                  <div className={styles.summaryLabel}>Critical Issues</div>
                </div>
              </div>
            )}
            
            {violationSummary.warningCount > 0 && (
              <div className={`${styles.summaryCard} ${styles.warningCard}`}>
                <div className={styles.summaryIcon}>⚠️</div>
                <div className={styles.summaryContent}>
                  <div className={styles.summaryNumber}>{violationSummary.warningCount}</div>
                  <div className={styles.summaryLabel}>Warnings</div>
                </div>
              </div>
            )}

            {violationSummary.budgetOverage > 0 && (
              <div className={`${styles.summaryCard} ${styles.budgetCard}`}>
                <div className={styles.summaryIcon}>💰</div>
                <div className={styles.summaryContent}>
                  <div className={styles.summaryNumber}>
                    {budgetCurrency} {violationSummary.budgetOverage.toLocaleString()}
                  </div>
                  <div className={styles.summaryLabel}>Over Budget</div>
                </div>
              </div>
            )}

            <div className={`${styles.summaryCard} ${styles.utilizationCard}`}>
              <div className={styles.summaryIcon}>📊</div>
              <div className={styles.summaryContent}>
                <div className={styles.summaryNumber}>
                  {totalBudget > 0 ? ((currentBudgetUsage / totalBudget) * 100).toFixed(1) : 0}%
                </div>
                <div className={styles.summaryLabel}>Budget Used</div>
              </div>
            </div>
          </div>
        </div>

        {/* Violation Details */}
        <div className={styles.content}>
          <div className={styles.detailsToggle}>
            <button 
              className={styles.toggleButton}
              onClick={toggleDetails}
            >
              {showDetails ? '▼' : '▶'} View Details ({violations.length} issues)
            </button>
          </div>

          {showDetails && (
            <div className={styles.violationsList}>
              {/* Critical Violations */}
              {violationSummary.criticalViolations.length > 0 && (
                <div className={styles.violationSection}>
                  <h3 className={`${styles.sectionTitle} ${styles.errorTitle}`}>
                    🚫 Critical Issues (Must be resolved)
                  </h3>
                  {violationSummary.criticalViolations.map((violation, index) => (
                    <div key={index} className={`${styles.violationItem} ${getSeverityClass(violation.severity)}`}>
                      <div className={styles.violationHeader}>
                         <span className={styles.violationType}>{violation.type.replace(/_/g, ' ')}</span>
                        {(violation.employeeName || violation.employeeId) && (
                          <span className={styles.employeeId}>
                            Employee: {violation.employeeName || violation.employeeId}
                          </span>
                        )}
                      </div>
                      <div className={styles.violationMessage}>{violation.message}</div>
                      {violation.currentValue !== undefined && violation.threshold !== undefined && (
                        <div className={styles.violationMetrics}>
                          Current: {violation.currentValue} | Threshold: {violation.threshold}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Warning Violations */}
              {violationSummary.warningViolations.length > 0 && (
                <div className={styles.violationSection}>
                  <h3 className={`${styles.sectionTitle} ${styles.warningTitle}`}>
                    ⚠️ Warnings (Recommended to review)
                  </h3>
                  {violationSummary.warningViolations.map((violation, index) => (
                    <div key={index} className={`${styles.violationItem} ${getSeverityClass(violation.severity)}`}>
                      <div className={styles.violationHeader}>
                         <span className={styles.violationType}>{violation.type.replace(/_/g, ' ')}</span>
                        {(violation.employeeName || violation.employeeId) && (
                          <span className={styles.employeeId}>
                            Employee: {violation.employeeName || violation.employeeId}
                          </span>
                        )}
                      </div>
                      <div className={styles.violationMessage}>{violation.message}</div>
                      {violation.currentValue !== undefined && violation.threshold !== undefined && (
                        <div className={styles.violationMetrics}>
                          Current: {violation.currentValue} | Threshold: {violation.threshold}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Risk Acknowledgment for Critical Issues */}
        {violationSummary.errorCount > 0 && (
          <div className={styles.acknowledgment}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={acknowledgedRisks}
                onChange={(e) => setAcknowledgedRisks(e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>
                I understand the risks and want to proceed despite the critical policy violations
              </span>
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button 
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
          
          <button 
            className={`${styles.confirmButton} ${
              violationSummary.errorCount > 0 ? styles.dangerButton : styles.warningButton
            }`}
            onClick={handleConfirm}
            disabled={violationSummary.errorCount > 0 && !acknowledgedRisks}
          >
            {violationSummary.errorCount > 0 
              ? `Proceed Anyway (${violationSummary.errorCount} errors)`
              : `Continue (${violationSummary.warningCount} warnings)`
            }
          </button>
        </div>

        {/* Footer with recommendations */}
        <div className={styles.footer}>
          <div className={styles.recommendations}>
            <h4>💡 Recommendations:</h4>
            <ul>
              {violationSummary.budgetOverage > 0 && (
                <li>Consider reducing some proposed raises to stay within budget</li>
              )}
              {violationSummary.criticalViolations.some(v => v.type === 'RAISE_TOO_HIGH') && (
                <li>Review raises that exceed policy limits for your region</li>
              )}
              {violationSummary.criticalViolations.some(v => v.type === 'COMPARATIO_TOO_LOW') && (
                <li>Employees below comparatio floor may need immediate attention</li>
              )}
              <li>Consider discussing critical violations with HR before proceeding</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyViolationAlert; 