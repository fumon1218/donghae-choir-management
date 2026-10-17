import { useState, useEffect, useRef } from 'react';
import { members as initialMembers, Part, Member } from '../data';
import { getPracticeDates, PracticeDate } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Check, X, Save, Users, Smartphone, Monitor } from 'lucide-react';
import { collection, query, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

type AttendanceStatus = 'present' | 'absent' | 'none';

interface AttendanceRecord {
  [memberId: string]: {
    [date: string]: AttendanceStatus;
  };
}

/** 모든 대원의 출석을 대신 체크할 수 있는 직책. 파트장은 자기 파트 대원만, 그 외 대원은 본인만. */
const FULL_ACCESS_ROLES = ['대장', '지휘자', '총무', '서기'];

/** Firestore 오류를 사람이 읽을 수 있는 문장으로 */
const describeError = (err: any): string => {
  const code = String(err?.code || '');
  if (code.includes('permission-denied')) return '권한이 없습니다 (permission-denied). Firestore 보안 규칙이 배포되어 있는지 확인해 주세요.';
  if (code.includes('unavailable') || code.includes('network')) return '네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.';
  if (code.includes('unauthenticated')) return '로그인이 풀렸습니다. 다시 로그인해 주세요.';
  return `알 수 없는 오류${code ? ` (${code})` : ''}`;
};

interface AttendanceProps {
  userData?: any;
  userRole?: string | null;
}

export default function Attendance({ userData, userRole }: AttendanceProps) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [activePart, setActivePart] = useState<Part | 'All'>('All');
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  // 연속으로 빠르게 눌러도 항상 최신 상태를 보도록 ref로도 들고 있습니다.
  const attendanceRef = useRef<AttendanceRecord>({});
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { attendanceRef.current = attendance; }, [attendance]);

  const isFullAccess = !!userRole && FULL_ACCESS_ROLES.includes(userRole);
  const canEditMember = (m: Member) =>
    isFullAccess || userData?.uid === m.id || (userRole === '파트장' && !!userData?.part && userData.part === m.part);

  // Load attendance records (Optimized to prevent data loss)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      const newAttendance: AttendanceRecord = {};
      const legacyDocs: AttendanceRecord[] = [];
      const individualDocs: {id: string, data: any}[] = [];
      
      snapshot.forEach(docSnap => {
        if (docSnap.id === 'all') {
          legacyDocs.push(docSnap.data() as AttendanceRecord);
        } else {
          individualDocs.push({ id: docSnap.id, data: docSnap.data() });
        }
      });

      // 1. First, apply legacy data
      legacyDocs.forEach(legacyData => {
        Object.keys(legacyData).forEach(mId => {
          if (!newAttendance[mId]) newAttendance[mId] = {};
          newAttendance[mId] = { ...newAttendance[mId], ...legacyData[mId] };
        });
      });

      // 2. Then, apply individual member data (Priority)
      individualDocs.forEach(item => {
        newAttendance[item.id] = { 
          ...(newAttendance[item.id] || {}), 
          ...item.data 
        } as any;
      });
      
      setAttendance(newAttendance);
    }, (error) => {
      console.error("Error fetching attendance records:", error);
      setNotice(`출석 기록을 불러오지 못했습니다. ${describeError(error)}`);
    });
    return () => unsub();
  }, []);

  // Load members from Firestore (Sync 'users' collection)
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: Member[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // '대기권한' 사용자는 출석부 명단에서 제외 (Members.tsx와 동일한 규칙)
        if (data.role === '대기권한') return;

        usersData.push({
          id: doc.id,
          name: data.name || data.displayName || '이름 없음',
          part: (data.part || 'Orchestra') as Part,
          role: data.role || '일반대원',
          imageUrl: data.imageUrl || data.photoURL
        });
      });

      // 이름순으로 정렬 (이름이 없는 경우 '이름 없음'이 되므로 안전함)
      setAllMembers(usersData.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => {
      console.error("Error fetching members:", error);
      setNotice(`대원 명단을 불러오지 못했습니다. ${describeError(error)}`);
    });

    return () => unsubscribe();
  }, []);

  const practiceDates = getPracticeDates(currentYear, currentMonth);
  const parts: (Part | 'All')[] = ['All', 'Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];

  const filteredMembers = allMembers.filter(m => activePart === 'All' || m.part === activePart);

  const toggleAttendance = async (member: Member, date: string) => {
    const memberId = member.id;
    if (!canEditMember(member)) {
      setNotice(
        userRole === '파트장'
          ? '파트장은 본인 파트 대원의 출석만 체크할 수 있습니다.'
          : '본인의 출석만 체크할 수 있습니다.'
      );
      return;
    }
    setNotice(null);

    const memberData = attendanceRef.current[memberId] || {};
    const currentStatus = memberData[date] || 'none';

    let nextStatus: AttendanceStatus = 'present';
    if (currentStatus === 'present') nextStatus = 'absent';
    else if (currentStatus === 'absent') nextStatus = 'none';

    // 1. 화면을 먼저 바꿉니다. (이 칸만 바꾸고 같은 대원의 다른 칸은 최신 값을 유지)
    setAttendance(prev => ({
      ...prev,
      [memberId]: { ...(prev[memberId] || {}), [date]: nextStatus }
    }));

    // 2. 서버에 저장 (이 칸만 merge)
    try {
      await setDoc(doc(db, 'attendance', memberId), { [date]: nextStatus }, { merge: true });
    } catch (err) {
      console.error("Firestore Save Error for member", memberId, ":", err);
      setNotice(`저장하지 못했습니다. ${describeError(err)}`);
      // 실패하면 이 칸만 원래 값으로 되돌립니다.
      setAttendance(prev => ({
        ...prev,
        [memberId]: { ...(prev[memberId] || {}), [date]: currentStatus }
      }));
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return <Check className="w-4 h-4 text-emerald-600" />;
      case 'absent': return <X className="w-4 h-4 text-rose-600" />;
      default: return null;
    }
  };

  const getStatusBg = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100';
      case 'absent': return 'bg-rose-50 border-rose-100 hover:bg-rose-100';
      default: return 'bg-gray-50 border-gray-100 hover:bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">출석부 ({currentYear}년)</h1>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsMobileView(!isMobileView)}
            className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title={isMobileView ? "PC 화면으로 보기" : "모바일 화면으로 보기"}
          >
            {isMobileView ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            {/* Year Navigation */}
            <div className="flex items-center space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
              <button onClick={() => setCurrentYear(y => y - 1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold w-14 text-center text-gray-900">{currentYear}년</span>
              <button onClick={() => setCurrentYear(y => y + 1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
              <button onClick={() => setCurrentMonth(m => m === 1 ? 12 : m - 1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold w-10 text-center text-gray-900">{currentMonth}월</span>
              <button onClick={() => setCurrentMonth(m => m === 12 ? 1 : m + 1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1 overflow-x-auto">
            {parts.map(part => (
              <button
                key={part}
                onClick={() => setActivePart(part)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activePart === part ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {part === 'All' ? '전체' : part}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notice && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="알림 닫기" className="shrink-0 text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {isMobileView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredMembers.map(member => (
            <div key={member.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 shrink-0 transition-transform active:scale-[0.99]">
              <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
                <span className="font-bold text-gray-900">{member.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                  {member.part}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {practiceDates.map(pd => {
                  const status = attendance[member.id]?.[pd.date] || 'none';
                  return (
                    <div key={pd.date} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-500 font-medium">{pd.formattedDate}</span>
                      <button
                        onClick={() => toggleAttendance(member, pd.date)}
                            disabled={!canEditMember(member)}
                        title={canEditMember(member) ? undefined : '본인(또는 권한 있는 직책)만 체크할 수 있어요'}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all duration-200 active:scale-95 ${getStatusBg(status).replace('border-', 'border-b-')} shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {getStatusIcon(status)}
                      </button>
                      <span className="text-[9px] text-gray-400">{pd.dayName === 'Sun' ? '일' : '수'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="sticky left-0 z-10 bg-gray-50 p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-100 min-w-[120px]">
                    대원명
                  </th>
                  {practiceDates.map(pd => (
                    <th key={pd.date} className="p-4 text-center min-w-[80px]">
                      <div className="text-xs font-semibold text-gray-500 uppercase">
                        {pd.dayName === 'Sun' ? '일' : '수'}
                      </div>
                      <div className="text-sm font-bold text-gray-900">{pd.formattedDate}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map(member => (
                  <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="sticky left-0 z-10 bg-white p-4 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{member.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">{member.part[0]}</span>
                      </div>
                    </td>
                    {practiceDates.map(pd => {
                      const status = attendance[member.id]?.[pd.date] || 'none';
                      return (
                        <td key={pd.date} className="p-2 text-center min-w-[80px]">
                          <button
                            onClick={() => toggleAttendance(member, pd.date)}
                            disabled={!canEditMember(member)}
                        title={canEditMember(member) ? undefined : '본인(또는 권한 있는 직책)만 체크할 수 있어요'}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center mx-auto transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${getStatusBg(status)}`}
                          >
                            {getStatusIcon(status)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 px-2 mt-4 pb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div>
            <span>참석</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-rose-100 border border-rose-200"></div>
            <span>불참</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></div>
            <span>미체크</span>
          </div>
        </div>
        <p>* 눌러서 상태를 변경합니다 (미체크 → 참석 → 불참). {isFullAccess ? '전체 대원 체크 가능' : userRole === '파트장' ? '본인과 우리 파트 대원 체크 가능' : '본인 칸만 체크 가능'}</p>
      </div>
    </div>
  );
}
