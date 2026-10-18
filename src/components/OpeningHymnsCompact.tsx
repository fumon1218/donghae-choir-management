import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface OpeningHymn {
  id: string;
  month: number;
  date: string;
  type: 'Sunday' | 'Wednesday';
  leader: string;
  title: string;
  num?: number;
  title2?: string;
  num2?: number;
}

/** 월별 찬송가 화면 아래에 함께 보여 주는, 작게 줄인 시작찬송 목록 (보기 전용). */
export default function OpeningHymnsCompact({ month }: { month: number }) {
  const [all, setAll] = useState<OpeningHymn[]>([]);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'settings', 'opening_hymns'),
      snap => setAll(snap.exists() && Array.isArray(snap.data().list) ? snap.data().list : []),
      err => console.error('Error fetching opening hymns:', err),
    );
  }, []);

  const rows = all
    .filter(h => Number(h.month) === month)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const groups: { type: OpeningHymn['type']; title: string; chip: string }[] = [
    { type: 'Sunday', title: '주일 시작찬송', chip: 'bg-blue-50 text-blue-700 border-blue-100' },
    { type: 'Wednesday', title: '수요일 시작찬송', chip: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-emerald-600" />
          {month}월 시작찬송
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-gray-100">
        {groups.map(g => {
          const list = rows.filter(h => h.type === g.type);
          return (
            <div key={g.type} className="px-4 py-3 border-b md:border-b-0 border-gray-100 last:border-b-0">
              <div className="text-[11px] font-bold text-gray-400 mb-1.5">{g.title}</div>
              {list.length > 0 ? (
                <ul className="space-y-1.5">
                  {list.map(h => (
                    <li key={h.id} className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[11px] font-bold ${g.chip}`}>
                        {h.date ? h.date.split('-').slice(1).join('.') : '-'}
                      </span>
                      <span className="text-[13px] font-medium text-gray-900 truncate">
                        {h.num ? `${h.num}장 ` : ''}{h.title}
                        {h.title2 && <span className="text-gray-500"> · {h.num2 ? `${h.num2}장 ` : ''}{h.title2}</span>}
                      </span>
                      {h.leader && <span className="ml-auto shrink-0 text-[11px] text-gray-400">{h.leader}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">등록된 찬송가가 없습니다.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
