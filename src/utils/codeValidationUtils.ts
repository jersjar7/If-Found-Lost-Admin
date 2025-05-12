// src/utils/codeValidationUtils.ts

/**
 * Utilities for QR code validation and generation
 */

/**
 * Validates a code format
 * @param code The code to validate
 * @param expectedPrefix Optional prefix the code should have
 * @returns Whether the code is valid and any error message
 */
export function validateCodeFormat(
    code: string,
    expectedPrefix?: string
  ): { valid: boolean; message: string } {
    // Check if empty
    if (!code) {
      return { valid: false, message: 'Code cannot be empty' };
    }
  
    // Check prefix if specified
    if (expectedPrefix && !code.startsWith(expectedPrefix)) {
      return { 
        valid: false, 
        message: `Code must start with the prefix "${expectedPrefix}"` 
      };
    }
  
    // Check for valid characters
    const validCharsRegex = /^[A-Z0-9-]+$/;
    if (!validCharsRegex.test(code)) {
      return { 
        valid: false, 
        message: 'Code can only contain uppercase letters, numbers, and hyphens' 
      };
    }
  
    // If check digit is included, verify it
    if (code.includes('-')) {
      const parts = code.split('-');
      if (parts.length > 1 && parts[parts.length - 1].length === 1) {
        const codeWithoutCheckDigit = code.slice(0, -2);
        const providedCheckDigit = code.slice(-1);
        const calculatedCheckDigit = calculateCheckDigit(codeWithoutCheckDigit);
        
        if (providedCheckDigit !== calculatedCheckDigit) {
          return { valid: false, message: 'Invalid check digit' };
        }
      }
    }
  
    return { valid: true, message: 'Code is valid' };
  }
  
  /**
   * Calculate a check digit for a code
   * @param code The code without check digit
   * @returns The check digit
   */
  export function calculateCheckDigit(code: string): string {
    // Simple algorithm: sum the char codes and take modulo 10
    let sum = 0;
    for (let i = 0; i < code.length; i++) {
      sum += code.charCodeAt(i);
    }
    
    // Convert to a single alphanumeric character (0-9, A-Z)
    const checkDigit = sum % 36;
    if (checkDigit < 10) {
      return checkDigit.toString();
    } else {
      // Convert 10-35 to A-Z
      return String.fromCharCode(65 + (checkDigit - 10));
    }
  }
  
  /**
   * Generate sample codes based on batch configuration
   * @param prefix The code prefix
   * @param codeLength The length of the random part
   * @param includeCheckDigit Whether to include a check digit
   * @param count Number of samples to generate
   * @returns Array of sample codes
   */
  export function generateSampleCodes(
    prefix: string,
    codeLength: number,
    includeCheckDigit: boolean = false,
    count: number = 3
  ): string[] {
    const samples: string[] = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded I, O, 0, 1 to avoid confusion
    
    for (let i = 0; i < count; i++) {
      let randomPart = '';
      
      // Generate random part
      for (let j = 0; j < codeLength; j++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        randomPart += chars.charAt(randomIndex);
      }
      
      let code = `${prefix}${randomPart}`;
      
      // Add check digit if requested
      if (includeCheckDigit) {
        code += '-' + calculateCheckDigit(code);
      }
      
      samples.push(code);
    }
    
    return samples;
  }
  
  /**
   * Sanitize prefix to ensure it meets requirements
   * @param prefix The prefix to sanitize
   * @returns Sanitized prefix
   */
  export function sanitizePrefix(prefix: string): string {
    // Remove invalid characters
    let sanitized = prefix.replace(/[^A-Z0-9-]/g, '').toUpperCase();
    
    // Ensure it ends with a dash if not empty
    if (sanitized.length > 0 && !sanitized.endsWith('-')) {
      sanitized += '-';
    }
    
    return sanitized;
  }