import { useState, useEffect } from 'react';
import { members as initialMembers, Part, Member } from '../data';
import { getPracticeDates, PracticeDate } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Check, X, Save, Users } from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | 'none';

interface AttendanceRecord {
  [memberId: string]: {
    [date: string]: AttendanceStatus;
  };
}

export default function Attendance() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [activePart, setActivePart] = useState<Part | 'All'>('All');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord>(() => {
    const saved = localStorage.getItem('choir_attendance');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const savedMembers = localStorage.getItem('choir_extra_members');
    const extraMembers = savedMembers ? JSON.parse(savedMembers) : [];
    const savedDeleted = localStorage.getItem('choir_deleted_members');
    const deletedMembers: string[] = savedDeleted ? JSON.parse(savedDeleted) : [];

    setAllMembers([...initialMembers, ...extraMembers].filter(m => !deletedMembers.includes(m.id)));
  }, []);

  const practiceDates = getPracticeDates(2026, currentMonth);
  const parts: (Part | 'All')[] = ['All', 'Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];

  const filteredMembers = allMembers.filter(m => activePart === 'All' || m.part === activePart);

  const toggleAttendance = (memberId: string, date: string) => {
    setAttendance(prev => {
      const memberData = prev[memberId] || {};
      const currentStatus = memberData[date] || 'none';

      let nextStatus: AttendanceStatus = 'present';
      if (currentStatus === 'present') nextStatus = 'absent';
      else if (currentStatus === 'absent') nextStatus = 'none';

      const newState = {
        ...prev,
        [memberId]: {
          ...memberData,
          [date]: nextStatus
        }
      };

      localStorage.setItem('choir_attendance', JSON.stringify(newState));
      return newState;
    });
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
        <h1 className="text-2xl font-bold text-gray-900">출석부 (2026년)</h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button onClick={() => setCurrentMonth(m => m === 1 ? 12 : m - 1)} className="p-1.5 rounded hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold w-12 text-center">{currentMonth}월</span>
            <button onClick={() => setCurrentMonth(m => m === 12 ? 1 : m + 1)} className="p-1.5 rounded hover:bg-gray-100">
              <ChevronRight className="w-4 h-4" />
            </button>
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
                    <div className="text-xs font-semibold text-gray-500 uppercase">{pd.dayName === 'Sun' ? '일' : '수'}</div>
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
                      <span className="text-sm font-medium text-gray-900">{member.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{member.part[0]}</span>
                    </div>
                  </td>
                  {practiceDates.map(pd => {
                    const status = attendance[member.id]?.[pd.date] || 'none';
                    return (
                      <td key={pd.date} className="p-2 text-center">
                        <button
                          onClick={() => toggleAttendance(member.id, pd.date)}
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all duration-200 ${getStatusBg(status)}`}
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

      <div className="flex items-center justify-between text-xs text-gray-500 px-2">
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
        <p>* 클릭하여 상태를 변경합니다 (미체크 → 참석 → 불참)</p>
      </div>
    </div>
  );
}
