import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { BackupManager } from './components/BackupManager';
import { DataProcessor } from './services/dataProcessor';
import { DataStorageService } from './services/dataStorage';
import { AutoBackupService, type BackupData } from './services/autoBackup';
import type { FileUploadResult, Employee } from './types/employee';
import './App.css';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResult[]>([]);
  const [currentView, setCurrentView] = useState<'upload' | 'dashboard'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [processedEmployees, setProcessedEmployees] = useState<Employee[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Budget management state - moved from Dashboard to persist across views
  const [totalBudget, setTotalBudget] = useState<number>(0);
  const [budgetCurrency, setBudgetCurrency] = useState<string>('USD');

  // Session recovery on app load
  useEffect(() => {
    const recoverSession = async () => {
      try {

        
        // Try to get existing employee data
        const existingEmployees = await DataStorageService.getEmployees();
        
        if (existingEmployees.length > 0) {

          
          // Convert EmployeeRecord to Employee format
          const convertedEmployees: Employee[] = existingEmployees.map(emp => ({
            ...emp,
            firstName: emp.name.split(' ')[0] || '',
            lastName: emp.name.split(' ').slice(1).join(' ') || ''
          }));
          
          setProcessedEmployees(convertedEmployees);
          
          // Get session metadata if available
          const currentSession = await DataStorageService.getCurrentSession();
          if (currentSession) {

            
            // Reconstruct uploaded files list from session metadata
            const reconstructedFiles: FileUploadResult[] = [];
            
            if (currentSession.fileMetadata.salaryFile) {
              reconstructedFiles.push({
                fileName: currentSession.fileMetadata.salaryFile.name,
                fileType: 'salary',
                rowCount: currentSession.fileMetadata.salaryFile.rowCount,
                validRows: currentSession.fileMetadata.salaryFile.rowCount, // Assume all valid since processed
                errors: [],
                data: [] // Data is already processed and stored
              });
            }
            
            if (currentSession.fileMetadata.performanceFile) {
              reconstructedFiles.push({
                fileName: currentSession.fileMetadata.performanceFile.name,
                fileType: 'performance',
                rowCount: currentSession.fileMetadata.performanceFile.rowCount,
                validRows: currentSession.fileMetadata.performanceFile.rowCount,
                errors: [],
                data: []
              });
            }
            
            setUploadedFiles(reconstructedFiles);
          }
          
          // Switch to dashboard view if we have data
          setCurrentView('dashboard');
          
        } else {

          
          // Try to restore from backup if no session data
          const backupData = AutoBackupService.restoreFromStorage();
          if (backupData && backupData.employees.length > 0) {

            setProcessedEmployees(backupData.employees);
            setTotalBudget(backupData.budget.totalBudget);
            setBudgetCurrency(backupData.budget.budgetCurrency);
            setCurrentView('dashboard');
          }
        }
        
      } catch (error) {
        console.error('❌ Session recovery failed:', error);
        // Don't show error to user, just start fresh
      } finally {
        setIsLoadingSession(false);
      }
    };

    recoverSession();
  }, []);

  // Handle backup restoration
  const handleRestoreBackup = useCallback((backupData: BackupData) => {
    setProcessedEmployees(backupData.employees);
    setTotalBudget(backupData.budget.totalBudget);
    setBudgetCurrency(backupData.budget.budgetCurrency);
    
    // Switch to dashboard view
    setCurrentView('dashboard');
    

  }, []);

  // Handle successful file upload
  const handleFileUpload = useCallback(async (result: FileUploadResult) => {

    
    try {
      // Process the uploaded file through DataProcessor
      await DataProcessor.processUploadedFile(result);
      
      // Update uploaded files list
      setUploadedFiles(prev => [...prev, result]);
      
      // Get the processed employee data
      const processResult = await DataProcessor.processEmployeeData();
      setProcessedEmployees(processResult.employees);
      

      
      // Auto-switch to dashboard view when we have data
      if (processResult.employees.length > 0) {
        setCurrentView('dashboard');
        
        // Create initial backup after data is loaded
        AutoBackupService.scheduleBackup(processResult.employees, totalBudget, budgetCurrency, 5000);
      }
      
      // Clear any previous errors
      setError(null);
    } catch (error) {
      console.error('❌ Data processing failed:', error);
      setError(`Data processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Handle upload errors
  const handleUploadError = useCallback((errorMessage: string) => {
    console.error('❌ Upload error:', errorMessage);
    setError(errorMessage);
  }, []);

  // Clear error messages
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Switch between views
  const switchView = useCallback((view: 'upload' | 'dashboard') => {
    setCurrentView(view);
    clearError();
  }, [clearError]);

  // Handle employee updates (for inline editing)
  const handleEmployeeUpdate = useCallback((employeeId: string, updates: any) => {
    setProcessedEmployees(prev => {
      const updatedEmployees = prev.map(emp => 
        emp.employeeId === employeeId 
          ? { ...emp, ...updates }
          : emp
      );
      
      // Trigger automatic backup on data changes
      AutoBackupService.scheduleBackup(updatedEmployees, totalBudget, budgetCurrency);
      
      return updatedEmployees;
    });

  }, [totalBudget, budgetCurrency]);

  // Handle budget changes
  const handleBudgetChange = useCallback((budget: number, currency: string) => {
    setTotalBudget(budget);
    setBudgetCurrency(currency);
    
    // Trigger automatic backup on budget changes
    if (processedEmployees.length > 0) {
      AutoBackupService.scheduleBackup(processedEmployees, budget, currency);
    }
    

  }, [processedEmployees]);

  // Handle data reset
  const handleResetData = useCallback(async () => {
    try {

      
      // Reset all services
      await DataStorageService.resetAllData();
      AutoBackupService.resetAllBackups();
      
      // Reset component state
      setProcessedEmployees([]);
      setUploadedFiles([]);
      setTotalBudget(0);
      setBudgetCurrency('USD');
      setCurrentView('upload');
      setError(null);
      setShowResetConfirm(false);
      

    } catch (error) {
      console.error('❌ Reset failed:', error);
      setError(`Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Handle reset confirmation
  const handleResetConfirm = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const handleResetCancel = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  // Use processed employee data instead of raw file data
  const totalEmployees = processedEmployees.length;

  // Show loading screen during session recovery
  if (isLoadingSession) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-spinner">🔄</div>
            <h2>Loading Salary Raise Dashboard</h2>
            <p>Checking for previous session data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">💰 Salary Raise Dashboard</h1>
          <p className="app-subtitle">
            Manage salary raises with budget tracking and policy validation
          </p>
          
          {/* Navigation */}
          <nav className="app-nav">
            <button
              className={`nav-button ${currentView === 'upload' ? 'active' : ''}`}
              onClick={() => switchView('upload')}
            >
              📁 Upload Files
            </button>
            <button
              className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => switchView('dashboard')}
              disabled={totalEmployees === 0}
            >
              📊 Dashboard {totalEmployees > 0 && `(${totalEmployees} employees)`}
            </button>
            {totalEmployees > 0 && (
              <button
                className="nav-button reset-button"
                onClick={handleResetConfirm}
                title="Reset all data to start fresh"
              >
                🔄 Reset Data
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="modal-overlay">
          <div className="modal-content reset-modal">
            <div className="modal-header">
              <h3>⚠️ Reset All Data</h3>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to reset all data? This will:
              </p>
              <ul>
                <li>Delete all uploaded employee data</li>
                <li>Clear budget information</li>
                <li>Remove all backups and session data</li>
                <li>Return you to the upload screen</li>
              </ul>
              <p className="warning-text">
                <strong>This action cannot be undone.</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-button cancel-button"
                onClick={handleResetCancel}
              >
                Cancel
              </button>
              <button 
                className="modal-button confirm-button"
                onClick={handleResetData}
              >
                Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button className="error-close" onClick={clearError}>×</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="app-main">
        {currentView === 'upload' ? (
          <div className="upload-view">
            <div className="view-header">
              <h2>📁 Upload Employee Data</h2>
              <p>Upload your salary and performance files to get started</p>
            </div>
            
            <FileUpload
              onFileUpload={handleFileUpload}
              onError={handleUploadError}
              maxFileSize={50} // 50MB
            />

            {/* Backup Manager */}
            <div style={{ marginTop: '2rem' }}>
              <BackupManager onRestoreBackup={handleRestoreBackup} />
            </div>

            {/* Upload Summary */}
            {uploadedFiles.length > 0 && (
              <div className="upload-summary">
                <h3>📋 Uploaded Files Summary</h3>
                <div className="summary-cards">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="summary-card">
                      <div className="card-header">
                        <span className="file-name">{file.fileName}</span>
                        <span className={`file-type ${file.fileType}`}>{file.fileType}</span>
                      </div>
                      <div className="card-stats">
                        <div className="stat">
                          <span className="stat-label">Total Rows:</span>
                          <span className="stat-value">{file.rowCount}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Valid Rows:</span>
                          <span className="stat-value">{file.validRows}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Success Rate:</span>
                          <span className="stat-value">
                            {file.rowCount > 0 ? ((file.validRows / file.rowCount) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </div>
                      {file.errors.length > 0 && (
                        <div className="card-errors">
                          <span className="error-count">{file.errors.length} issues found</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {totalEmployees > 0 && (
                  <div className="proceed-section">
                    <button
                      className="proceed-button"
                      onClick={() => switchView('dashboard')}
                    >
                      📊 Proceed to Dashboard ({totalEmployees} employees)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="dashboard-view">
            <Dashboard
              employeeData={processedEmployees}
              uploadedFiles={uploadedFiles}
              onBackToUpload={() => switchView('upload')}
              onEmployeeUpdate={handleEmployeeUpdate}
              totalBudget={totalBudget}
              budgetCurrency={budgetCurrency}
              onBudgetChange={handleBudgetChange}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          Built for managers to efficiently allocate salary raises with budget tracking and policy compliance
        </p>
      </footer>
    </div>
  );
}

export default App;
