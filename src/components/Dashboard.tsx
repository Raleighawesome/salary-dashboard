import React, { useState, useCallback, useMemo } from 'react';
import type { FileUploadResult, PolicyViolation } from '../types/employee';
import { BudgetInput } from './BudgetInput';
import { BudgetSummary } from './BudgetSummary';
import { MetricsHeatMap } from './MetricsHeatMap';
import { EmployeeTable } from './EmployeeTable';
import EmployeeDetail from './EmployeeDetail';
import PolicyViolationAlert from './PolicyViolationAlert';
import { CSVExporter } from '../services/csvExporter';
import { PolicyValidator } from '../utils/policyValidation';
import styles from './Dashboard.module.css';

interface DashboardProps {
  employeeData: any[]; // Will be properly typed when we have the Employee interface
  uploadedFiles: FileUploadResult[];
  onBackToUpload: () => void;
  onEmployeeUpdate: (employeeId: string, updates: any) => void;
  totalBudget: number;
  budgetCurrency: string;
  onBudgetChange: (budget: number, currency: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  employeeData,
  uploadedFiles,
  onBackToUpload,
  onEmployeeUpdate,
  totalBudget,
  budgetCurrency,
  onBudgetChange,
}) => {
  
  // View state
  const [currentView, setCurrentView] = useState<'overview' | 'table'>('overview');
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  
  // Export and validation state
  const [showPolicyAlert, setShowPolicyAlert] = useState(false);
  const [policyViolations, setPolicyViolations] = useState<PolicyViolation[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [pendingAction, setPendingAction] = useState<'export' | 'validate' | null>(null);

  // Calculate current budget usage and metrics
  const budgetMetrics = useMemo(() => {
    const totalCurrentSalary = employeeData.reduce((sum, emp) => {
      return sum + (emp.baseSalaryUSD || emp.baseSalary || 0);
    }, 0);

    const totalProposedRaises = employeeData.reduce((sum, emp) => {
      return sum + (emp.proposedRaise || 0);
    }, 0);

    const remainingBudget = totalBudget - totalProposedRaises;
    const budgetUtilization = totalBudget > 0 ? (totalProposedRaises / totalBudget) * 100 : 0;

    return {
      totalCurrentSalary,
      totalProposedRaises,
      remainingBudget,
      budgetUtilization,
      averageRaisePercent: employeeData.length > 0 
        ? (totalProposedRaises / totalCurrentSalary) * 100 
        : 0,
    };
  }, [employeeData, totalBudget]);

  // Employee metrics for heat map
  const employeeMetrics = useMemo(() => {
    return employeeData
      .filter(emp => emp && emp.employeeId && emp.name) // Filter out invalid entries
      .map(emp => {
        try {
          // Calculate proposed raise percentage safely
          let proposedRaisePercent = 0;
          if (emp.baseSalaryUSD && emp.baseSalaryUSD > 0 && emp.proposedRaise && emp.proposedRaise > 0) {
            proposedRaisePercent = (emp.proposedRaise / emp.baseSalaryUSD) * 100;
          }

          // Process performance rating (can be number or string)
          let performanceRating = 0;
          if (emp.performanceRating !== undefined && emp.performanceRating !== null && emp.performanceRating !== '') {
            const perfRating = typeof emp.performanceRating === 'string' ? parseFloat(emp.performanceRating) : emp.performanceRating;
            if (!isNaN(perfRating) && isFinite(perfRating) && perfRating >= 0) {
              performanceRating = perfRating;
            }
          }

          // Process time in role (ensure it's a valid number)
          let timeInRole = 0;
          if (emp.timeInRole !== undefined && emp.timeInRole !== null) {
            const timeValue = typeof emp.timeInRole === 'string' ? parseFloat(emp.timeInRole) : emp.timeInRole;
            if (!isNaN(timeValue) && isFinite(timeValue) && timeValue >= 0) {
              timeInRole = timeValue;
            }
          }

          return {
            id: emp.employeeId || emp.email || `emp_${Date.now()}_${Math.random()}`,
            name: emp.name || 'Unknown Employee',
            comparatio: typeof emp.comparatio === 'number' && emp.comparatio > 0 ? emp.comparatio : 0,
            performanceRating: performanceRating,
            timeInRole: timeInRole,
            retentionRisk: typeof emp.retentionRisk === 'number' && emp.retentionRisk >= 0 ? emp.retentionRisk : 0,
            proposedRaisePercent: isFinite(proposedRaisePercent) ? proposedRaisePercent : 0,
            currentSalary: typeof emp.baseSalaryUSD === 'number' && emp.baseSalaryUSD > 0 ? emp.baseSalaryUSD : (emp.baseSalary || 0),
          };
        } catch (error) {
          console.error('Error processing employee metrics for:', emp?.name || 'unknown', error);
          return null;
        }
      })
      .filter(emp => emp !== null); // Remove any failed mappings
  }, [employeeData]);


  // Handle employee selection for details view
  const handleEmployeeSelect = useCallback((employee: any) => {
    
    // Check if this is a limited EmployeeMetric object from the heat map
    // (it will only have id, name, comparatio, etc. but not full employee data)
    const isLimitedEmployeeMetric = employee.id && !employee.employeeId && !employee.baseSalary;
    
    if (isLimitedEmployeeMetric) {
      // Find the full employee object from employeeData using the id
      const fullEmployee = employeeData.find(emp => 
        (emp.employeeId === employee.id) || 
        (emp.email === employee.id) ||
        (emp.name === employee.name)
      );
      
      if (fullEmployee) {
  
        setSelectedEmployee(fullEmployee);
      } else {
        console.warn('⚠️ Could not find full employee data for:', employee.name);
        // Fallback: use the limited data but it will show "Not Available" for missing fields
        setSelectedEmployee(employee);
      }
    } else {
      // This is already a full employee object (from employee table)
      setSelectedEmployee(employee);
    }
  }, [employeeData]);

  // Navigation handlers
  const switchToOverview = useCallback(() => {
    setCurrentView('overview');
    setSelectedEmployee(null);
  }, []);

  const switchToTable = useCallback(() => {
    setCurrentView('table');
    setSelectedEmployee(null);
  }, []);

  // Handle closing detail view
  const handleCloseDetails = useCallback(() => {
    setSelectedEmployee(null);
  }, []);

  // Handle policy validation
  const handleValidatePolicies = useCallback(() => {

    
    // Validate all employees
    const allViolations: PolicyViolation[] = [];
    employeeData.forEach(employee => {
      const violations = PolicyValidator.validateEmployee(employee);
      allViolations.push(...violations);
    });

    // Add budget validation
    const budgetViolations = PolicyValidator.validateBudget(
      { 
        totalBudget, 
        currentBudgetUsage: budgetMetrics.totalProposedRaises, 
        employeeCount: employeeData.length 
      },
      0 // Check current state
    );
    allViolations.push(...budgetViolations);

    setPolicyViolations(allViolations);
    setPendingAction('validate');
    
    if (allViolations.length > 0) {
      setShowPolicyAlert(true);
    } else {
      alert('✅ All policies are compliant! No violations found.');
    }
  }, [employeeData, totalBudget, budgetMetrics.totalProposedRaises]);

  // Handle CSV export
  const handleExportCSV = useCallback(async () => {

    
    // First validate policies
    const allViolations: PolicyViolation[] = [];
    employeeData.forEach(employee => {
      const violations = PolicyValidator.validateEmployee(employee);
      allViolations.push(...violations);
    });

    // Add budget validation
    const budgetViolations = PolicyValidator.validateBudget(
      { 
        totalBudget, 
        currentBudgetUsage: budgetMetrics.totalProposedRaises, 
        employeeCount: employeeData.length 
      },
      0
    );
    allViolations.push(...budgetViolations);

    setPolicyViolations(allViolations);
    setPendingAction('export');

    // Show policy alert if there are violations
    if (allViolations.length > 0) {
      setShowPolicyAlert(true);
    } else {
      // No violations, proceed with export
      await performExport();
    }
  }, [employeeData, totalBudget, budgetMetrics.totalProposedRaises]);

  // Perform the actual CSV export
  const performExport = useCallback(async () => {
    setIsExporting(true);
    try {

      
      const exportResult = await CSVExporter.exportEmployeeData(employeeData, {
        includeOriginalData: true,
        includeCalculatedFields: true,
        includePolicyViolations: true,
        includeMetadata: true,
        filterCriteria: {
          onlyWithRaises: false // Include all employees
        }
      });

      if (exportResult.success) {
        CSVExporter.downloadCSV(exportResult);
  
        alert(`✅ Export completed successfully!\n\nFile: ${exportResult.fileName}\nRows: ${exportResult.rowCount}\nTotal Raises: ${budgetCurrency} ${exportResult.totalRaiseAmount.toLocaleString()}`);
      } else {
        console.error('❌ Export failed:', exportResult.error);
        alert(`❌ Export failed: ${exportResult.error}`);
      }
    } catch (error) {
      console.error('❌ Export error:', error);
      alert(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }, [employeeData, budgetCurrency]);

  // Handle policy alert confirmation
  const handlePolicyConfirm = useCallback(async () => {
    setShowPolicyAlert(false);
    
    if (pendingAction === 'export') {
      await performExport();
    } else if (pendingAction === 'validate') {
  
    }
    
    setPendingAction(null);
  }, [pendingAction, performExport]);

  // Handle policy alert cancellation
  const handlePolicyCancel = useCallback(() => {
    setShowPolicyAlert(false);
    setPendingAction(null);

  }, []);

  return (
    <div className={styles.dashboard}>
      {/* Dashboard Header */}
      <div className={styles.dashboardHeader}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <h2 className={styles.dashboardTitle}>📊 Salary Raise Dashboard</h2>
            <p className={styles.dashboardSubtitle}>
              {employeeData.length} employees • {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} uploaded
            </p>
          </div>
          
          {/* Navigation Tabs */}
          <nav className={styles.dashboardNav}>
            <button
              className={`${styles.navTab} ${currentView === 'overview' ? styles.active : ''}`}
              onClick={switchToOverview}
            >
              📈 Overview
            </button>
            <button
              className={`${styles.navTab} ${currentView === 'table' ? styles.active : ''}`}
              onClick={switchToTable}
            >
              📋 Employee Table
            </button>
            <button
              className={styles.backButton}
              onClick={onBackToUpload}
            >
              ← Back to Upload
            </button>
          </nav>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className={`${styles.dashboardContent} ${styles.fullWidth}`}>
        {currentView === 'overview' && (
          <div className={styles.overviewView}>
            {/* Budget Input Section */}
            <div className={styles.budgetSection}>
              <BudgetInput
                initialBudget={totalBudget}
                initialCurrency={budgetCurrency}
                onBudgetChange={onBudgetChange}
                currentUsage={budgetMetrics.totalProposedRaises}
                utilizationPercent={budgetMetrics.budgetUtilization}
              />
            </div>


            {/* Metrics Heat Map */}
            <div className={styles.heatMapSection}>
              <MetricsHeatMap
                employeeMetrics={employeeMetrics}
                onEmployeeSelect={handleEmployeeSelect}
              />
            </div>

            {/* Quick Actions */}
            <div className={styles.quickActions}>
              <h3>🚀 Quick Actions</h3>
              <div className={styles.actionButtons}>
                <button
                  className={styles.actionButton}
                  onClick={switchToTable}
                >
                  📋 View Employee Table
                </button>
                <button
                  className={styles.actionButton}
                  onClick={handleExportCSV}
                  disabled={isExporting || employeeData.length === 0}
                >
                  {isExporting ? '⏳ Exporting...' : '📤 Export Proposals'}
                </button>
                <button
                  className={styles.actionButton}
                  onClick={handleValidatePolicies}
                  disabled={employeeData.length === 0}
                >
                  ⚖️ Validate Policies
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'table' && (
          <div className={styles.tableView}>
            <BudgetSummary
              totalBudget={totalBudget}
              currentUsage={budgetMetrics.totalProposedRaises}
              currency={budgetCurrency}
            />
            <EmployeeTable
              employeeData={employeeData}
              onEmployeeSelect={handleEmployeeSelect}
              onEmployeeUpdate={onEmployeeUpdate}
              budgetCurrency={budgetCurrency}
              totalBudget={totalBudget}
              currentBudgetUsage={budgetMetrics.totalProposedRaises}
            />
          </div>
        )}

        {selectedEmployee && (
          <EmployeeDetail
            employee={selectedEmployee}
            onClose={handleCloseDetails}
            onEmployeeUpdate={onEmployeeUpdate}
            budgetCurrency={budgetCurrency}
            totalBudget={totalBudget}
            currentBudgetUsage={budgetMetrics.totalProposedRaises}
          />
        )}
      </div>

      {/* Policy Violation Alert Modal */}
      <PolicyViolationAlert
        violations={policyViolations}
        totalBudget={totalBudget}
        currentBudgetUsage={budgetMetrics.totalProposedRaises}
        budgetCurrency={budgetCurrency}
        onConfirm={handlePolicyConfirm}
        onCancel={handlePolicyCancel}
        isVisible={showPolicyAlert}
        actionType={pendingAction || 'export'}
      />

      {/* Dashboard Footer with Summary */}
      <div className={styles.dashboardFooter}>
        <div className={`${styles.footerContent} ${currentView === 'table' ? styles.fullWidth : ''}`}>
          <div className={styles.summaryStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Total Budget:</span>
              <span className={styles.statValue}>
                {budgetCurrency} {totalBudget.toLocaleString()}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Allocated:</span>
              <span className={styles.statValue}>
                {budgetCurrency} {budgetMetrics.totalProposedRaises.toLocaleString()}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Remaining:</span>
              <span className={`${styles.statValue} ${budgetMetrics.remainingBudget < 0 ? styles.negative : ''}`}>
                {budgetCurrency} {budgetMetrics.remainingBudget.toLocaleString()}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Utilization:</span>
              <span className={`${styles.statValue} ${budgetMetrics.budgetUtilization > 100 ? styles.warning : ''}`}>
                {budgetMetrics.budgetUtilization.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 