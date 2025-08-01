export interface NameParts {
  firstName: string;
  lastName: string;
  middleName?: string;
  fullName: string;
  displayName: string; // Formatted as "Firstname Lastname"
}

export interface NameNormalizationOptions {
  preserveMiddleName?: boolean; // Default: false - include middle name in lastName
  handleSuffixes?: boolean; // Default: true - handle Jr, Sr, III, etc.
  capitalizeNames?: boolean; // Default: true - proper case formatting
  trimWhitespace?: boolean; // Default: true - remove extra spaces
}

export class NameNormalizer {
  // Common name suffixes to handle
  private static readonly SUFFIXES = [
    'jr', 'jr.', 'senior', 'sr', 'sr.', 'junior',
    'ii', 'iii', 'iv', 'v', '2nd', '3rd', '4th', '5th',
    'phd', 'md', 'dds', 'esq', 'cpa'
  ];

  // Common prefixes to handle
  private static readonly PREFIXES = [
    'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss',
    'dr', 'dr.', 'prof', 'prof.', 'rev', 'rev.'
  ];

  /**
   * Main normalization function - handles various input formats
   */
  public static normalizeName(
    input: string | { firstName?: string; lastName?: string; name?: string },
    options: NameNormalizationOptions = {}
  ): NameParts {
    // Set default options
    const opts: Required<NameNormalizationOptions> = {
      preserveMiddleName: options.preserveMiddleName ?? false,
      handleSuffixes: options.handleSuffixes ?? true,
      capitalizeNames: options.capitalizeNames ?? true,
      trimWhitespace: options.trimWhitespace ?? true,
    };

    let rawName = '';
    let existingFirstName = '';
    let existingLastName = '';

    // Handle different input types
    if (typeof input === 'string') {
      rawName = input;
    } else {
      // Object input with separate fields
      existingFirstName = input.firstName || '';
      existingLastName = input.lastName || '';
      rawName = input.name || `${existingFirstName} ${existingLastName}`.trim();
    }

    // If we have separate first/last names and they seem valid, use them
    if (existingFirstName && existingLastName && !rawName.includes(',')) {
      return this.createNameParts(existingFirstName, existingLastName, '', opts);
    }

    // Clean and normalize the raw name string
    const cleanName = opts.trimWhitespace ? this.cleanWhitespace(rawName) : rawName;
    
    if (!cleanName) {
      return this.createEmptyNameParts();
    }

    // Parse the name based on format
    return this.parseNameString(cleanName, opts);
  }

  /**
   * Parse a name string into components
   */
  private static parseNameString(
    name: string,
    options: Required<NameNormalizationOptions>
  ): NameParts {
    // Handle "Last, First" format (common in HR systems)
    if (name.includes(',')) {
      return this.parseCommaSeparatedName(name, options);
    }

    // Handle "First Last" or "First Middle Last" format
    return this.parseSpaceSeparatedName(name, options);
  }

  /**
   * Parse "Last, First Middle" format
   */
  private static parseCommaSeparatedName(
    name: string,
    options: Required<NameNormalizationOptions>
  ): NameParts {
    const parts = name.split(',').map(p => p.trim());
    
    if (parts.length < 2) {
      return this.parseSpaceSeparatedName(name, options);
    }

    const lastName = parts[0];
    const firstPart = parts[1];

    // Split the first part to handle middle names
    const firstNames = firstPart.split(/\s+/).filter(p => p.length > 0);
    
    if (firstNames.length === 0) {
      return this.createEmptyNameParts();
    }

    const firstName = firstNames[0];
    const middleName = firstNames.slice(1).join(' ');

    return this.createNameParts(firstName, lastName, middleName, options);
  }

  /**
   * Parse "First Middle Last" format
   */
  private static parseSpaceSeparatedName(
    name: string,
    options: Required<NameNormalizationOptions>
  ): NameParts {
    let parts = name.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length === 0) {
      return this.createEmptyNameParts();
    }

    // Remove prefixes
    parts = this.removePrefixes(parts);
    
    // Handle suffixes
    let suffixes: string[] = [];
    if (options.handleSuffixes) {
      const result = this.extractSuffixes(parts);
      parts = result.nameParts;
      suffixes = result.suffixes;
    }

    if (parts.length === 1) {
      // Only one name - treat as first name
      return this.createNameParts(parts[0], '', '', options);
    } else if (parts.length === 2) {
      // First Last
      const [firstName, lastName] = parts;
      const finalLastName = suffixes.length > 0 
        ? `${lastName} ${suffixes.join(' ')}`
        : lastName;
      return this.createNameParts(firstName, finalLastName, '', options);
    } else {
      // First Middle... Last
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];
      const middleParts = parts.slice(1, -1);
      
      let finalLastName = lastName;
      let middleName = middleParts.join(' ');

      // Handle suffixes
      if (suffixes.length > 0) {
        if (options.preserveMiddleName) {
          finalLastName = `${lastName} ${suffixes.join(' ')}`;
        } else {
          // Include suffixes in last name
          finalLastName = `${lastName} ${suffixes.join(' ')}`;
        }
      }

      // Handle middle name based on options
      if (!options.preserveMiddleName && middleName) {
        finalLastName = `${middleName} ${finalLastName}`;
        middleName = '';
      }

      return this.createNameParts(firstName, finalLastName, middleName, options);
    }
  }

  /**
   * Remove common prefixes from name parts
   */
  private static removePrefixes(parts: string[]): string[] {
    if (parts.length === 0) return parts;
    
    const firstPart = parts[0].toLowerCase().replace(/\./g, '');
    if (this.PREFIXES.includes(firstPart)) {
      return parts.slice(1);
    }
    
    return parts;
  }

  /**
   * Extract suffixes from name parts
   */
  private static extractSuffixes(parts: string[]): { nameParts: string[]; suffixes: string[] } {
    const suffixes: string[] = [];
    const nameParts = [...parts];

    // Check from the end for suffixes
    while (nameParts.length > 1) {
      const lastPart = nameParts[nameParts.length - 1].toLowerCase().replace(/\./g, '');
      
      if (this.SUFFIXES.includes(lastPart)) {
        suffixes.unshift(nameParts.pop()!);
      } else {
        break;
      }
    }

    return { nameParts, suffixes };
  }

  /**
   * Create NameParts object with proper formatting
   */
  private static createNameParts(
    firstName: string,
    lastName: string,
    middleName: string,
    options: Required<NameNormalizationOptions>
  ): NameParts {
    // Apply capitalization if requested
    const formatName = (name: string) => 
      options.capitalizeNames ? this.toProperCase(name) : name;

    const formattedFirstName = formatName(firstName.trim());
    const formattedLastName = formatName(lastName.trim());
    const formattedMiddleName = middleName ? formatName(middleName.trim()) : '';

    // Create full name
    const fullNameParts = [formattedFirstName, formattedMiddleName, formattedLastName]
      .filter(part => part.length > 0);
    const fullName = fullNameParts.join(' ');

    // Create display name (First Last format)
    const displayName = `${formattedFirstName} ${formattedLastName}`.trim();

    return {
      firstName: formattedFirstName,
      lastName: formattedLastName,
      middleName: formattedMiddleName || undefined,
      fullName,
      displayName,
    };
  }

  /**
   * Create empty NameParts for invalid input
   */
  private static createEmptyNameParts(): NameParts {
    return {
      firstName: '',
      lastName: '',
      fullName: '',
      displayName: '',
    };
  }

  /**
   * Convert to proper case (Title Case)
   */
  private static toProperCase(name: string): string {
    if (!name) return '';

    return name
      .toLowerCase()
      .split(/(\s+|-)/) // Split on spaces and hyphens but keep delimiters
      .map(part => {
        if (part.match(/^\s+$/)) return part; // Keep whitespace as-is
        if (part === '-') return part; // Keep hyphens as-is
        
        // Handle special cases
        if (part.match(/^(mc|mac|o'|d')/i)) {
          // Scottish/Irish names: McDonald, O'Connor, D'Angelo
          const prefix = part.substring(0, part.match(/^(mc|mac|o'|d')/i)![0].length);
          const rest = part.substring(prefix.length);
          return prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase() +
                 (rest ? rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase() : '');
        }
        
        // Standard capitalization
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
  }

  /**
   * Clean excessive whitespace
   */
  private static cleanWhitespace(name: string): string {
    return name
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\s*,\s*/g, ', ') // Normalize comma spacing
      .trim();
  }

  /**
   * Batch normalize multiple names
   */
  public static normalizeNames(
    names: Array<string | { firstName?: string; lastName?: string; name?: string }>,
    options: NameNormalizationOptions = {}
  ): NameParts[] {
    return names.map(name => this.normalizeName(name, options));
  }

  /**
   * Validate if a name appears to be properly formatted
   */
  public static isWellFormatted(name: string): boolean {
    if (!name || name.trim().length === 0) return false;
    
    const trimmed = name.trim();
    
    // Check for basic issues
    if (trimmed.includes('  ')) return false; // Multiple spaces
    if (trimmed.match(/^[a-z]/)) return false; // Starts with lowercase
    if (trimmed.match(/[A-Z]{3,}/)) return false; // Too many consecutive capitals
    
    // Should have at least first and last name
    const parts = trimmed.split(' ').filter(p => p.length > 0);
    return parts.length >= 2;
  }

  /**
   * Get name initials
   */
  public static getInitials(nameParts: NameParts): string {
    const initials: string[] = [];
    
    if (nameParts.firstName) {
      initials.push(nameParts.firstName.charAt(0).toUpperCase());
    }
    
    if (nameParts.middleName) {
      initials.push(nameParts.middleName.charAt(0).toUpperCase());
    }
    
    if (nameParts.lastName) {
      initials.push(nameParts.lastName.charAt(0).toUpperCase());
    }
    
    return initials.join('.');
  }

  /**
   * Format name for display in different contexts
   */
  public static formatForDisplay(
    nameParts: NameParts,
    format: 'first-last' | 'last-first' | 'first-middle-last' | 'initials' = 'first-last'
  ): string {
    switch (format) {
      case 'first-last':
        return nameParts.displayName;
      
      case 'last-first':
        return nameParts.lastName 
          ? `${nameParts.lastName}, ${nameParts.firstName}`
          : nameParts.firstName;
      
      case 'first-middle-last':
        return nameParts.fullName;
      
      case 'initials':
        return this.getInitials(nameParts);
      
      default:
        return nameParts.displayName;
    }
  }
} 