import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      setError('No credential received from Google.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(response.credential);
    } catch {
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    setError('Google sign-in was cancelled or failed. Please try again.');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('Manual credentials are disabled. Please sign in with Google!');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[420px] bg-white border border-slate-100 rounded-xl p-8 shadow-sm">
        
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">
          Login
        </h1>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-slate-500 text-sm">Signing you in...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Google Sign In Container (styled to match figma overlay) */}
            <div className="flex justify-center w-full">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                theme="outline"
                shape="pill"
                size="large"
                width="340"
              />
            </div>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-xs text-slate-400 font-medium">
                or sign up through email
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Manual Form (Matches Figma input design) */}
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <input
                  type="email"
                  placeholder="Email ID"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 text-sm focus:outline-none focus:border-slate-300 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1">
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 text-sm focus:outline-none focus:border-slate-300 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-lg bg-[#4CAF50] hover:bg-[#43A047] active:bg-[#388E3C] text-white text-sm font-semibold transition-all duration-150 shadow-sm"
              >
                Login
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
