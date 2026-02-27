/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { LogOut, Clock } from 'lucide-react';
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
  const [userData, setUserData] = useState<any>(null);

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

          let role = '대기권한';
          let data = null;

          // 기존 Firestore에 권한이 있다면 해당 권한 사용
          if (userSnap.exists()) {
            data = { uid: currentUser.uid, ...userSnap.data() };
            if (data?.role) {
              role = data.role;
            }
          } else {
            // Firestore 문서가 아직 없는 경우에도 기본 데이터 설정 (uid 필수!)
            data = {
              uid: currentUser.uid,
              name: currentUser.displayName || '이름 없음',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || ''
            };
          }

          // 자동 최고 관리자(지휘자) 승급 로직: 이름 또는 이메일 기반
          const isAutoAdmin =
            currentUser.email === 'fumon1218@gmail.com' ||
            currentUser.displayName?.includes('박선생') ||
            currentUser.displayName?.includes('지휘자');

          if (isAutoAdmin && role === '대기권한') {
            role = '지휘자';
            if (data) data.role = '지휘자';
          }

          setUserRole(role);
          setUserData(data);

        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole('대기권한');
        } finally {
          setLoading(false);
        }
      } else {
        setUserRole(null);
        setUserData(null);
        setLoading(false);
      }
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

  // 3. 미승인 회원(대기권한) 처리 로직
  if (userRole === '대기권한') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-6">
              <Clock className="w-12 h-12" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">승인 대기 중</h2>
          <p className="mt-4 text-gray-600">
            {user.displayName || user.email}님, 환영합니다!<br />
            현재 <b>지휘자님의 가입 승인</b>을 기다리고 있습니다.<br />
            승인이 완료되면 앱을 이용하실 수 있습니다.
          </p>
          <div className="mt-8">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'members':
        return <Members userRole={userRole} userData={userData} />;
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
