/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { LogOut, Clock } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Hymns from './components/Hymns';
import Schedule from './components/Schedule';
import Attendance from './components/Attendance';
import BoardManager from './components/BoardManager';
import Board from './components/Board';
import LegacyBoard from './components/LegacyBoard';
import Login from './components/Login';
import Join from './components/Join';
import OpeningHymns from './components/OpeningHymns';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // 4초 동안 로딩 상태가 풀리지 않으면 강제 해제합니다. (빠른 화면 진입 보장)
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          // Firestore 응답 지연 시 2초 이상 대기하지 않고 즉각 화면을 로드하도록 단축
          const userSnap: any = await Promise.race([
            getDoc(userRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2000))
          ]);

          let role = '대기권한';
          let data = null;

          // 기존 Firestore에 권한이 있다면 해당 권한 사용
          if (userSnap.exists()) {
            data = { uid: currentUser.uid, ...userSnap.data() };
            // 만약 DB에 이름이나 사진이 누락된 경우 구글 계정 정보를 폴백으로 사용
            if (!data.name) data.name = currentUser.displayName || '';
            if (!data.imageUrl) data.imageUrl = currentUser.photoURL || '';

            if (data?.role) {
              role = data.role;
            }
          } else {
            // Firestore 문서가 아직 없는 경우에도 기본 데이터 설정 (uid 필수!)
            data = {
              uid: currentUser.uid,
              name: currentUser.displayName || '',
              email: currentUser.email || '',
              imageUrl: currentUser.photoURL || ''
            };
          }

          // 자동 최고 관리자(지휘자) 승급 로직: 이름 또는 이메일 기반
          const isAutoAdmin =
            currentUser.email === 'fumon1218@gmail.com' ||
            currentUser.displayName?.includes('박선생') ||
            currentUser.displayName?.includes('지휘자');

          let currentRole = role;
          if (isAutoAdmin && role === '대기권한') {
            currentRole = '지휘자';
            if (data) data.role = '지휘자';
          }

          let pendingReq = false;
          // check if they have a pending request if neither auto admin nor existing active local role
          if (currentRole === '대기권한') {
            try {
              const q = query(collection(db, 'join_requests'), where('uid', '==', currentUser.uid), where('status', '==', 'pending'));
              const reqSnap = await getDocs(q);
              pendingReq = !reqSnap.empty;
            } catch (e) {
              console.error('Error checking join requests', e);
            }
          }

          setHasPendingRequest(pendingReq);
          setUserRole(currentRole);
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
        setHasPendingRequest(false);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
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

  // 2. 미승인 회원(대기권한) 처리 로직
  if (userRole === '대기권한') {
    // 신청 내역이 없다면 (루트로 들어왔든 접속했든) 반드시 가입 폼 표시
    if (!hasPendingRequest) {
      return <Join user={user} onJoinSuccess={() => setHasPendingRequest(true)} />;
    }

    // 신청 내역이 있으면 승인 대기 화면
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
      case 'opening-hymns':
        return <OpeningHymns />;
      case 'hymns':
        return <Hymns userRole={userRole} />;
      case 'schedule':
        return <Schedule />;
      case 'legacy-board':
        return <LegacyBoard userData={userData} />;
      default:
        if (activeTab.startsWith('board_')) {
          const boardId = activeTab.replace('board_', '');
          return <Board boardId={boardId} userRole={userRole} userData={userData} />;
        }
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans relative">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} userRole={userRole} userData={userData} />

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
