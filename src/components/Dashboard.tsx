import { useState, useEffect } from 'react';
import { Users, Music, Calendar, Loader2, Megaphone, Edit3, Save, X, Plus, Trash2, Clock, MapPin } from 'lucide-react';
import { hymns, Member, Schedule as ScheduleType } from '../data';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DashboardProps {
  userRole: string | null;
}

export default function Dashboard({ userRole }: DashboardProps) {
  const isAdmin = userRole === '대장' || userRole === '지휘자' || userRole?.includes('관리자');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [adContent, setAdContent] = useState('');
  const [isEditingAd, setIsEditingAd] = useState(false);
  const [tempAdContent, setTempAdContent] = useState('');
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [isManagingSchedules, setIsManagingSchedules] = useState(false);
  const [editSchedules, setEditSchedules] = useState<ScheduleType[]>([]);

  // Fetch Advertisement Content
  useEffect(() => {
    const unsubAd = onSnapshot(doc(db, 'settings', 'advertisement'), (docSnap) => {
      if (docSnap.exists()) {
        setAdContent(docSnap.data().content || '');
      }
    });

    const unsubSchedules = onSnapshot(doc(db, 'settings', 'schedules'), (docSnap) => {
      if (docSnap.exists()) {
        setSchedules(docSnap.data().list || []);
      }
    });

    return () => {
      unsubAd();
      unsubSchedules();
    };
  }, []);

  useEffect(() => {
    // Firestore에서 승인된 대원 목록만 실시간으로 가져오기
    const q = query(
      collection(db, 'users'),
      where('role', '!=', '대기권한')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memberList: Member[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        memberList.push({
          id: doc.id,
          name: data.name || '',
          part: data.part || 'Orchestra',
          role: data.role,
          imageUrl: data.imageUrl
        } as Member);
      });
      setAllMembers(memberList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching members for dashboard:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalMembers = allMembers.length;
  const parts = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];
  const memberCounts = parts.map(part => ({
    part,
    count: allMembers.filter(m => m.part === part).length
  }));

  const handleSaveAd = async () => {
    try {
      await setDoc(doc(db, 'settings', 'advertisement'), {
        content: tempAdContent,
        updatedAt: Date.now()
      }, { merge: true });
      setIsEditingAd(false);
    } catch (error) {
      console.error("Error saving advertisement:", error);
      alert("광고 내용을 저장하는 중 오류가 발생했습니다.");
    }
  };

  const currentMonth = new Date().getMonth() + 1;
  const thisMonthHymns = hymns.filter(h => h.month === currentMonth);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <span className="text-gray-500 font-medium whitespace-nowrap">동해교회 찬양대</span>
      </div>

      {/* Advertisement Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Megaphone className="w-32 h-32 rotate-12" />
        </div>
        <div className="p-6 md:p-8 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-blue-100">
              <Megaphone className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider">광고 및 공지</span>
            </div>
            {isAdmin && !isEditingAd && (
              <button
                onClick={() => {
                  setTempAdContent(adContent);
                  setIsEditingAd(true);
                }}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
              >
                <Edit3 className="w-3.5 h-3.5" />
                광고 수정
              </button>
            )}
          </div>

          {isEditingAd ? (
            <div className="space-y-4">
              <textarea
                value={tempAdContent}
                onChange={(e) => setTempAdContent(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 h-32 transition-all"
                placeholder="광고 내용을 입력해 주세요..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingAd(false)}
                  className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveAd}
                  className="px-6 py-2 bg-white text-blue-700 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-50 transition-all flex items-center gap-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  저장하기
                </button>
              </div>
            </div>
          ) : (
            <div className="min-h-[60px]">
              {adContent ? (
                <p className="text-white text-lg md:text-xl font-medium leading-relaxed whitespace-pre-wrap">
                  {adContent}
                </p>
              ) : (
                <p className="text-white/50 text-base italic">등록된 광고 내용이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-500">총 인원</p>
            {loading ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 truncate">{totalMembers}명</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <Music className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-500">이번 달 찬송가</p>
            <p className="text-2xl font-bold text-gray-900 truncate">{thisMonthHymns.length}곡</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-500">주간 연습</p>
              <p className="text-2xl font-bold text-gray-900 truncate">{schedules.length}회</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setEditSchedules([...schedules]);
                setIsManagingSchedules(true);
              }}
              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="연습 일정 수정"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">파트별 인원 현황</h2>
          <div className="space-y-4">
            {memberCounts.map(({ part, count }) => (
              <div key={part} className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">{part}</span>
                <div className="flex items-center space-x-3 w-2/3">
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${(count / (totalMembers || 1)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}명</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{currentMonth}월 찬송가</h2>
          {thisMonthHymns.length > 0 ? (
            <div className="space-y-3">
              {thisMonthHymns.map((hymn, idx) => (
                <div key={idx} className="flex items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 text-gray-600 font-semibold text-[10px]">
                    {hymn.date}
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">{hymn.title}</p>
                    <p className="text-xs text-gray-500">{hymn.composer}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">이번 달 찬송가 목록이 없습니다.</p>
          )}
        </div>
      </div>

      {/* Schedule Management Modal */}
      {isManagingSchedules && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={() => setIsManagingSchedules(false)}>
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900">주간 연습 일정 관리</h3>
                <p className="text-xs text-gray-500 mt-0.5">대시보드와 일정 탭에 반영됩니다.</p>
              </div>
              <button onClick={() => setIsManagingSchedules(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
              {editSchedules.map((schedule, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3 relative group">
                  <button
                    onClick={() => setEditSchedules(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-3 right-3 p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">요일</label>
                      <input
                        type="text"
                        value={schedule.day}
                        onChange={e => {
                          const newList = [...editSchedules];
                          newList[idx] = { ...newList[idx], day: e.target.value };
                          setEditSchedules(newList);
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="예: 주일 (일요일)"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">시간</label>
                      <input
                        type="text"
                        value={schedule.time}
                        onChange={e => {
                          const newList = [...editSchedules];
                          newList[idx] = { ...newList[idx], time: e.target.value };
                          setEditSchedules(newList);
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="예: 09:00 - 10:30"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">장소</label>
                      <input
                        type="text"
                        value={schedule.location}
                        onChange={e => {
                          const newList = [...editSchedules];
                          newList[idx] = { ...newList[idx], location: e.target.value };
                          setEditSchedules(newList);
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="예: 제1찬양대실"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">설명</label>
                    <input
                      type="text"
                      value={schedule.description}
                      onChange={e => {
                        const newList = [...editSchedules];
                        newList[idx] = { ...newList[idx], description: e.target.value };
                        setEditSchedules(newList);
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="예: 주일 1부 예배 찬양 연습"
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={() => setEditSchedules([...editSchedules, { day: '', time: '', location: '', description: '' }])}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 group"
              >
                <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">새로운 일정 추가</span>
              </button>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setIsManagingSchedules(false)}
                className="flex-1 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  try {
                    await setDoc(doc(db, 'settings', 'schedules'), { list: editSchedules });
                    setIsManagingSchedules(false);
                  } catch (error) {
                    alert('일정 저장 중 오류가 발생했습니다.');
                  }
                }}
                className="flex-[2] px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                모든 변경사항 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
