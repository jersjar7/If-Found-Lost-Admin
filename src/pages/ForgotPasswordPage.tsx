// src/pages/ForgotPasswordPage.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const { forgotPassword, authLoading } = useAuth();
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setResetError(null);
      try {
        await forgotPassword(email);
        setResetEmailSent(true);
      } catch (err: any) {
        setResetError(err.message);
        setResetEmailSent(false);
      }
    } else {
      setResetError('Please enter your email address.');
      setResetEmailSent(false);
    }
  };

  return (
    <div>
      <h1>Forgot Password</h1>
      {resetEmailSent ? (
        <p style={{ color: 'green' }}>Password reset email sent to: {email}. Please check your inbox (and spam folder).</p>
      ) : (
        <form onSubmit={handleForgotPassword}>
          {resetError && <p style={{ color: 'red' }}>{resetError}</p>}
          <div>
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={authLoading}>
            {authLoading ? 'Sending...' : 'Reset Password'}
          </button>
        </form>
      )}
      <p>
        <button onClick={() => navigate('/login')}>Back to Login</button>
      </p>
    </div>
  );
};

export default ForgotPasswordPage;