/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Hymns from './components/Hymns';
import Schedule from './components/Schedule';
import Attendance from './components/Attendance';
import Login from './components/Login';
import Join from './components/Join';
import Board from './components/Board';
import OpeningHymns from './components/OpeningHymns';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('choir_isLoggedIn') === 'true';
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isInviteMode, setIsInviteMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('invite') === 'true') {
      setIsInviteMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('choir_isLoggedIn', isLoggedIn.toString());
  }, [isLoggedIn]);

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab('dashboard');
  };

  if (isInviteMode) {
    return <Join />;
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'members':
        return <Members />;
      case 'attendance':
        return <Attendance />;
      case 'board':
        return <Board />;
      case 'opening-hymns':
        return <OpeningHymns />;
      case 'hymns':
        return <Hymns />;
      case 'schedule':
        return <Schedule />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans relative">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {/* Version Information */}
      <div className="fixed bottom-4 right-4 text-xs font-medium text-gray-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-gray-100 pointer-events-none z-50">
        v1.0.0
      </div>
    </div>
  );
}
