import React from 'react';
import { LogOut, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onCompose: () => void;
}

const Header: React.FC<HeaderProps> = ({ onCompose }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#0b0f19]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            ReachInbox
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onCompose}
            id="compose-email-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium hover:from-blue-500 hover:to-violet-500 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-105 active:scale-95"
          >
            <span className="text-base leading-none">+</span>
            Compose Email
          </button>

          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full ring-2 ring-blue-500/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-200 leading-none">{user.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                id="logout-btn"
                title="Logout"
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
