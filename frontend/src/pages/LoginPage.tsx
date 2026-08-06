import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { Zap, Mail, Clock, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: <Zap className="w-5 h-5 text-blue-400" />, title: 'Intelligent Scheduling', desc: 'BullMQ + Redis persistent queues survive restarts.' },
  { icon: <Mail className="w-5 h-5 text-violet-400" />, title: 'Multi-Sender Support', desc: 'Rotate across multiple SMTP accounts seamlessly.' },
  { icon: <Clock className="w-5 h-5 text-emerald-400" />, title: 'Rate Limiting', desc: 'Per-sender hourly limits enforced with Redis counters.' },
  { icon: <Shield className="w-5 h-5 text-amber-400" />, title: 'Idempotent Jobs', desc: 'Zero duplicate sends, even across worker restarts.' },
];

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col lg:flex-row">
      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl animate-glow" style={{ animationDelay: '3s' }} />
      </div>

      {/* Left panel – branding & features */}
      <div className="relative flex-1 flex flex-col justify-center p-12 lg:max-w-xl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            ReachInbox
          </span>
        </div>

        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-100 leading-tight mb-4">
            Email Outreach
            <span className="block bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              at Scale
            </span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Production-grade email scheduling powered by BullMQ, Redis, and Ethereal SMTP.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors duration-200"
            >
              <div className="shrink-0 mt-0.5">{f.icon}</div>
              <div>
                <p className="text-sm font-medium text-slate-200">{f.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – login card */}
      <div className="relative flex items-center justify-center p-8 lg:w-[420px]">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-slate-100 mb-2">Welcome back</h2>
              <p className="text-slate-500 text-sm">Sign in to access your dashboard</p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-slate-400 text-sm">Signing you in...</p>
              </div>
            ) : (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleSuccess}
                  onError={handleError}
                  theme="filled_black"
                  shape="rectangular"
                  size="large"
                  text="signin_with"
                  width="280"
                />
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/8 text-center">
              <p className="text-xs text-slate-600">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>

          {/* Bottom note */}
          <p className="text-center text-xs text-slate-700 mt-4">
            ReachInbox · Outbox Labs · Full-stack Hiring Assignment
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
