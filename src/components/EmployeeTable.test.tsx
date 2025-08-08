import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmployeeTable } from './EmployeeTable';

const employees = [
  {
    employeeId: '1',
    email: 'a@b.com',
    name: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    country: 'US',
    currency: 'USD',
    baseSalary: 100000,
    baseSalaryUSD: 100000,
    comparatio: 100,
    timeInRole: 12,
    performanceRating: 'High Impact Performer',
    retentionRisk: 10,
    proposedRaise: 0,
    newSalary: 100000,
    percentChange: 0,
  },
] as any[];

describe('EmployeeTable', () => {
  it('renders header and an employee row', () => {
    render(
      <EmployeeTable
        employeeData={employees}
        onEmployeeSelect={() => {}}
        onEmployeeUpdate={() => {}}
        budgetCurrency="USD"
        totalBudget={1000000}
        currentBudgetUsage={0}
      />
    );

    expect(screen.getByRole('columnheader', { name: /Employee/i })).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    // Performance badge should render
    expect(screen.getByText('High Impact Performer')).toBeInTheDocument();
  });
});


