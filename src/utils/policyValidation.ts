import type { PolicyViolation } from '../types/employee';

export interface PolicySettings {
  comparatioFloor: number; // 76%
  maxRaisePercentUS: number; // 12%
  maxRaisePercentIndia: number; // 35%
  noRaiseThresholdMonths: number; // 18 months
}

export interface ValidationContext {
  totalBudget: number;
  currentBudgetUsage: number;
  employeeCount: number;
}

export class PolicyValidator {
  private static defaultPolicies: PolicySettings = {
    comparatioFloor: 76,
    maxRaisePercentUS: 12,
    maxRaisePercentIndia: 35,
    noRaiseThresholdMonths: 18,
  };

  // Validate a single employee against policies
  public static validateEmployee(
    employee: any,
    policies: PolicySettings = this.defaultPolicies
  ): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    // Derive a robust employee display name from many possible fields
    const deriveEmployeeName = (emp: any): string => {
      const directName = emp?.name || emp?.Name || emp?.employeeName || emp?.EmployeeName;
      if (directName && typeof directName === 'string' && directName.trim()) return directName.trim();

      const preferred = emp?.['Preferred Name'] || emp?.['preferred name'];
      if (preferred && typeof preferred === 'string' && preferred.trim()) return preferred.trim();

      const worker = emp?.['Worker'] || emp?.['worker'];
      if (worker && typeof worker === 'string' && worker.trim()) return worker.trim();

      const first = emp?.firstName || emp?.['First Name'] || emp?.firstname;
      const last = emp?.lastName || emp?.['Last Name'] || emp?.lastname;
      const combined = [first, last].filter(Boolean).join(' ').trim();
      if (combined) return combined;

      const email = emp?.email || emp?.['Email'] || '';
      if (email) return email;

      return emp?.employeeId || '';
    };

    const employeeName = deriveEmployeeName(employee);

    // Check comparatio floor
    if (employee.comparatio && employee.comparatio < policies.comparatioFloor) {
      violations.push({
        type: 'COMPARATIO_TOO_LOW',
        severity: 'WARNING',
        message: `Comparatio ${employee.comparatio.toFixed(1)}% is below minimum of ${policies.comparatioFloor}%`,
        employeeId: employee.employeeId,
        employeeName,
        currentValue: employee.comparatio,
        threshold: policies.comparatioFloor,
      });
    }

    // Check raise percentage limits
    if (employee.proposedRaise && employee.baseSalaryUSD) {
      const raisePercent = (employee.proposedRaise / employee.baseSalaryUSD) * 100;
      const maxRaise = employee.country === 'India' 
        ? policies.maxRaisePercentIndia 
        : policies.maxRaisePercentUS;

      if (raisePercent > maxRaise) {
        violations.push({
          type: 'RAISE_TOO_HIGH',
          severity: 'ERROR',
          message: `Proposed raise ${raisePercent.toFixed(1)}% exceeds maximum of ${maxRaise}%`,
          employeeId: employee.employeeId,
          employeeName,
          currentValue: raisePercent,
          threshold: maxRaise,
        });
      }
    }

    // Check if employee needs a raise (time in role)
    if (employee.timeInRole && employee.timeInRole >= policies.noRaiseThresholdMonths) {
      if (!employee.proposedRaise || employee.proposedRaise <= 0) {
        violations.push({
          type: 'NO_RAISE_TOO_LONG',
          severity: 'WARNING',
          message: `Employee has been in role for ${employee.timeInRole} months without a raise`,
          employeeId: employee.employeeId,
          employeeName,
          currentValue: employee.timeInRole,
          threshold: policies.noRaiseThresholdMonths,
        });
      }
    }

    return violations;
  }

  // Validate budget constraints
  public static validateBudget(
    context: ValidationContext,
    proposedAmount: number
  ): PolicyViolation[] {
    const violations: PolicyViolation[] = [];
    const newTotal = context.currentBudgetUsage + proposedAmount;
    const utilizationPercent = (newTotal / context.totalBudget) * 100;

    if (newTotal > context.totalBudget) {
      violations.push({
        type: 'BUDGET_EXCEEDED',
        severity: 'ERROR',
        message: `This raise would exceed budget by ${(newTotal - context.totalBudget).toLocaleString()}`,
        currentValue: utilizationPercent,
        threshold: 100,
      });
    }

    return violations;
  }

  // Get all policy violations for a list of employees
  public static validateAllEmployees(
    employees: any[],
    context: ValidationContext,
    policies: PolicySettings = this.defaultPolicies
  ): PolicyViolation[] {
    const allViolations: PolicyViolation[] = [];

    // Validate individual employees
    employees.forEach(employee => {
      const employeeViolations = this.validateEmployee(employee, policies);
      allViolations.push(...employeeViolations);
    });

    // Validate overall budget
    const budgetViolations = this.validateBudget(context, 0); // Check current state
    allViolations.push(...budgetViolations);

    return allViolations;
  }

  // Calculate new salary based on proposed raise
  public static calculateNewSalary(currentSalary: number, proposedRaise: number): number {
    return currentSalary + proposedRaise;
  }

  // Calculate raise percentage
  public static calculateRaisePercent(currentSalary: number, proposedRaise: number): number {
    if (currentSalary <= 0) return 0;
    return (proposedRaise / currentSalary) * 100;
  }

  // Get violation severity color
  public static getViolationColor(violations: PolicyViolation[]): 'none' | 'warning' | 'error' {
    if (violations.length === 0) return 'none';
    if (violations.some(v => v.severity === 'ERROR')) return 'error';
    return 'warning';
  }

  // Format violation message for display
  public static formatViolationMessage(violations: PolicyViolation[]): string {
    if (violations.length === 0) return '';
    if (violations.length === 1) return violations[0].message;
    return `${violations.length} policy issues detected`;
  }
} 