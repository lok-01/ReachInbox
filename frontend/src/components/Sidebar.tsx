import React from 'react';
import { Home, Users, Mail, Send, BarChart2, Settings, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar: React.FC = () => {
  const { user } = useAuth();

  return (
    <aside className="w-16 min-h-screen bg-[#101113] border-r border-[#232528] flex flex-col items-center justify-between py-6 z-50">
      {/* Top Logo */}
      <div className="flex items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Zap className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Navigation Icons (Matches Figma) */}
      <nav className="flex flex-col gap-6 items-center">
        <button className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200" title="Home">
          <Home className="w-5 h-5" />
        </button>
        <button className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200" title="Users">
          <Users className="w-5 h-5" />
        </button>
        <button className="p-2.5 rounded-lg bg-white/5 text-blue-400 border-l-2 border-blue-500 rounded-l-none" title="Campaigns">
          <Mail className="w-5 h-5" />
        </button>
        <button className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200" title="Sent Emails">
          <Send className="w-5 h-5" />
        </button>
        <button className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200" title="Stats">
          <BarChart2 className="w-5 h-5" />
        </button>
      </nav>

      {/* Bottom Settings + User Profile */}
      <div className="flex flex-col gap-5 items-center">
        <button className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200" title="Settings">
          <Settings className="w-5 h-5" />
        </button>

        {user && (
          <div className="w-8 h-8 rounded-full border border-[#232528] bg-[#1d1f22] flex items-center justify-center text-xs font-bold text-slate-200 shadow-inner">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.name.slice(0, 2).toUpperCase()
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
