'use client';

import { useState } from 'react';
import { User, api } from '@/lib/api';

export default function AuthView({ onAuthSuccess, onError }: { onAuthSuccess: (user: User) => void; onError: (err: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError('');

    try {
      if (isLogin) {
        const result = await api.auth.signin(email, password);
        const userData = await api.auth.me();
        onAuthSuccess(userData);
      } else {
        await api.auth.signup(email, password);
        const result = await api.auth.signin(email, password);
        const userData = await api.auth.me();
        onAuthSuccess(userData);
      }
    } catch (err: any) {
      onError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <div className="card">
        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <a href="#" onClick={() => setIsLogin(!isLogin)} style={{ color: 'var(--blue-primary)' }}>
            {isLogin ? 'Sign Up' : 'Sign In'}
          </a>
        </p>
      </div>
    </div>
  );
}
