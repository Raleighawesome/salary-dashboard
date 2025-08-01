import React, { useState, useCallback } from 'react';
import type { FileUploadResult } from '../types/employee';
import { DataParser } from '../services/dataParser';
import styles from './FileUpload.module.css';

interface FileUploadProps {
  onFileUpload: (result: FileUploadResult) => void;
  onError: (error: string) => void;
  acceptedTypes?: string[];
  maxFileSize?: number; // in MB
  disabled?: boolean;
}

interface UploadedFile {
  file: File;
  type: 'salary' | 'performance' | 'unknown';
  status: 'pending' | 'processing' | 'success' | 'error' | 'warning';
  result?: FileUploadResult;
  error?: string;
  validationSummary?: string;
  errorDetails?: string[];
  canProceed?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  onError,
  acceptedTypes = ['.csv', '.xlsx', '.xls'],
  maxFileSize = 10, // 10MB default
  disabled = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  // Toggle error details visibility
  const toggleErrorDetails = useCallback((index: number) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Validate file type and size
  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      return `File type ${fileExtension} not supported. Please upload CSV or XLSX files.`;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return `File size (${fileSizeMB.toFixed(2)}MB) exceeds limit of ${maxFileSize}MB.`;
    }

    return null;
  }, [acceptedTypes, maxFileSize]);

  // Determine file type based on name
  const determineFileType = useCallback((fileName: string): 'salary' | 'performance' | 'unknown' => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('salary') || lowerName.includes('compensation') || lowerName.includes('pay')) {
      return 'salary';
    }
    if (lowerName.includes('performance') || lowerName.includes('review') || lowerName.includes('rating')) {
      return 'performance';
    }
    return 'unknown';
  }, []);

  // Handle file processing
  const processFile = useCallback(async (file: File): Promise<FileUploadResult> => {
    const expectedType = determineFileType(file.name);
    return await DataParser.parseFile(file, expectedType);
  }, [determineFileType]);

  // Handle file selection
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled || isProcessing) return;

    const fileArray = Array.from(files);
    const newUploadedFiles: UploadedFile[] = [];

    // Validate all files first
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        onError(validationError);
        continue;
      }

      const uploadedFile: UploadedFile = {
        file,
        type: determineFileType(file.name),
        status: 'pending',
      };

      newUploadedFiles.push(uploadedFile);
    }

    if (newUploadedFiles.length === 0) return;

    // Update state with new files
    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
    setIsProcessing(true);

    // Process each file
    for (let i = 0; i < newUploadedFiles.length; i++) {
      const uploadedFile = newUploadedFiles[i];
      
      try {
        // Update status to processing
        setUploadedFiles(prev => prev.map(f => 
          f.file === uploadedFile.file 
            ? { ...f, status: 'processing' }
            : f
        ));

        // Process the file
        const result = await processFile(uploadedFile.file);
        
        // Determine status based on result
        let status: UploadedFile['status'] = 'success';
        let validationSummary = '';
        let errorDetails: string[] = [];
        let canProceed = true;

        if (result.errors && result.errors.length > 0) {
          const criticalErrors = result.errors.filter(err => 
            !err.toLowerCase().includes('warning')
          );
          const warnings = result.errors.filter(err => 
            err.toLowerCase().includes('warning')
          );

          if (criticalErrors.length > 0) {
            status = 'error';
            canProceed = false;
            validationSummary = `${criticalErrors.length} error${criticalErrors.length > 1 ? 's' : ''} found`;
          } else if (warnings.length > 0) {
            status = 'warning';
            canProceed = true;
            validationSummary = `${warnings.length} warning${warnings.length > 1 ? 's' : ''} found`;
          }

          errorDetails = result.errors;
        }

        if (status === 'success') {
          validationSummary = `✅ ${result.validRows}/${result.rowCount} rows processed successfully`;
        }
        
        // Update with result
        setUploadedFiles(prev => prev.map(f => 
          f.file === uploadedFile.file 
            ? { 
                ...f, 
                status, 
                result, 
                validationSummary,
                errorDetails,
                canProceed
              }
            : f
        ));

        // Notify parent component if file can proceed
        if (canProceed) {
          onFileUpload(result);
        } else {
          onError(`File ${uploadedFile.file.name} has critical errors and cannot be processed`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Update with error
        setUploadedFiles(prev => prev.map(f => 
          f.file === uploadedFile.file 
            ? { 
                ...f, 
                status: 'error', 
                error: errorMessage,
                validationSummary: 'Processing failed',
                canProceed: false
              }
            : f
        ));

        onError(`Error processing ${uploadedFile.file.name}: ${errorMessage}`);
      }
    }

    setIsProcessing(false);
  }, [disabled, isProcessing, validateFile, determineFileType, processFile, onFileUpload, onError]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // File input change handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  // Clear uploaded files
  const clearFiles = useCallback(() => {
    setUploadedFiles([]);
    setExpandedErrors(new Set());
  }, []);

  // Remove specific file
  const removeFile = useCallback((fileToRemove: File) => {
    setUploadedFiles(prev => prev.filter(f => f.file !== fileToRemove));
  }, []);

  return (
    <div className={styles['file-upload-container']}>
      {/* Drag and Drop Zone */}
      <div
        className={`${styles['file-upload-zone']} ${dragActive ? styles.active : ''} ${disabled ? styles.disabled : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className={styles['upload-content']}>
          <div className={styles['upload-icon']}>📁</div>
          <p className={styles['upload-text']}>
            {isProcessing ? 'Processing files...' : 'Drag and drop your CSV or XLSX files here'}
          </p>
          <p className={styles['upload-subtext']}>
            or
          </p>
          <label className={styles['file-input-label']}>
            <input
              type="file"
              multiple
              accept={acceptedTypes.join(',')}
              onChange={handleFileInputChange}
              disabled={disabled || isProcessing}
              className={styles['file-input']}
            />
            <span className={styles['file-input-button']}>Choose Files</span>
          </label>
        </div>
      </div>

      {/* File List with Enhanced Error Display */}
      {uploadedFiles.length > 0 && (
        <div className={styles['uploaded-files']}>
          <div className={styles['files-header']}>
            <h3>Uploaded Files</h3>
            <button 
              onClick={clearFiles}
              className={styles['clear-files-btn']}
              disabled={isProcessing}
            >
              Clear All
            </button>
          </div>
          
          <div className={styles['files-list']}>
            {uploadedFiles.map((uploadedFile, index) => (
              <div key={index} className={`${styles['file-item']} ${styles[uploadedFile.status]}`}>
                <div className={styles['file-info']}>
                  <span className={styles['file-name']}>{uploadedFile.file.name}</span>
                  <span className={styles['file-type']} data-type={uploadedFile.type}>{uploadedFile.type}</span>
                  <span className={styles['file-size']}>
                    {(uploadedFile.file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                
                <div className={styles['file-status']}>
                  {uploadedFile.status === 'pending' && <span className={styles['status-pending']}>⏳ Pending</span>}
                  {uploadedFile.status === 'processing' && <span className={styles['status-processing']}>🔄 Processing</span>}
                  {uploadedFile.status === 'success' && (
                    <span className={styles['status-success']}>
                      {uploadedFile.validationSummary}
                    </span>
                  )}
                  {uploadedFile.status === 'warning' && (
                    <div className={styles['status-warning-container']}>
                      <span className={styles['status-warning']}>
                        ⚠️ {uploadedFile.validationSummary}
                      </span>
                      {uploadedFile.errorDetails && uploadedFile.errorDetails.length > 0 && (
                        <button
                          onClick={() => toggleErrorDetails(index)}
                          className={styles['toggle-details-btn']}
                        >
                          {expandedErrors.has(index) ? 'Hide Details' : 'Show Details'}
                        </button>
                      )}
                    </div>
                  )}
                  {uploadedFile.status === 'error' && (
                    <div className={styles['status-error-container']}>
                      <span className={styles['status-error']}>
                        ❌ {uploadedFile.validationSummary || 'Error'}
                      </span>
                      {uploadedFile.errorDetails && uploadedFile.errorDetails.length > 0 && (
                        <button
                          onClick={() => toggleErrorDetails(index)}
                          className={styles['toggle-details-btn']}
                        >
                          {expandedErrors.has(index) ? 'Hide Details' : 'Show Details'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Error Details Expansion */}
                {expandedErrors.has(index) && uploadedFile.errorDetails && (
                  <div className={styles['error-details']}>
                    <h4>Validation Details:</h4>
                    <ul className={styles['error-list']}>
                      {uploadedFile.errorDetails.slice(0, 10).map((error, errorIndex) => (
                        <li key={errorIndex} className={styles['error-item']}>
                          {error}
                        </li>
                      ))}
                      {uploadedFile.errorDetails.length > 10 && (
                        <li className={styles['error-item-more']}>
                          ... and {uploadedFile.errorDetails.length - 10} more issues
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => removeFile(uploadedFile.file)}
                  className={styles['remove-file-btn']}
                  disabled={isProcessing}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Instructions */}
      <div className={styles['upload-instructions']}>
        <h4>File Requirements:</h4>
        <ul>
          <li>Supported formats: CSV, XLSX, XLS</li>
          <li>Maximum file size: {maxFileSize}MB</li>
          <li>Required columns: Employee ID, Name</li>
          <li>
            <strong>Salary file:</strong> Must contain salary information (baseSalary, currency, etc.)
          </li>
          <li>
            <strong>Performance file:</strong> Optional, contains performance ratings and metrics
          </li>
        </ul>
        
        <div className={styles['validation-info']}>
          <h4>Validation Process:</h4>
          <ul>
            <li>✅ <strong>Success:</strong> File processed without issues</li>
            <li>⚠️ <strong>Warning:</strong> File has minor issues but can be processed</li>
            <li>❌ <strong>Error:</strong> File has critical issues and cannot be processed</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FileUpload; 