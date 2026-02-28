import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Music, Edit2, Save, X, Plus, Trash2, CalendarDays, Smartphone, Monitor, Loader2 } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface OpeningHymn {
  id: string;
  month: number;
  date: string;
  type: 'Sunday' | 'Wednesday';
  leader: string;
  title: string;
}

interface OpeningHymnsProps {
  userRole?: string | null;
}

export default function OpeningHymns({ userRole }: OpeningHymnsProps) {
  const isAdmin = userRole === '대장' || userRole === '지휘자' || userRole === '시작찬송 관리자';
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [allOpeningHymns, setAllOpeningHymns] = useState<OpeningHymn[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editList, setEditList] = useState<OpeningHymn[]>([]);
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);

  const [isLoading, setIsLoading] = useState(true);

  // Load opening hymns from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'opening_hymns'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.list) {
          setAllOpeningHymns(data.list);
        }
      } else {
        // Safe empty state, don't fallback to hardcoded data if we want to stay clean
        setAllOpeningHymns([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const currentMonthHymns = allOpeningHymns.filter(h => h.month === currentMonth);

  const handlePrevMonth = () => {
    if (isEditing) return;
    setCurrentMonth(prev => prev === 1 ? 12 : prev - 1);
  };

  const handleNextMonth = () => {
    if (isEditing) return;
    setCurrentMonth(prev => prev === 12 ? 1 : prev + 1);
  };

  const handleStartEdit = () => {
    setEditList([...currentMonthHymns]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    setIsLoading(true);
    try {
      const updatedHymns = [...allOpeningHymns.filter(h => h.month !== currentMonth), ...editList].sort((a, b) => {
        if (a.month !== b.month) return a.month - b.month;
        return a.date.localeCompare(b.date);
      });

      await setDoc(doc(db, 'settings', 'opening_hymns'), {
        list: updatedHymns
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save opening hymns:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateHymn = (index: number, field: keyof OpeningHymn, value: any) => {
    const newList = [...editList];
    newList[index] = { ...newList[index], [field]: value };
    setEditList(newList);
  };

  const handleAddHymn = (type: 'Sunday' | 'Wednesday') => {
    const newHymn: OpeningHymn = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      month: currentMonth,
      date: '',
      type,
      leader: '',
      title: ''
    };
    setEditList([...editList, newHymn]);
  };

  const handleDeleteHymn = (id: string) => {
    setEditList(editList.filter(h => h.id !== id));
  };

  const renderHymnList = (type: 'Sunday' | 'Wednesday') => {
    const list = (isEditing ? editList : currentMonthHymns).filter(h => h.type === type);
    const title = type === 'Sunday' ? '주일 시작찬송' : '수요일 시작찬송';
    const accentColor = type === 'Sunday' ? 'blue' : 'emerald';

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`p-4 border-b border-gray-100 bg-${accentColor}-50/50 flex justify-between items-center`}>
          <h2 className="text-md font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className={`w-4 h-4 text-${accentColor}-600`} />
            {title}
          </h2>
          {isEditing && (
            <button
              onClick={() => handleAddHymn(type)}
              className={`flex items-center gap-1 px-2 py-1 bg-${accentColor}-100 text-${accentColor}-700 rounded-lg text-xs font-bold hover:bg-${accentColor}-200 transition-colors`}
            >
              <Plus className="w-3 h-3" />
              추가
            </button>
          )}
        </div>
        {!isEditing && !isMobileView && list.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`bg-${accentColor}-50/30 border-b border-gray-100`}>
                  <th className="p-3 text-xs font-semibold text-gray-500 w-24">날짜</th>
                  <th className="p-3 text-xs font-semibold text-gray-500 w-24">인도자</th>
                  <th className="p-3 text-xs font-semibold text-gray-500">제목</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((hymn) => (
                  <tr key={hymn.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-1 rounded bg-${accentColor}-50 text-${accentColor}-700 font-bold text-xs border border-${accentColor}-100`}>
                        {hymn.date ? hymn.date.split('-').slice(1).join('.') : '-'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {hymn.leader}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm font-bold text-gray-900">{hymn.title}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.length > 0 ? (
              list.map((hymn, idx) => (
                <div key={hymn.id} className="p-4 hover:bg-gray-50 transition-colors">
                  {isEditing ? (
                    <div className="flex flex-col sm:flex-row items-end gap-3">
                      <div className="w-32 flex-shrink-0">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">날짜</label>
                        <input
                          type="date"
                          value={hymn.date}
                          onChange={(e) => handleUpdateHymn(editList.indexOf(hymn), 'date', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="w-24 flex-shrink-0">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">인도자</label>
                        <input
                          type="text"
                          value={hymn.leader}
                          onChange={(e) => handleUpdateHymn(editList.indexOf(hymn), 'leader', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="이름 입력"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">찬송가 제목</label>
                        <input
                          type="text"
                          value={hymn.title}
                          onChange={(e) => handleUpdateHymn(editList.indexOf(hymn), 'title', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="제목 입력"
                        />
                      </div>
                      <button
                        onClick={() => handleDeleteHymn(hymn.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className={`w-20 h-10 rounded-xl bg-${accentColor}-50 flex items-center justify-center text-${accentColor}-600 font-bold text-xs border border-${accentColor}-100 flex-shrink-0`}>
                        {hymn.date ? hymn.date.split('-').slice(1).join('.') : '-'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {hymn.leader}
                          </span>
                          <h3 className="text-sm font-bold text-gray-900">{hymn.title}</h3>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                등록된 찬송가가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
            <Music className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">시작찬송 관리</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
          <button
            onClick={() => setIsMobileView(!isMobileView)}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            title={isMobileView ? "PC 화면으로 보기" : "모바일 화면으로 보기"}
          >
            {isMobileView ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
          </button>
          <div className={`flex items-center space-x-2 sm:space-x-4 bg-white rounded-lg shadow-sm border border-gray-200 p-1 ${isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
            <button onClick={handlePrevMonth} className="p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-semibold text-gray-900 w-16 text-center">{currentMonth}월</span>
            <button onClick={handleNextMonth} className="p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {isAdmin && (!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
              일정 관리
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleCancelEdit} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                <X className="w-4 h-4" />
                취소
              </button>
              <button onClick={handleSaveEdit} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
                <Save className="w-4 h-4" />
                저장하기
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderHymnList('Sunday')}
        {renderHymnList('Wednesday')}
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-600 font-bold">i</div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-emerald-900">시작찬송 안내</h3>
          <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
            예배 시작 전 대원들이 함께 부르는 시작찬송 목록입니다. 주일과 수요일 각각 주차별로 관리하실 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
