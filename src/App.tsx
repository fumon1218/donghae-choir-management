/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, collection, query, where, getDocs, setDoc, onSnapshot } from 'firebase/firestore';
import { Clock, Menu, LogOut, Home } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Hymns from './components/Hymns';
import Schedule from './components/Schedule';
import BoardManager from './components/BoardManager';
import Board from './components/Board';
import LegacyBoard from './components/LegacyBoard';
import Login from './components/Login';
import Join from './components/Join';
import OpeningHymns from './components/OpeningHymns';
import MemberStatus from './components/MemberStatus';
import HymnPractice, { type PracticeTarget } from './components/HymnPractice';
import { APP_VERSION } from './version';
import { Divider } from './components/Decor';
import EmbedPage from './components/EmbedPage';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [practiceTarget, setPracticeTarget] = useState<PracticeTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showBoardManager, setShowBoardManager] = useState(false);

  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    // 네트워크가 아주 느린 경우에만 안내 메시지를 띄웁니다.
    const slowTimer = setTimeout(() => {
      setIsSlowConnection(true);
    }, 5000);

    let unsubscribeUser: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // 유저 정보 및 권한 실시간 동기화
        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeUser = onSnapshot(userRef, async (userSnap) => {
          let role = '대기권한';
          let data = null;

          if (userSnap.exists()) {
            data = { uid: currentUser.uid, ...userSnap.data() };
            if (!data.name) data.name = currentUser.displayName || '';
            if (!data.imageUrl) data.imageUrl = currentUser.photoURL || '';
            if (data?.role) role = data.role;
          } else {
            data = {
              uid: currentUser.uid,
              name: currentUser.displayName || '',
              email: currentUser.email || '',
              imageUrl: currentUser.photoURL || ''
            };
          }

          // 자동 지휘자 승급 로직
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
          setLoading(false);
          clearTimeout(slowTimer);
        }, (error) => {
          console.error("Error listening to user doc:", error);
          setLoading(false);
          clearTimeout(slowTimer);
          setUserRole('대기권한');
        });
      } else {
        setUserRole(null);
        setUserData(null);
        setHasPendingRequest(false);
        setLoading(false);
        clearTimeout(slowTimer);
      }
    });

    return () => {
      clearTimeout(slowTimer);
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // One-time Migration Helper: LocalStorage -> Firestore
  useEffect(() => {
    if (!user || userRole !== '지휘자') return;

    const migrateData = async () => {
      const isMigrated = localStorage.getItem('choir_data_migrated_v1');
      if (isMigrated === 'true') return;

      try {
        const savedHymns = localStorage.getItem('choir_hymns');
        if (savedHymns) {
          const hymnsList = JSON.parse(savedHymns);
          if (Array.isArray(hymnsList) && hymnsList.length > 0) {
            await setDoc(doc(db, 'settings', 'hymns_data'), { list: hymnsList }, { merge: true });
          }
        }

        const savedSchedules = localStorage.getItem('choir_schedules');
        if (savedSchedules) {
          const scheduleList = JSON.parse(savedSchedules);
          if (Array.isArray(scheduleList) && scheduleList.length > 0) {
            await setDoc(doc(db, 'settings', 'schedules'), { list: scheduleList }, { merge: true });
          }
        }

        const savedOpeningHymns = localStorage.getItem('choir_opening_hymns');
        if (savedOpeningHymns) {
          const openingList = JSON.parse(savedOpeningHymns);
          if (Array.isArray(openingList) && openingList.length > 0) {
            await setDoc(doc(db, 'settings', 'opening_hymns'), { list: openingList }, { merge: true });
          }
        }

        localStorage.setItem('choir_data_migrated_v1', 'true');
      } catch (error) {
        console.error('Migration failed:', error);
      }
    };

    migrateData();
  }, [user, userRole]);

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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        {isSlowConnection && (
          <div className="animate-in fade-in duration-500">
            <p className="text-sm font-bold text-gray-500">서버와 연결을 확인 중입니다...</p>
            <p className="text-xs text-gray-400 mt-1">잠시만 기다려 주세요.</p>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={() => { }} />;
  }

  if (userRole === '대기권한') {
    if (!hasPendingRequest) {
      return <Join user={user} onJoinSuccess={() => setHasPendingRequest(true)} />;
    }
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
      case 'dashboard': return <Dashboard userRole={userRole} userData={userData} onNavigate={setActiveTab} onOpenPractice={(book, n) => { setPracticeTarget({ book, n }); setActiveTab('mp3-player'); }} />;
      case 'member-status': return <MemberStatus userData={userData} userRole={userRole} />;
      case 'members': return <Members userRole={userRole} userData={userData} />;
      case 'opening-hymns': return <OpeningHymns userRole={userRole} />;
      case 'hymns': return <Hymns userRole={userRole} onOpenPractice={(book, n) => { setPracticeTarget({ book, n }); setActiveTab('mp3-player'); }} />;
      case 'schedule': return <Schedule userRole={userRole} />;
      case 'mp3-player': return <HymnPractice userRole={userRole} target={practiceTarget} onExit={() => { setPracticeTarget(null); setActiveTab('dashboard'); }} />;
      case 'bible-memory': return <EmbedPage title="암송수첩" url="https://fumon1218.github.io/bible-memory-app/" />;
      case 'legacy-board': return <LegacyBoard userData={userData} />;
      default:
        if (activeTab.startsWith('board_')) {
          const boardId = activeTab.replace('board_', '');
          return <Board boardId={boardId} userRole={userRole} userData={userData} />;
        }
        return <Dashboard userRole={userRole} userData={userData} onNavigate={setActiveTab} onOpenPractice={(book, n) => { setPracticeTarget({ book, n }); setActiveTab('mp3-player'); }} />;
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
        <div className="md:hidden sticky top-0 z-20 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              aria-label="홈으로"
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Home className="w-6 h-6" />
            </button>
            <button onClick={() => setActiveTab('dashboard')} className="text-lg font-bold text-gray-900 tracking-tight">
              동해교회
              <span className="text-blue-600 ml-1">찬양대</span>
            </button>
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
            {activeTab !== 'dashboard' && activeTab !== 'bible-memory' && <Divider className="mt-10 max-w-md mx-auto" />}
          </div>
        </main>

        {activeTab !== 'mp3-player' && (
        <div className="fixed bottom-4 right-4 text-[10px] md:text-xs font-bold text-blue-600 bg-white shadow-md border border-blue-100 px-2 py-1 rounded-md pointer-events-none z-[100]">
          {APP_VERSION}
        </div>
        )}
      </div>

      {showBoardManager && (
        <BoardManager onClose={() => setShowBoardManager(false)} />
      )}
    </div>
  );
}
