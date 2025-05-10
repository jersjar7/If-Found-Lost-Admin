// src/utils/passwordUtils.ts

/**
 * Password strength levels
 */
export const PasswordStrength = {
    WEAK: 'weak',
    MODERATE: 'moderate',
    STRONG: 'strong',
    VERY_STRONG: 'very_strong'
  } as const;
  
  export type PasswordStrength = typeof PasswordStrength[keyof typeof PasswordStrength];
  
  /**
   * Password validation result type
   */
  export interface PasswordValidationResult {
    valid: boolean;
    strength: PasswordStrength;
    message: string;
    validations: {
      minLength: boolean;
      hasUpperCase: boolean;
      hasLowerCase: boolean;
      hasNumber: boolean;
      hasSpecialChar: boolean;
    };
  }
  
  /**
   * Configuration options for password validation
   */
  export interface PasswordValidationOptions {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  }
  
  /**
   * Default password requirements
   */
  export const DEFAULT_PASSWORD_OPTIONS: PasswordValidationOptions = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  };
  
  /**
   * Validates a password against the specified requirements
   * 
   * @param password - The password to validate
   * @param options - Validation options
   * @returns A detailed validation result
   */
  export function validatePassword(
    password: string,
    options: PasswordValidationOptions = DEFAULT_PASSWORD_OPTIONS
  ): PasswordValidationResult {
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireNumbers = true,
      requireSpecialChars = true,
    } = options;
  
    // Check various criteria
    const validations = {
      minLength: password.length >= minLength,
      hasUpperCase: !requireUppercase || /[A-Z]/.test(password),
      hasLowerCase: !requireLowercase || /[a-z]/.test(password),
      hasNumber: !requireNumbers || /\d/.test(password),
      hasSpecialChar: !requireSpecialChars || /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    };
  
    // Calculate how many validations passed
    const passedValidations = Object.values(validations).filter(Boolean).length;
    const totalValidations = Object.values(validations).length;
    
    // Determine password strength
    let strength: PasswordStrength;
    if (passedValidations <= totalValidations * 0.6) {
      strength = PasswordStrength.WEAK;
    } else if (passedValidations <= totalValidations * 0.8) {
      strength = PasswordStrength.MODERATE;
    } else if (passedValidations < totalValidations) {
      strength = PasswordStrength.STRONG;
    } else {
      strength = PasswordStrength.VERY_STRONG;
    }
  
    // Build response message
    let message = '';
    const requirements: string[] = [];
    
    if (!validations.minLength) {
      requirements.push(`at least ${minLength} characters`);
    }
    if (!validations.hasUpperCase && requireUppercase) {
      requirements.push('an uppercase letter');
    }
    if (!validations.hasLowerCase && requireLowercase) {
      requirements.push('a lowercase letter');
    }
    if (!validations.hasNumber && requireNumbers) {
      requirements.push('a number');
    }
    if (!validations.hasSpecialChar && requireSpecialChars) {
      requirements.push('a special character');
    }
  
    if (requirements.length > 0) {
      message = `Password must include ${requirements.join(', ')}`;
    } else {
      switch (strength) {
        case PasswordStrength.MODERATE:
          message = 'Password is acceptable but could be stronger';
          break;
        case PasswordStrength.STRONG:
          message = 'Password is strong';
          break;
        case PasswordStrength.VERY_STRONG:
          message = 'Password is very strong';
          break;
        default:
          message = 'Password is too weak';
      }
    }
  
    // Determine overall validity
    const valid = requirements.length === 0;
  
    return {
      valid,
      strength,
      message,
      validations,
    };
  }
  
  /**
   * Get color associated with password strength level
   */
  export function getPasswordStrengthColor(strength: PasswordStrength): string {
    switch (strength) {
      case PasswordStrength.WEAK:
        return '#f44336'; // Red
      case PasswordStrength.MODERATE:
        return '#ff9800'; // Orange
      case PasswordStrength.STRONG:
        return '#4caf50'; // Green
      case PasswordStrength.VERY_STRONG:
        return '#2e7d32'; // Dark Green
      default:
        return '#9e9e9e'; // Grey
    }
  }