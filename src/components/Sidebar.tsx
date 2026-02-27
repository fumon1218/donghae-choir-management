import { LayoutDashboard, Users, Music, Calendar, ClipboardCheck, LogOut, MessageSquare, BookOpen, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BoardCategory } from '../data';
import logoUrl from '../assets/logo.jpg';
import BoardManager from './BoardManager';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  userRole?: string | null;
}

export default function Sidebar({ activeTab, setActiveTab, onLogout, userRole }: SidebarProps) {
  const [boardCategories, setBoardCategories] = useState<BoardCategory[]>([]);
  const [showBoardManager, setShowBoardManager] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'board_categories'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const categories: BoardCategory[] = [];
      snapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() } as BoardCategory);
      });
      setBoardCategories(categories);
    });

    return () => unsubscribe();
  }, []);

  const navItems = [
    { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    { id: 'members', label: '인원 관리', icon: Users },
    { id: 'attendance', label: '출석부', icon: ClipboardCheck },
    ...boardCategories.map(board => ({
      id: `board_${board.id}`,
      label: board.name,
      icon: MessageSquare
    })),
    { id: 'opening-hymns', label: '시작찬송 관리', icon: BookOpen },
    { id: 'hymns', label: '월별 찬송가', icon: Music },
    { id: 'schedule', label: '연습 스케줄', icon: Calendar },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed inset-y-0 left-0 z-10">
      <div className="h-20 flex items-center px-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Dong-Hae Church Choir Logo"
            className="w-10 h-10 object-contain"
            onError={(e) => {
              // Fallback if image not found
              e.currentTarget.src = 'https://picsum.photos/seed/choir/100/100';
            }}
          />
          <span className="text-lg font-bold text-gray-900 leading-tight tracking-tight">
            동해교회<br />찬양대
          </span>
        </div>
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

        {(userRole === 'admin' || userRole === 'conductor') && (
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
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
            지
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">지휘자</p>
            <p className="text-xs text-gray-500 truncate">관리자 계정</p>
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
    </aside>
  );
}
