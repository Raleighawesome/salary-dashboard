import React, { useState, useMemo, useCallback } from 'react';
import styles from './MetricsHeatMap.module.css';

interface EmployeeMetric {
  id: string;
  name: string;
  comparatio: number;
  performanceRating: number;
  timeInRole: number;
  retentionRisk: number;
  proposedRaisePercent: number;
  currentSalary?: number; // Add current salary for tooltip
}

interface MetricsHeatMapProps {
  employeeMetrics: EmployeeMetric[];
  onEmployeeSelect: (employee: EmployeeMetric) => void;
}

type MetricType = 'comparatio' | 'performanceRating' | 'timeInRole' | 'retentionRisk' | 'proposedRaisePercent';

interface MetricConfig {
  label: string;
  description: string;
  unit: string;
  colorScale: 'green-red' | 'red-green' | 'blue-orange';
  thresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  comparatio: {
    label: 'Comparatio',
    description: 'Salary position within grade range',
    unit: '%',
    colorScale: 'red-green',
    thresholds: { excellent: 95, good: 85, fair: 75, poor: 65 },
  },
  performanceRating: {
    label: 'Performance',
    description: 'Latest performance rating',
    unit: '/5',
    colorScale: 'red-green',
    thresholds: { excellent: 4.5, good: 4.0, fair: 3.5, poor: 3.0 },
  },
  timeInRole: {
    label: 'Time in Role',
    description: 'Months in current position',
    unit: 'mo',
    colorScale: 'blue-orange',
    thresholds: { excellent: 36, good: 24, fair: 12, poor: 6 },
  },
  retentionRisk: {
    label: 'Retention Risk',
    description: 'Risk of employee leaving',
    unit: '%',
    colorScale: 'green-red',
    thresholds: { excellent: 20, good: 40, fair: 60, poor: 80 },
  },
  proposedRaisePercent: {
    label: 'Proposed Raise',
    description: 'Proposed salary increase',
    unit: '%',
    colorScale: 'red-green',
    thresholds: { excellent: 8, good: 5, fair: 3, poor: 1 },
  },
};

export const MetricsHeatMap: React.FC<MetricsHeatMapProps> = ({
  employeeMetrics,
  onEmployeeSelect,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('comparatio');
  const [sortBy, setSortBy] = useState<'name' | 'metric'>('metric');
  const [filterThreshold, setFilterThreshold] = useState<'all' | 'poor' | 'fair' | 'good' | 'excellent'>('all');
  const [hoveredEmployee, setHoveredEmployee] = useState<string | null>(null);

  // Safe state update handlers to prevent crashes
  const handleMetricChange = useCallback((newMetric: string) => {
    try {
      setSelectedMetric(newMetric as MetricType);
      setHoveredEmployee(null); // Clear hover state on metric change
    } catch (error) {
      console.error('Error changing metric:', error);
    }
  }, []);

  const handleSortChange = useCallback((newSort: string) => {
    try {
      setSortBy(newSort as 'name' | 'metric');
    } catch (error) {
      console.error('Error changing sort:', error);
    }
  }, []);

  const handleFilterChange = useCallback((newFilter: string) => {
    try {
      setFilterThreshold(newFilter as 'all' | 'poor' | 'fair' | 'good' | 'excellent');
      setHoveredEmployee(null); // Clear hover state on filter change
    } catch (error) {
      console.error('Error changing filter:', error);
    }
  }, []);

  // Get metric configuration
  const metricConfig = METRIC_CONFIGS[selectedMetric];

  // Calculate metric statistics
  const metricStats = useMemo(() => {
    try {
      if (!employeeMetrics || employeeMetrics.length === 0) {
        return { min: 0, max: 0, avg: 0, median: 0 };
      }

      const values = employeeMetrics
        .map(emp => emp && emp[selectedMetric])
        .filter(val => typeof val === 'number' && val > 0 && !isNaN(val) && isFinite(val));

      if (values.length === 0) {
        return { min: 0, max: 0, avg: 0, median: 0 };
      }

      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const median = sorted.length % 2 === 0 
        ? (sorted[Math.floor(sorted.length / 2) - 1] + sorted[Math.floor(sorted.length / 2)]) / 2
        : sorted[Math.floor(sorted.length / 2)];

      return { min, max, avg, median };
    } catch (error) {
      console.error('Error calculating metric stats:', error);
      return { min: 0, max: 0, avg: 0, median: 0 };
    }
  }, [employeeMetrics, selectedMetric]);

  // Get color for metric value and determine if text should be white
  const getMetricColor = useCallback((value: number): { backgroundColor: string; needsWhiteText: boolean } => {
    if (!value || value <= 0 || isNaN(value)) return { backgroundColor: 'transparent', needsWhiteText: false };

    const { thresholds, colorScale } = metricConfig;
    
    let intensity: number;
    if (colorScale === 'red-green') {
      // Higher values are better (performance, raises, comparatio)
      if (value >= thresholds.excellent) intensity = 1.0;
      else if (value >= thresholds.good) intensity = 0.75;
      else if (value >= thresholds.fair) intensity = 0.5;
      else if (value >= thresholds.poor) intensity = 0.25;
      else intensity = 0.1;
    } else if (colorScale === 'green-red') {
      // Lower values are better (retention risk)
      if (selectedMetric === 'retentionRisk') {
        if (value <= thresholds.excellent) intensity = 1.0;
        else if (value <= thresholds.good) intensity = 0.75;
        else if (value <= thresholds.fair) intensity = 0.5;
        else if (value <= thresholds.poor) intensity = 0.25;
        else intensity = 0.1;
      } else {
        // This should not be used anymore since comparatio is now red-green
        if (value >= thresholds.excellent) intensity = 1.0;
        else if (value >= thresholds.good) intensity = 0.75;
        else if (value >= thresholds.fair) intensity = 0.5;
        else if (value >= thresholds.poor) intensity = 0.25;
        else intensity = 0.1;
      }
    } else {
      // Blue-orange for time in role
      if (value >= thresholds.excellent) intensity = 1.0;
      else if (value >= thresholds.good) intensity = 0.75;
      else if (value >= thresholds.fair) intensity = 0.5;
      else if (value >= thresholds.poor) intensity = 0.25;
      else intensity = 0.1;
    }

    const colorIndex = Math.round(intensity * 10);
    const backgroundColor = `var(--heat-${colorScale}-${colorIndex})`;
    
    // White text needed for dark colors (high intensity red-green or green-red scales)
    const needsWhiteText = (colorScale === 'red-green' && intensity >= 0.75) || 
                          (colorScale === 'green-red' && intensity >= 0.75) ||
                          (intensity === 0.1 && colorScale === 'red-green'); // Very low values are dark red

    return { backgroundColor, needsWhiteText };
  }, [metricConfig, selectedMetric]);



  // Filter and sort employees
  const processedEmployees = useMemo(() => {
    try {
      if (!employeeMetrics || employeeMetrics.length === 0) {
        return [];
      }

      // Create a safe copy and validate data
      let filtered = employeeMetrics
        .filter(emp => emp && emp.id && emp.name) // Filter out invalid entries
        .map(emp => ({ ...emp })); // Create deep copy to avoid mutations

      // Apply threshold filter
      if (filterThreshold !== 'all') {
        filtered = filtered.filter(emp => {
          try {
            const metricValue = emp[selectedMetric];
            if (typeof metricValue !== 'number' || metricValue <= 0 || isNaN(metricValue)) {
              return false; // Exclude employees with no valid data
            }
            
            const { thresholds } = metricConfig;
            
            let category: 'excellent' | 'good' | 'fair' | 'poor';
            if (selectedMetric === 'retentionRisk') {
              if (metricValue <= thresholds.excellent) category = 'excellent';
              else if (metricValue <= thresholds.good) category = 'good';
              else if (metricValue <= thresholds.fair) category = 'fair';
              else category = 'poor';
            } else {
              if (metricValue >= thresholds.excellent) category = 'excellent';
              else if (metricValue >= thresholds.good) category = 'good';
              else if (metricValue >= thresholds.fair) category = 'fair';
              else category = 'poor';
            }
            
            return category === filterThreshold;
          } catch (error) {
            console.error('Error filtering employee:', emp?.name || 'unknown', error);
            return false;
          }
        });
      }

      // Sort employees
      filtered.sort((a, b) => {
        try {
          if (sortBy === 'name') {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB);
          } else {
            // Sort by metric value (descending for most metrics, ascending for retention risk)
            const aVal = typeof a[selectedMetric] === 'number' ? a[selectedMetric] : 0;
            const bVal = typeof b[selectedMetric] === 'number' ? b[selectedMetric] : 0;
            
            if (selectedMetric === 'retentionRisk') {
              return aVal - bVal; // Ascending (lower risk first)
            } else {
              return bVal - aVal; // Descending (higher values first)
            }
          }
        } catch (error) {
          console.error('Error sorting employees:', error);
          return 0;
        }
      });

      return filtered;
    } catch (error) {
      console.error('Error processing employees for heat map:', error);
      return [];
    }
  }, [employeeMetrics, selectedMetric, sortBy, filterThreshold, metricConfig]);

  // Format metric value for display
  const formatMetricValue = useCallback((value: number): string => {
    if (typeof value !== 'number' || value <= 0 || isNaN(value) || !isFinite(value)) {
      return 'N/A';
    }
    
    try {
      if (selectedMetric === 'comparatio') {
        // Comparatio is already a percentage (e.g., 91 for 91%), so don't multiply by 100
        return `${Math.round(value)}%`;
      } else if (selectedMetric === 'performanceRating') {
        return value.toFixed(1);
      } else if (selectedMetric === 'timeInRole') {
        return `${Math.round(value)}mo`;
      } else if (selectedMetric === 'retentionRisk' || selectedMetric === 'proposedRaisePercent') {
        return `${value.toFixed(1)}%`;
      }
      
      return value.toString();
    } catch (error) {
      console.error('Error formatting metric value:', value, error);
      return 'N/A';
    }
  }, [selectedMetric]);

  return (
    <div className={styles.metricsHeatMap}>
      <div className={styles.heatMapHeader}>
        <div className={styles.titleSection}>
          <h3 className={styles.heatMapTitle}>🔥 Employee Metrics Heat Map</h3>
          <p className={styles.heatMapDescription}>
            Visual representation of employee metrics - click on any employee for details
          </p>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>Metric:</label>
            <select
              value={selectedMetric}
              onChange={(e) => handleMetricChange(e.target.value)}
              className={styles.metricSelect}
            >
              {Object.entries(METRIC_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="metric">By Metric Value</option>
              <option value="name">By Name</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>Filter:</label>
            <select
              value={filterThreshold}
              onChange={(e) => handleFilterChange(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Employees</option>
              <option value="poor">Needs Attention</option>
              <option value="fair">Fair Performance</option>
              <option value="good">Good Performance</option>
              <option value="excellent">Excellent Performance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metric Info */}
      <div className={styles.metricInfo}>
        <div className={styles.metricDescription}>
          <strong>{metricConfig.label}:</strong> {metricConfig.description}
        </div>
        <div className={styles.metricStats}>
          <span>Min: {formatMetricValue(metricStats.min)}</span>
          <span>Avg: {formatMetricValue(metricStats.avg)}</span>
          <span>Max: {formatMetricValue(metricStats.max)}</span>
          <span>Showing: {processedEmployees.length} employees</span>
        </div>
      </div>

      {/* Color Legend */}
      <div className={styles.colorLegend}>
        <div className={styles.legendTitle}>Performance Scale:</div>
        <div className={styles.legendScale}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.excellent}`}></div>
            <span>Excellent</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.good}`}></div>
            <span>Good</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.fair}`}></div>
            <span>Fair</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.poor}`}></div>
            <span>Poor</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.noData}`}></div>
            <span>No Data</span>
          </div>
        </div>
      </div>

      {/* Heat Map Grid */}
      <div className={styles.heatMapGrid}>
        {processedEmployees.map((employee) => {
          try {
            if (!employee || !employee.id) {
              return null;
            }

            const metricValue = typeof employee[selectedMetric] === 'number' ? employee[selectedMetric] : 0;
            const colorInfo = getMetricColor(metricValue);
            
            // Calculate performance category inline
            const { thresholds } = metricConfig;
            let category: 'excellent' | 'good' | 'fair' | 'poor';
            if (metricValue <= 0 || !isFinite(metricValue)) {
              category = 'poor';
            } else if (selectedMetric === 'retentionRisk') {
              if (metricValue <= thresholds.excellent) category = 'excellent';
              else if (metricValue <= thresholds.good) category = 'good';
              else if (metricValue <= thresholds.fair) category = 'fair';
              else category = 'poor';
            } else {
              if (metricValue >= thresholds.excellent) category = 'excellent';
              else if (metricValue >= thresholds.good) category = 'good';
              else if (metricValue >= thresholds.fair) category = 'fair';
              else category = 'poor';
            }
            
            return (
              <div
                key={employee.id}
                className={`${styles.employeeCell} ${styles[category]} ${colorInfo.needsWhiteText ? styles.whiteText : ''}`}
                style={{
                  backgroundColor: colorInfo.backgroundColor,
                }}
                onClick={() => {
                  try {
                    onEmployeeSelect(employee);
                  } catch (error) {
                    console.error('Error selecting employee:', error);
                  }
                }}
                onMouseEnter={() => setHoveredEmployee(employee.id)}
                onMouseLeave={() => setHoveredEmployee(null)}
              >
                <div className={styles.employeeName}>
                  {employee.name || 'Unknown'}
                </div>
                <div className={styles.employeeValue}>
                  {formatMetricValue(metricValue)}
                </div>
                
                {/* Tooltip */}
                {hoveredEmployee === employee.id && (
                  <div className={styles.tooltip}>
                    <div className={styles.tooltipHeader}>
                      <strong>{employee.name || 'Unknown'}</strong>
                    </div>
                    <div className={styles.tooltipContent}>
                      <div className={styles.tooltipMetric}>
                        <span>Current Salary:</span>
                        <span>{employee.currentSalary && employee.currentSalary > 0 ? `$${employee.currentSalary.toLocaleString()}` : 'N/A'}</span>
                      </div>
                      <div className={styles.tooltipMetric}>
                        <span>Comparatio:</span>
                        <span>{employee.comparatio > 0 ? `${Math.round(employee.comparatio)}%` : 'N/A'}</span>
                      </div>
                      <div className={styles.tooltipMetric}>
                        <span>Performance:</span>
                        <span>{typeof employee.performanceRating === 'number' && employee.performanceRating >= 0 ? employee.performanceRating.toFixed(1) : 'N/A'}</span>
                      </div>
                      <div className={styles.tooltipMetric}>
                        <span>Time in Role:</span>
                        <span>{typeof employee.timeInRole === 'number' && employee.timeInRole >= 0 ? `${Math.round(employee.timeInRole)}mo` : 'N/A'}</span>
                      </div>
                      <div className={styles.tooltipMetric}>
                        <span>Retention Risk:</span>
                        <span>{employee.retentionRisk >= 0 ? `${employee.retentionRisk.toFixed(1)}%` : 'N/A'}</span>
                      </div>
                      <div className={styles.tooltipMetric}>
                        <span>Proposed Raise:</span>
                        <span>{employee.proposedRaisePercent > 0 ? `${employee.proposedRaisePercent.toFixed(1)}%` : 'N/A'}</span>
                      </div>
                    </div>
                    <div className={styles.tooltipFooter}>
                      Click for details
                    </div>
                  </div>
                )}
              </div>
            );
          } catch (error) {
            console.error('Error rendering employee cell:', employee?.name || 'unknown', error);
            return null;
          }
        })}
      </div>

      {/* Empty State */}
      {processedEmployees.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📊</div>
          <div className={styles.emptyTitle}>No employees match the current filter</div>
          <div className={styles.emptyDescription}>
            Try adjusting the filter criteria or selecting a different metric
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className={styles.summaryStats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Total Employees:</span>
          <span className={styles.statValue}>{employeeMetrics.length}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Filtered View:</span>
          <span className={styles.statValue}>{processedEmployees.length}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Current Metric:</span>
          <span className={styles.statValue}>{metricConfig.label}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Average Value:</span>
          <span className={styles.statValue}>{formatMetricValue(metricStats.avg)}</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsHeatMap; 