import React, { useState, useEffect } from 'react';
import { hymns as initialHymns, Hymn } from '../data';
import { ChevronLeft, ChevronRight, Music, Edit2, Save, X, Plus, Trash2, Image as ImageIcon, Upload, Loader2, Smartphone, Monitor } from 'lucide-react';

interface HymnsProps {
  userRole: string | null;
}

export default function Hymns({ userRole }: HymnsProps) {
  const isAdmin = userRole === '대장' || userRole === '지휘자' || userRole?.includes('관리자');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [allHymns, setAllHymns] = useState<Hymn[]>(() => {
    const saved = localStorage.getItem('choir_hymns');
    return saved ? JSON.parse(saved) : initialHymns;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editHymns, setEditHymns] = useState<Hymn[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);

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

  const handleImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('5MB 이하의 이미지만 업로드 가능합니다.');
      return;
    }

    try {
      setUploadingIndex(index);
      const formData = new FormData();
      formData.append('image', file);

      // ImgBB API Key (using a test/demo key or require input later)
      // Note: Ideally this should come from process.env, but for now we'll ask user or use a public one if possible
      // Using a standard fetch to ImgBB
      const VITE_IMGBB_API_KEY = typeof process !== 'undefined' && process.env && process.env.VITE_IMGBB_API_KEY ? process.env.VITE_IMGBB_API_KEY : (import.meta as any).env?.VITE_IMGBB_API_KEY || '';

      if (!VITE_IMGBB_API_KEY) {
        alert('ImgBB API 키가 설정되지 않았습니다. 환경변수를 확인해주세요.');
        setUploadingIndex(null);
        return;
      }

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${VITE_IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        handleUpdateHymn(index, 'scoreUrl', data.data.url);
      } else {
        throw new Error(data.error?.message || '업로드 실패');
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const ImageModal = () => {
    if (!selectedImage) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 sm:p-6" onClick={() => setSelectedImage(null)}>
        <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center bg-white rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setSelectedImage(null)}
              className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="w-full h-full overflow-auto p-2 sm:p-4 bg-gray-50 flex items-center justify-center min-h-[50vh]">
            <img
              src={selectedImage}
              alt="악보 확대 이미지"
              className="max-w-full h-auto object-contain shadow-sm rounded-lg"
              style={{ maxHeight: 'calc(90vh - 2rem)' }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative">
      <ImageModal />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">월별 찬송가</h1>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
          <button
            onClick={() => setIsMobileView(!isMobileView)}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            title={isMobileView ? "PC 화면으로 보기" : "모바일 화면으로 보기"}
          >
            {isMobileView ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
          </button>
          <div className={`flex items-center space-x-2 sm:space-x-4 bg-white rounded-lg shadow-sm border border-gray-200 p-1 ${isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
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

          {isAdmin && (
            !isEditing ? (
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
            )
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

        {!isEditing && !isMobileView && currentMonthHymns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="p-4 text-xs font-semibold text-gray-500 w-24 text-center">주차</th>
                  <th className="p-4 text-xs font-semibold text-gray-500">제목 및 작곡</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 w-24 text-center">악보</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentMonthHymns.map((hymn, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-600 font-bold text-sm rounded-lg border border-blue-100">
                        {hymn.week}주
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-gray-900">{hymn.title}</span>
                        <span className="text-xs text-gray-500">작곡: {hymn.composer}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => hymn.scoreUrl ? setSelectedImage(hymn.scoreUrl) : null}
                        disabled={!hymn.scoreUrl}
                        className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors
                          ${hymn.scoreUrl
                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                            : 'text-gray-400 bg-gray-50 cursor-not-allowed border border-gray-100'}
                        `}
                        title={hymn.scoreUrl ? '악보 보기' : '악보 없음'}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          (isEditing ? editHymns : currentMonthHymns).length > 0 ? (
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
                      <div className="w-16 sm:w-20 lg:w-32 flex-shrink-0">
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">악보 이미지</label>
                        <div className="relative h-9 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer overflow-hidden group">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => handleImageUpload(idx, e)}
                            disabled={uploadingIndex === idx}
                          />
                          {uploadingIndex === idx ? (
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          ) : hymn.scoreUrl ? (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <ImageIcon className="w-4 h-4" />
                              <span className="text-xs font-medium hidden lg:inline">등록됨</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400 group-hover:text-blue-500">
                              <Upload className="w-4 h-4" />
                              <span className="text-xs font-medium hidden lg:inline">업로드</span>
                            </div>
                          )}
                        </div>
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
                        <button
                          onClick={() => hymn.scoreUrl ? setSelectedImage(hymn.scoreUrl) : null}
                          disabled={!hymn.scoreUrl}
                          className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2
                          ${hymn.scoreUrl
                              ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                              : 'text-gray-400 bg-gray-50 cursor-not-allowed border border-gray-100'}
                        `}
                        >
                          <ImageIcon className="w-4 h-4 hidden sm:inline-block" />
                          {hymn.scoreUrl ? '악보 보기' : '악보 없음'}
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
          )
        )}
      </div>
    </div>
  );
}
