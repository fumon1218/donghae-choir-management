/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isInviteMode, setIsInviteMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('invite') === 'true') {
      setIsInviteMode(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserRole(userSnap.data().role);
          } else {
            setUserRole('대기권한');
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole('대기권한');
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    // Firebase auth state listener handles the actual state update
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 1. 모든 접속자는 로그인이 필수
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // 2. 로그인 상태에서 초대 링크 파라미터가 있다면 가입 화면 표시
  if (isInviteMode) {
    return <Join user={user} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'members':
        return <Members userRole={userRole} />;
      case 'attendance':
        return <Attendance />;
      case 'board':
        return <Board />;
      case 'opening-hymns':
        return <OpeningHymns />;
      case 'hymns':
        return <Hymns userRole={userRole} />;
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
