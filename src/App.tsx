/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, googleProvider, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { LogOut, Clock, Menu } from 'lucide-react';
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
import { APP_VERSION } from './version';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showBoardManager, setShowBoardManager] = useState(false);

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

  // One-time Migration Helper: LocalStorage -> Firestore
  useEffect(() => {
    if (!user || userRole !== '지휘자') return;

    const migrateData = async () => {
      const isMigrated = localStorage.getItem('choir_data_migrated_v1');
      if (isMigrated === 'true') return;

      console.log('Starting data migration to Firestore...');

      try {
        // 1. Migrate Hymns
        const savedHymns = localStorage.getItem('choir_hymns');
        if (savedHymns) {
          const hymnsList = JSON.parse(savedHymns);
          if (Array.isArray(hymnsList) && hymnsList.length > 0) {
            await setDoc(doc(db, 'settings', 'hymns_data'), { list: hymnsList }, { merge: true });
            console.log('Hymns migrated.');
          }
        }

        // 2. Migrate Schedules
        const savedSchedules = localStorage.getItem('choir_schedules');
        if (savedSchedules) {
          const scheduleList = JSON.parse(savedSchedules);
          if (Array.isArray(scheduleList) && scheduleList.length > 0) {
            await setDoc(doc(db, 'settings', 'schedules'), { list: scheduleList }, { merge: true });
            console.log('Schedules migrated.');
          }
        }

        // 3. Migrate Opening Hymns
        const savedOpeningHymns = localStorage.getItem('choir_opening_hymns');
        if (savedOpeningHymns) {
          const openingList = JSON.parse(savedOpeningHymns);
          if (Array.isArray(openingList) && openingList.length > 0) {
            await setDoc(doc(db, 'settings', 'opening_hymns'), { list: openingList }, { merge: true });
            console.log('Opening hymns migrated.');
          }
        }

        localStorage.setItem('choir_data_migrated_v1', 'true');
        console.log('Migration completed successfully.');
      } catch (error) {
        console.error('Migration failed:', error);
      }
    };

    migrateData();
  }, [user, userRole]);

  const handleLogin = () => {
    // Firebase auth state listener handles the actual state update
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('dashboard');
      setIsMobileMenuOpen(false);
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
        return <Attendance userData={userData} userRole={userRole} />;
      case 'opening-hymns':
        return <OpeningHymns userRole={userRole} />;
      case 'hymns':
        return <Hymns userRole={userRole} />;
      case 'schedule':
        return <Schedule userRole={userData?.role || null} />;
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
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        onLogout={handleLogout}
        userRole={userRole}
        userData={userData}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenBoardManager={() => setShowBoardManager(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-64 relative min-h-screen">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-20 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900 tracking-tight">
              동해교회
              <span className="text-blue-600 ml-1">찬양대</span>
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -mr-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto pb-16 md:pb-0">
            {renderContent()}
          </div>
        </main>

        {/* Version Information */}
        <div className="fixed bottom-4 right-4 text-[10px] md:text-xs font-bold text-blue-600 bg-white shadow-md border border-blue-100 px-2 py-1 rounded-md pointer-events-none z-[100]">
          {APP_VERSION}
        </div>
      </div>

      {showBoardManager && (
        <BoardManager onClose={() => setShowBoardManager(false)} />
      )}
    </div>
  );
}
