// src/pages/LoginPage.tsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      console.error('Please enter email and password.');
      return;
    }

    try {
      await signIn(email, password, rememberMe);
      navigate('/'); // success
    } catch (err) {
      // signIn already set the `error` in context, so we don't need to do anything here
      console.error('Login failed:', err);
    }
  };

  return (
    <div>
      <h1>Login</h1>

      {/* Error / attempts‐remaining message */}
      {error && (
        <p style={{ color: 'red', marginBottom: '1rem' }}>
          {error.message}
        </p>
      )}

      <form onSubmit={handleSignIn}>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <input
            type="checkbox"
            id="rememberMe"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
          />
          <label htmlFor="rememberMe">Remember me</label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <p>
        <Link to="/forgot-password">Forgot Password?</Link>
      </p>
    </div>
  );
};

export default LoginPage;