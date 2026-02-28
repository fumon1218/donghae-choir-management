import { LayoutDashboard, Users, Music, Calendar, ClipboardCheck, LogOut, MessageSquare, BookOpen, Settings, Edit2, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BoardCategory } from '../data';
import logoUrl from '../assets/logo.jpg';
import BoardManager from './BoardManager';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  userRole?: string | null;
  userData?: any;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onLogout, userRole, userData, isOpen, onClose }: SidebarProps) {
  const [boardCategories, setBoardCategories] = useState<BoardCategory[]>([]);
  const [showBoardManager, setShowBoardManager] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [menuConfig, setMenuConfig] = useState<Record<string, { label: string; visible: boolean }>>({});

  const isAdmin = userRole === '대장' || userRole === '지휘자' || userRole?.includes('관리자');

  useEffect(() => {
    const q = query(collection(db, 'board_categories'), orderBy('order', 'asc'));
    const unsubscribeBoards = onSnapshot(q, (snapshot) => {
      const categories: BoardCategory[] = [];
      snapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() } as BoardCategory);
      });
      setBoardCategories(categories);
    });

    const unsubscribeMenu = onSnapshot(doc(db, 'settings', 'menu_config'), (docSnap) => {
      if (docSnap.exists()) {
        setMenuConfig(docSnap.data() as Record<string, { label: string; visible: boolean }>);
      } else {
        setMenuConfig({});
      }
    });

    return () => {
      unsubscribeBoards();
      unsubscribeMenu();
    }
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !userData?.uid) return;

    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        name: editName.trim()
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('프로필 수정 중 오류가 발생했습니다.');
    }
  };

  const baseNavItems = [
    { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    { id: 'members', label: '인원 관리', icon: Users },
    { id: 'attendance', label: '출석부', icon: ClipboardCheck },
    { id: 'opening-hymns', label: '시작찬송 관리', icon: BookOpen },
    { id: 'hymns', label: '월별 찬송가', icon: Music },
    { id: 'schedule', label: '연습 스케줄', icon: Calendar },
    { id: 'legacy-board', label: '자유게시판 (구버전)', icon: MessageSquare },
  ];

  // 설정 파일(menuConfig)을 바탕으로 필터 및 라벨 적용
  const configuredBaseItems = baseNavItems
    .filter(item => menuConfig[item.id]?.visible !== false) // 기본값은 표시(true)
    .map(item => ({
      ...item,
      label: menuConfig[item.id]?.label || item.label // 설정된 이름이 있으면 우선 사용
    }));

  const navItems = [
    ...configuredBaseItems.slice(0, 3), // 대시보드, 인원, 출석부 삽입
    ...boardCategories.map(board => ({    // 게시판(동적) 삽입
      id: `board_${board.id}`,
      label: board.name,
      icon: MessageSquare
    })),
    ...configuredBaseItems.slice(3), // 나머지 (찬송, 스케줄 등) 삽입
  ].filter(item => {
    // 모든 권한을 가진 슈퍼 관리자
    if (userRole === '지휘자' || userRole === '대장') return true;

    // 시작찬송 관리자: 월별 찬송가만 접근 가능 (+ 대시보드 등의 기본 메뉴는 허용할지 결정 필요, 여기선 요청대로 제한)
    if (userRole === '시작찬송 관리자') {
      return ['dashboard', 'hymns'].includes(item.id);
    }

    // 자유게시판 관리자: 자유게시판(board_default)만 접근 가능
    if (userRole === '자유게시판 관리자') {
      return ['dashboard', 'board_default'].includes(item.id);
    }

    // 게시판 관리자 (전체): 모든 게시판(board_...) 접근 가능
    if (userRole === '게시판 관리자') {
      return item.id.startsWith('board_') || item.id === 'dashboard';
    }

    // 일반 대원 및 기타 역할: 관리 기능(인원관리, 시작찬송관리 등) 제외한 기본 메뉴만 노출
    const adminOnlyTabs = ['members', 'opening-hymns'];
    return !adminOnlyTabs.includes(item.id);
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed inset-y-0 left-0 z-50
          transition-transform duration-300 ease-in-out md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-16 md:h-20 flex items-center justify-between px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Dong-Hae Church Choir Logo"
              className="w-8 h-8 md:w-10 md:h-10 object-contain"
              onError={(e) => {
                e.currentTarget.src = 'https://picsum.photos/seed/choir/100/100';
              }}
            />
            <span className="text-base md:text-lg font-bold text-gray-900 leading-tight tracking-tight">
              동해교회<br />찬양대
            </span>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`
                w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                ${isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
              `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
              </button>
            );
          })}

          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={() => setShowBoardManager(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all duration-200"
              >
                <Settings className="w-5 h-5 text-gray-400" />
                게시판 관리
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold overflow-hidden">
              {userData?.imageUrl ? (
                <img src={userData.imageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (userData?.name || '익').charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userData?.name || '익명'}</p>
                <p className="text-xs text-gray-500 truncate">{userRole || '일반 대원'}</p>
              </div>
              {userData?.uid && (
                <button
                  onClick={() => {
                    setEditName(userData.name || '');
                    setIsEditingProfile(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex-shrink-0"
                  title="프로필 이름 수정"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>

        {showBoardManager && <BoardManager onClose={() => setShowBoardManager(false)} />}

        {/* Profile Edit Modal */}
        {isEditingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900">내 프로필 수정</h2>
                <button onClick={() => setIsEditingProfile(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleProfileUpdate} className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    표시할 이름
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="예: 지휘자, 박선생 등"
                    maxLength={20}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                  >
                    저장하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
