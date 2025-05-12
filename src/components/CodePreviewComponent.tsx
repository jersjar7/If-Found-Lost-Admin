// src/components/CodePreviewComponent.tsx

import React, { useMemo } from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { generateSampleCodes } from '../utils/codeValidationUtils';

interface CodePreviewComponentProps {
  prefix: string;
  codeLength: number;
  includeCheckDigit?: boolean;
  count?: number;
}

const CodePreviewComponent: React.FC<CodePreviewComponentProps> = ({
  prefix,
  codeLength,
  includeCheckDigit = false,
  count = 3
}) => {
  // Generate sample codes whenever props change
  const sampleCodes = useMemo(() => {
    return generateSampleCodes(prefix, codeLength, includeCheckDigit, count);
  }, [prefix, codeLength, includeCheckDigit, count]);

  // Make the prefix visually distinct from the random part
  const formatCode = (code: string) => {
    if (!prefix || !code.startsWith(prefix)) {
      return code;
    }
    
    const prefixPart = code.substring(0, prefix.length);
    const randomPart = code.substring(prefix.length);
    
    return (
      <>
        <span style={{ fontWeight: 'bold' }}>{prefixPart}</span>
        <span>{randomPart}</span>
      </>
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f9f9f9' }}>
      <Typography variant="subtitle2" gutterBottom>
        Sample Codes:
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sampleCodes.map((code, index) => (
          <Box 
            key={index} 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              p: 1, 
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: 1
            }}
          >
            <Typography 
              variant="body1" 
              fontFamily="monospace" 
              sx={{ flexGrow: 1, letterSpacing: '0.1em' }}
            >
              {formatCode(code)}
            </Typography>
            
            <Chip
              label={`${code.length} chars`}
              size="small"
              variant="outlined"
            />
          </Box>
        ))}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        These are just examples. Actual generated codes will be unique and randomly generated.
      </Typography>
    </Paper>
  );
};

export default CodePreviewComponent;