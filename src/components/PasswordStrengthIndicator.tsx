// src/components/PasswordStrengthIndicator.tsx

import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { 
  validatePassword, 
  PasswordStrength, 
  getPasswordStrengthColor 
} from '../utils/passwordUtils';

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  // Skip validation if password is empty
  if (!password) {
    return null;
  }

  const result = validatePassword(password);
  
  // Calculate progress percentage based on strength
  let progressValue = 0;
  switch (result.strength) {
    case PasswordStrength.WEAK:
      progressValue = 25;
      break;
    case PasswordStrength.MODERATE:
      progressValue = 50;
      break;
    case PasswordStrength.STRONG:
      progressValue = 75;
      break;
    case PasswordStrength.VERY_STRONG:
      progressValue = 100;
      break;
  }

  // Get the appropriate color
  const color = getPasswordStrengthColor(result.strength);

  return (
    <Box sx={{ width: '100%', mt: 1, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">Password Strength</Typography>
        <Typography variant="body2" sx={{ color, fontWeight: 'bold', textTransform: 'capitalize' }}>
          {result.strength.replace('_', ' ')}
        </Typography>
      </Box>
      
      <LinearProgress 
        variant="determinate" 
        value={progressValue} 
        sx={{ 
          height: 8, 
          borderRadius: 4,
          backgroundColor: '#e0e0e0',
          '& .MuiLinearProgress-bar': {
            backgroundColor: color,
          }
        }} 
      />

      <Typography 
        variant="caption" 
        sx={{ 
          display: 'block', 
          mt: 0.5, 
          color: result.valid ? 'text.secondary' : 'error.main'
        }}
      >
        {result.message}
      </Typography>

      {/* Requirements checklist - only show if not all validations pass */}
      {!result.valid && (
        <Box sx={{ mt: 1 }}>
          {!result.validations.minLength && (
            <Typography variant="caption" color="error" display="block">
              • At least 8 characters
            </Typography>
          )}
          {!result.validations.hasUpperCase && (
            <Typography variant="caption" color="error" display="block">
              • At least one uppercase letter
            </Typography>
          )}
          {!result.validations.hasLowerCase && (
            <Typography variant="caption" color="error" display="block">
              • At least one lowercase letter
            </Typography>
          )}
          {!result.validations.hasNumber && (
            <Typography variant="caption" color="error" display="block">
              • At least one number
            </Typography>
          )}
          {!result.validations.hasSpecialChar && (
            <Typography variant="caption" color="error" display="block">
              • At least one special character
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PasswordStrengthIndicator;