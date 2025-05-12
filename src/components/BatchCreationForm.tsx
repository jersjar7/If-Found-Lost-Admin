// src/components/BatchCreationForm.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Divider,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CodeGenerationService } from '../services/CodeGenerationService';
import CodePreviewComponent from './CodePreviewComponent';
import { sanitizePrefix } from '../utils/codeValidationUtils';

// Constants
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 10;
const MIN_QUANTITY = 10;
const MAX_QUANTITY = 10000;
const DEFAULT_CODE_LENGTH = 6;
const DEFAULT_PREFIX = 'IFL-';

const BatchCreationForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prefix, setPrefix] = useState(DEFAULT_PREFIX);
  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);
  const [quantity, setQuantity] = useState(100);
  const [productType, setProductType] = useState('');
  
  // Form validation state
  const [nameError, setNameError] = useState('');
  const [prefixError, setPrefixError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  
  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Handle prefix formatting
  useEffect(() => {
    // Sanitize and format prefix as user types
    if (prefix !== sanitizePrefix(prefix)) {
      setPrefix(sanitizePrefix(prefix));
    }
  }, [prefix]);
  
  // Validate form fields
  const validateForm = (): boolean => {
    let isValid = true;
    
    // Validate name
    if (!name.trim()) {
      setNameError('Batch name is required');
      isValid = false;
    } else {
      setNameError('');
    }
    
    // Validate prefix
    if (!prefix) {
      setPrefixError('Prefix is required');
      isValid = false;
    } else if (prefix.length > 10) {
      setPrefixError('Prefix should be 10 characters or less');
      isValid = false;
    } else {
      setPrefixError('');
    }
    
    // Validate quantity
    if (quantity < MIN_QUANTITY) {
      setQuantityError(`Minimum quantity is ${MIN_QUANTITY}`);
      isValid = false;
    } else if (quantity > MAX_QUANTITY) {
      setQuantityError(`Maximum quantity is ${MAX_QUANTITY}`);
      isValid = false;
    } else {
      setQuantityError('');
    }
    
    return isValid;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Validate form fields
    if (!validateForm()) {
      return;
    }
    
    // Submit form
    setLoading(true);
    try {
      // Create batch via service
      const result = await CodeGenerationService.createBatch({
        name,
        description,
        prefix,
        codeLength,
        quantity,
        productType: productType || undefined,
        createdBy: user?.uid || '',
      });
      
      setSuccess(`Batch created successfully! Generation in progress.`);
      
      // Navigate to batch details page after a short delay
      setTimeout(() => {
        navigate(`/codes/batches/${result.batchId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create batch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Create New QR Code Batch
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Batch Information
            </Typography>
          </Grid>
          
          {/* Batch Name */}
          <Grid item xs={12} md={6}>
            <TextField
              label="Batch Name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!nameError}
              helperText={nameError}
              required
              disabled={loading}
            />
          </Grid>
          
          {/* Product Type */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="product-type-label">Product Type</InputLabel>
              <Select
                labelId="product-type-label"
                value={productType}
                label="Product Type"
                onChange={(e) => setProductType(e.target.value)}
                disabled={loading}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                <MenuItem value="tag">Tag</MenuItem>
                <MenuItem value="sticker">Sticker</MenuItem>
                <MenuItem value="card">Card</MenuItem>
                <MenuItem value="keychain">Keychain</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* Description */}
          <Grid item xs={12}>
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 1 }}>
              Code Configuration
            </Typography>
          </Grid>
          
          {/* Prefix */}
          <Grid item xs={12} md={6}>
            <TextField
              label="Code Prefix"
              fullWidth
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              error={!!prefixError}
              helperText={prefixError || "Added to the start of each code (e.g., 'IFL-')"}
              required
              disabled={loading}
            />
          </Grid>
          
          {/* Quantity */}
          <Grid item xs={12} md={6}>
            <TextField
              label="Quantity"
              type="number"
              fullWidth
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              inputProps={{ min: MIN_QUANTITY, max: MAX_QUANTITY }}
              error={!!quantityError}
              helperText={quantityError || `Number of codes to generate (${MIN_QUANTITY}-${MAX_QUANTITY})`}
              required
              disabled={loading}
            />
          </Grid>
          
          {/* Code Length */}
          <Grid item xs={12}>
            <Typography gutterBottom>
              Code Length: {codeLength} characters
            </Typography>
            <Slider
              value={codeLength}
              onChange={(_, value) => setCodeLength(value as number)}
              min={MIN_CODE_LENGTH}
              max={MAX_CODE_LENGTH}
              step={1}
              marks
              valueLabelDisplay="auto"
              disabled={loading}
            />
            <Typography variant="caption" color="text.secondary">
              Shorter codes are easier to type, longer codes are more secure.
            </Typography>
          </Grid>
          
          {/* Code Preview */}
          <Grid item xs={12}>
            <Box sx={{ mt: 2, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Sample Code Preview:
              </Typography>
              <CodePreviewComponent 
                prefix={prefix} 
                codeLength={codeLength} 
              />
            </Box>
          </Grid>
          
          {/* Warning for large batches */}
          {quantity > 500 && (
            <Grid item xs={12}>
              <Alert severity="info">
                You're generating a large batch ({quantity} codes). 
                This operation will be processed in the background and may take some time.
              </Alert>
            </Grid>
          )}
          
          {/* Submit Button */}
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Creating Batch...' : 'Generate Codes'}
            </Button>
          </Grid>
          
          {/* Summary chips */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
              <Chip label={`${prefix}... format`} />
              <Chip label={`${codeLength} characters`} />
              <Chip label={`${quantity} codes`} />
              {productType && <Chip label={`Type: ${productType}`} />}
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};

export default BatchCreationForm;