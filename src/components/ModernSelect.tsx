import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ModernSelect.module.css';

interface Option {
  value: string;
  label: string;
  icon?: string;
}

interface ModernSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'large';
  label?: string;
  error?: string;
}

export const ModernSelect: React.FC<ModernSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  variant = 'default',
  label,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setHighlightedIndex(-1);
    }
  }, [isOpen, disabled]);

  const selectOption = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          selectOption(options[highlightedIndex].value);
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : options.length - 1
          );
        }
        break;
    }
  }, [disabled, isOpen, highlightedIndex, options, selectOption]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsRef.current) {
      const highlightedElement = optionsRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [isOpen, highlightedIndex]);

  return (
    <div className={`${styles.selectContainer} ${className}`}>
      {label && (
        <label className={styles.label}>
          {label}
        </label>
      )}
      
      <div
        ref={selectRef}
        className={`
          ${styles.select} 
          ${styles[variant]} 
          ${isOpen ? styles.open : ''} 
          ${disabled ? styles.disabled : ''} 
          ${error ? styles.error : ''}
        `}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label || placeholder}
      >
        <div className={styles.selectedValue}>
          {selectedOption?.icon && (
            <span className={styles.icon}>{selectedOption.icon}</span>
          )}
          <span className={styles.text}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        
        <div className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path
              d="M1 1L6 6L11 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div 
          ref={optionsRef}
          className={`${styles.dropdown} ${styles[`dropdown${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}
          role="listbox"
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              className={`
                ${styles.option} 
                ${highlightedIndex === index ? styles.highlighted : ''} 
                ${value === option.value ? styles.selected : ''}
              `}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(option.value);
              }}
              role="option"
              aria-selected={value === option.value}
            >
              {option.icon && (
                <span className={styles.optionIcon}>{option.icon}</span>
              )}
              <span className={styles.optionText}>{option.label}</span>
              {value === option.value && (
                <div className={styles.checkmark}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.5 4.5L6 12L2.5 8.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default ModernSelect;