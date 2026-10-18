import { useState, useEffect } from 'react';
import { Headphones, Music, Calendar, MessageSquare, Edit3, Save, X, Plus, Trash2, Play, Clock, MapPin } from 'lucide-react';
import { Member, Schedule as ScheduleType, Hymn } from '../data';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DashboardProps {
  userRole: string | null;
  onNavigate?: (tab: string) => void;
  onOpenPractice?: (book: string, n: number) => void;
}

const BASE = import.meta.env.BASE_URL;
const SERIF = "'Noto Serif KR', serif";
const NAVY = '#1F2D4D';
const GOLD = '#C99A2E';
const PART_INFO: { part: string; label: string; color: string }[] = [
  { part: 'Soprano', label: '소프라노', color: '#1F2D4D' },
  { part: 'Alto', label: '알토', color: '#3E6FB0' },
  { part: 'Tenor', label: '테너', color: '#C99A2E' },
  { part: 'Bass', label: '베이스', color: '#2F8F83' },
  { part: 'Orchestra', label: '오케스트라', color: '#8A4F7D' },
];
const DAY_CHARS = '일월화수목금토';

function weekdayOf(day: string): number | null {
  const m = day.match(/([일월화수목금토])요일/);
  if (m) return DAY_CHARS.indexOf(m[1]);
  if (day.includes('주일')) return 0;
  const f = day.trim().charAt(0);
  return DAY_CHARS.includes(f) ? DAY_CHARS.indexOf(f) : null;
}

function parseHymnDate(date: string, fallbackYear: number): Date | null {
  const parts = String(date || '').split('-').map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) return new Date(parts[0], parts[1] - 1, parts[2]);
  if (parts.length === 2 && parts.every(n => !isNaN(n))) return new Date(fallbackYear, parts[0] - 1, parts[1]);
  return null;
}

export default function Dashboard({ userRole, onNavigate, onOpenPractice }: DashboardProps) {
  const isAdmin = userRole === '대장' || userRole === '지휘자' || userRole?.includes('관리자');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [adContent, setAdContent] = useState('');
  const [isEditingAd, setIsEditingAd] = useState(false);
  const [tempAdContent, setTempAdContent] = useState('');
  const [allHymns, setAllHymns] = useState<Hymn[]>([]);
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
        const list = docSnap.data().list || [];
        // 만약 서버 데이터가 비어있다면 기본 스케줄(data.ts)이라도 보여줍니다.
        if (list.length === 0) {
          import('../data').then(({ schedules: initialSchedules }) => {
            setSchedules(initialSchedules);
          });
        } else {
          setSchedules(list);
        }
      } else {
        // 문서가 아예 없는 경우 기본값 로드
        import('../data').then(({ schedules: initialSchedules }) => {
          setSchedules(initialSchedules);
        });
      }
    });

    const unsubHymns = onSnapshot(doc(db, 'settings', 'hymns_data'), (docSnap) => {
      if (docSnap.exists()) {
        setAllHymns(docSnap.data().list || []);
      }
    });

    return () => {
      unsubAd();
      unsubSchedules();
      unsubHymns();
    };
  }, []);

  useEffect(() => {
    // Firestore에서 대원 목록 실시간으로 가져오기
    // index 이슈 및 보안 규칙 필터링 오동작을 방지하기 위해 
    // 서버측 where('role', '!=', '대기권한') 대신 전체를 가져와서 라이브러리 레벨에서 필터링합니다.
    const q = query(collection(db, 'users'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memberList: Member[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // 대기권한은 대시보드 통계에서 제외
        if (data.role === '대기권한') return;

        memberList.push({
          id: doc.id,
          name: data.name || data.displayName || '이름 없음',
          part: data.part || 'Orchestra',
          role: data.role,
          imageUrl: data.imageUrl || data.photoURL
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
  const memberCounts = PART_INFO.map(info => ({
    ...info,
    count: allMembers.filter(m => m.part === info.part).length
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

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonth = now.getMonth() + 1;
  // 문자열/숫자 타입 불일치 및 배열 여부를 체크하여 에러를 방지합니다.
  const thisMonthHymns = Array.isArray(allHymns) ? allHymns.filter(h => Number(h.month) === currentMonth) : [];
  const hymnRows = thisMonthHymns.map(h => {
    const d = parseHymnDate(h.date, now.getFullYear());
    return { hymn: h, d, past: d ? d < today : false };
  });
  const upcomingIdx = hymnRows.findIndex(r => r.d && !r.past);
  const featuredIdx = upcomingIdx >= 0 ? upcomingIdx : hymnRows.length - 1;
  const featured = featuredIdx >= 0 ? hymnRows[featuredIdx] : null;

  const openHymn = (h: Hymn) => {
    if (h.book && h.num && onOpenPractice) onOpenPractice(h.book, h.num);
    else onNavigate?.('mp3-player');
  };

  // 다음 연습: 오늘 이후 가장 가까운 요일의 일정
  const nextPractice = (() => {
    if (!Array.isArray(schedules) || schedules.length === 0) return null;
    let best: { s: ScheduleType; diff: number | null } | null = null;
    for (const s of schedules) {
      const w = weekdayOf(s.day || '');
      const diff = w === null ? null : (w - today.getDay() + 7) % 7;
      if (!best) best = { s, diff };
      else if (diff !== null && (best.diff === null || diff < best.diff)) best = { s, diff };
    }
    return best;
  })();

  const notices = adContent
    .split('\n')
    .map(l => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);

  const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 ${DAY_CHARS[now.getDay()]}요일`;
  const quick = [
    { id: 'mp3-player', label: '찬송가 연습', icon: Headphones, bg: '#E8EDF7', fg: NAVY },
    { id: 'hymns', label: '월별 찬송가', icon: Music, bg: '#F5EBCB', fg: '#6B4E0F' },
    { id: 'schedule', label: '연습 스케줄', icon: Calendar, bg: '#DDEFEB', fg: '#1E6B61' },
    { id: 'legacy-board', label: '게시판', icon: MessageSquare, bg: '#F1E3EE', fg: '#7A3F6D' },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <div>
        <div className="text-sm text-gray-500">{dateLabel}</div>
        <h1 className="text-xl md:text-2xl font-bold leading-snug" style={{ fontFamily: SERIF, color: NAVY }}>동해교회 찬양대</h1>
      </div>

      {/* 이번 주일 찬양 + 다음 연습 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <div
          className="lg:col-span-2 relative rounded-2xl overflow-hidden text-white min-h-[250px] md:min-h-[290px] flex flex-col"
          style={{ background: `linear-gradient(160deg,#16203A,${NAVY} 60%,#3A4A6E)` }}
        >
          <img
            src={`${BASE}images/dash-hero.jpg`}
            alt=""
            aria-hidden="true"
            className="absolute inset-y-0 right-0 h-full w-[75%] md:w-[65%] object-cover object-right"
            style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, #000 55%)', maskImage: 'linear-gradient(to right, transparent, #000 55%)' }}
          />
          <div className="relative p-6 md:p-8 flex flex-col gap-3 flex-1">
            <span className="self-start text-xs font-bold px-3 py-1 rounded-full" style={{ background: GOLD, color: '#1B2233' }}>이번 주일 찬양</span>
            {featured ? (
              <>
                <div className="text-3xl md:text-4xl font-bold leading-tight max-w-[70%]" style={{ fontFamily: SERIF }}>
                  {featured.hymn.title || '제목 없음'}
                </div>
                <div className="text-sm text-[#E8E2D2]">
                  {featured.d ? `${featured.d.getMonth() + 1}월 ${featured.d.getDate()}일` : ''}
                  {featured.hymn.num ? ` · ${featured.hymn.book === 'grace' ? '은혜찬송가' : '찬송가'} ${featured.hymn.num}장` : ''}
                </div>
                <button
                  onClick={() => openHymn(featured.hymn)}
                  className="mt-auto self-start md:self-start w-full md:w-auto inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl bg-white font-bold text-[15px] hover:bg-gray-100 transition-colors"
                  style={{ color: NAVY }}
                >
                  <Play className="w-4 h-4" fill={NAVY} /> 악보 보며 연습하기
                </button>
              </>
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold leading-tight max-w-[70%]" style={{ fontFamily: SERIF }}>이번 달 찬송가가 아직 없습니다</div>
                <button
                  onClick={() => onNavigate?.('hymns')}
                  className="mt-auto self-start inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl bg-white font-bold text-[15px]"
                  style={{ color: NAVY }}
                >
                  월별 찬송가 보기
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E6DFCF] p-5 md:p-6 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-500">다음 연습</div>
              {nextPractice ? (
                <>
                  <div className="text-xl md:text-2xl font-bold mt-1 leading-snug" style={{ fontFamily: SERIF, color: NAVY }}>
                    {nextPractice.s.day}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-2"><Clock className="w-4 h-4 shrink-0" />{nextPractice.s.time}</div>
                  {nextPractice.s.location && <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1"><MapPin className="w-4 h-4 shrink-0" />{nextPractice.s.location}</div>}
                </>
              ) : (
                <div className="text-sm text-gray-500 mt-2">등록된 연습 일정이 없습니다.</div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {nextPractice && nextPractice.diff !== null && (
                <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: '#F0E6C8', color: '#6B4E0F' }}>
                  {nextPractice.diff === 0 ? '오늘' : `D-${nextPractice.diff}`}
                </span>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditSchedules(Array.isArray(schedules) ? [...schedules] : []);
                    setIsManagingSchedules(true);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: NAVY }}
                  title="연습 일정 수정"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <button onClick={() => onNavigate?.('schedule')} className="text-sm font-bold text-left min-h-[40px]" style={{ color: NAVY }}>
            전체 일정 보기 →
          </button>
        </div>
      </div>

      {/* 바로가기 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {quick.map(q => (
          <button
            key={q.id}
            onClick={() => onNavigate?.(q.id)}
            className="flex items-center gap-3 min-h-[56px] px-4 rounded-2xl bg-white border border-[#E6DFCF] hover:shadow-md transition-all text-left font-bold text-sm text-gray-900"
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: q.bg, color: q.fg }}>
              <q.icon className="w-[18px] h-[18px]" />
            </span>
            {q.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        {/* 월 찬송가 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E6DFCF] p-5 md:p-6">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-bold" style={{ fontFamily: SERIF, color: NAVY }}>{currentMonth}월 찬송가</h2>
            <span className="text-xs text-gray-500">{thisMonthHymns.length}곡</span>
          </div>
          {hymnRows.length > 0 ? (
            <div>
              {hymnRows.map((r, idx) => {
                const isFeatured = idx === featuredIdx;
                const linked = !!(r.hymn.book && r.hymn.num);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 md:gap-4 py-3 ${isFeatured ? 'px-3 -mx-3 my-1 rounded-xl border-[1.5px]' : 'border-b border-[#EFE9DA] last:border-b-0'} ${r.past ? 'opacity-60' : ''}`}
                    style={isFeatured ? { background: '#FBF3DC', borderColor: GOLD } : undefined}
                  >
                    <div className="w-14 text-center font-bold text-[15px]" style={{ color: isFeatured ? NAVY : undefined }}>
                      {r.d ? `${r.d.getDate()}일` : String(r.hymn.date || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold ${isFeatured ? 'text-[15px]' : 'text-sm'} truncate`} style={{ color: isFeatured ? NAVY : undefined }}>{r.hymn.title || '제목 없음'}</div>
                      <div className="text-xs text-gray-500 truncate" style={isFeatured ? { color: '#6B4E0F' } : undefined}>
                        {[r.hymn.num ? `${r.hymn.num}장` : '', isFeatured && !r.past ? '이번 주일' : '', r.hymn.composer && r.hymn.composer !== '미상' ? `작곡: ${r.hymn.composer}` : '', !linked ? '연습 연결 없음' : ''].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {linked ? (
                      <button
                        onClick={() => openHymn(r.hymn)}
                        aria-label={`${r.hymn.title} 연습`}
                        className={`min-w-[48px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-sm font-bold ${isFeatured ? 'text-white' : 'bg-[#EEF1F7] hover:bg-[#E2E7F2]'}`}
                        style={isFeatured ? { background: NAVY } : { color: NAVY }}
                      >
                        <Play className="w-4 h-4" fill="currentColor" />
                      </button>
                    ) : (
                      <span className="min-w-[48px]" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <img src={`${BASE}images/dash-empty.png`} alt="" className="w-56 md:w-72 rounded-2xl mb-3" />
              <p className="text-gray-500 text-sm">이번 달 찬송가 목록이 없습니다.</p>
            </div>
          )}
        </div>

        <div className="space-y-5 md:space-y-6">
          {/* 공지 */}
          <div className="relative bg-white rounded-2xl border border-[#E6DFCF] p-5 md:p-6 overflow-hidden">
            <img src={`${BASE}images/dash-olive.png`} alt="" aria-hidden="true" className="absolute -top-2 -right-2 w-20 opacity-90 pointer-events-none" />
            <div className="flex items-center justify-between mb-3 relative">
              <h2 className="text-lg font-bold" style={{ fontFamily: SERIF, color: NAVY }}>공지</h2>
              {isAdmin && !isEditingAd && (
                <button
                  onClick={() => { setTempAdContent(adContent); setIsEditingAd(true); }}
                  className="mr-14 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  <Edit3 className="w-3.5 h-3.5" /> 수정
                </button>
              )}
            </div>
            {isEditingAd ? (
              <div className="space-y-3 relative">
                <textarea
                  value={tempAdContent}
                  onChange={(e) => setTempAdContent(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm h-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="공지를 한 줄에 하나씩 입력해 주세요..."
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditingAd(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800 text-sm font-medium">취소</button>
                  <button onClick={handleSaveAd} className="px-5 py-2 text-white rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: NAVY }}>
                    <Save className="w-3.5 h-3.5" /> 저장
                  </button>
                </div>
              </div>
            ) : notices.length > 0 ? (
              <ul className="space-y-2 text-sm leading-relaxed relative">
                {notices.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic relative">등록된 공지가 없습니다.</p>
            )}
          </div>

          {/* 파트별 인원 */}
          <div className="bg-white rounded-2xl border border-[#E6DFCF] p-5 md:p-6">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-bold" style={{ fontFamily: SERIF, color: NAVY }}>파트별 인원</h2>
              <button onClick={() => onNavigate?.('member-status')} className="text-xs text-gray-500 hover:text-gray-800 min-h-[32px]">
                {loading ? '불러오는 중…' : `총 ${totalMembers}명 →`}
              </button>
            </div>
            <div className="flex h-3 rounded-md overflow-hidden gap-0.5 bg-gray-100">
              {memberCounts.map(m => m.count > 0 && (
                <div key={m.part} style={{ flex: m.count, background: m.color }} title={`${m.label} ${m.count}명`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-[13px]">
              {memberCounts.map(m => (
                <div key={m.part} className="flex items-center justify-between">
                  <span className="flex items-center"><span className="inline-block w-2.5 h-2.5 rounded-[3px] mr-1.5" style={{ background: m.color }} />{m.label}</span>
                  <b>{m.count}</b>
                </div>
              ))}
            </div>
          </div>
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
