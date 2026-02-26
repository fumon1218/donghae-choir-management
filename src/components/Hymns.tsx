import { useState, useEffect } from 'react';
import { hymns as initialHymns, Hymn } from '../data';
import { ChevronLeft, ChevronRight, Music, Edit2, Save, X, Plus, Trash2 } from 'lucide-react';

export default function Hymns() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [allHymns, setAllHymns] = useState<Hymn[]>(() => {
    const saved = localStorage.getItem('choir_hymns');
    return saved ? JSON.parse(saved) : initialHymns;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editHymns, setEditHymns] = useState<Hymn[]>([]);

  const currentMonthHymns = allHymns.filter(h => h.month === currentMonth);

  const handlePrevMonth = () => {
    if (isEditing) return;
    setCurrentMonth(prev => prev === 1 ? 12 : prev - 1);
  };

  const handleNextMonth = () => {
    if (isEditing) return;
    setCurrentMonth(prev => prev === 12 ? 1 : prev + 1);
  };

  const handleStartEdit = () => {
    setEditHymns([...currentMonthHymns]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    const otherMonthsHymns = allHymns.filter(h => h.month !== currentMonth);
    const updatedHymns = [...otherMonthsHymns, ...editHymns].sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      return a.week - b.week;
    });
    
    setAllHymns(updatedHymns);
    localStorage.setItem('choir_hymns', JSON.stringify(updatedHymns));
    setIsEditing(false);
  };

  const handleUpdateHymn = (index: number, field: keyof Hymn, value: string | number) => {
    const newList = [...editHymns];
    newList[index] = { ...newList[index], [field]: value };
    setEditHymns(newList);
  };

  const handleAddHymn = () => {
    const nextWeek = editHymns.length > 0 ? Math.max(...editHymns.map(h => h.week)) + 1 : 1;
    setEditHymns([...editHymns, { month: currentMonth, week: nextWeek, title: '', composer: '' }]);
  };

  const handleDeleteHymn = (index: number) => {
    setEditHymns(editHymns.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">월별 찬송가</h1>
        <div className="flex items-center gap-4">
          <div className={`flex items-center space-x-4 bg-white rounded-lg shadow-sm border border-gray-200 p-1 ${isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-semibold text-gray-900 w-16 text-center">
              {currentMonth}월
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
              찬송가 수정
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                저장하기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Music className="w-5 h-5 text-blue-600" />
            {currentMonth}월 찬양 목록
          </h2>
          {isEditing && (
            <button
              onClick={handleAddHymn}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              찬송가 추가
            </button>
          )}
        </div>

        {(isEditing ? editHymns : currentMonthHymns).length > 0 ? (
          <div className="divide-y divide-gray-100">
            {(isEditing ? editHymns : currentMonthHymns).map((hymn, idx) => (
              <div key={idx} className="p-6 flex items-center hover:bg-gray-50 transition-colors">
                {isEditing ? (
                  <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-20 flex-shrink-0">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">주차</label>
                      <input
                        type="number"
                        value={hymn.week}
                        onChange={(e) => handleUpdateHymn(idx, 'week', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">찬송가 제목</label>
                      <input
                        type="text"
                        value={hymn.title}
                        onChange={(e) => handleUpdateHymn(idx, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="제목 입력"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">작곡가</label>
                      <input
                        type="text"
                        value={hymn.composer}
                        onChange={(e) => handleUpdateHymn(idx, 'composer', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="작곡가 입력"
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteHymn(idx)}
                      className="mt-5 p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg border border-blue-100">
                      {hymn.week}주
                    </div>
                    <div className="ml-6 flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Music className="w-4 h-4 text-gray-400" />
                        {hymn.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                        작곡: {hymn.composer}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        악보 보기
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Music className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">찬송가 목록이 없습니다</h3>
            <p className="mt-1 text-gray-500">해당 월의 찬송가 일정이 등록되지 않았습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
