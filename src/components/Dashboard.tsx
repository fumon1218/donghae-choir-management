import { useState, useEffect } from 'react';
import { Users, Music, Calendar } from 'lucide-react';
import { members as initialMembers, hymns, schedules, Member } from '../data';

export default function Dashboard() {
  const [allMembers, setAllMembers] = useState<Member[]>([]);

  useEffect(() => {
    const savedMembers = localStorage.getItem('choir_extra_members');
    const extraMembers = savedMembers ? JSON.parse(savedMembers) : [];
    setAllMembers([...initialMembers, ...extraMembers]);
  }, []);

  const totalMembers = allMembers.length;
  const parts = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];
  const memberCounts = parts.map(part => ({
    part,
    count: allMembers.filter(m => m.part === part).length
  }));

  const currentMonth = new Date().getMonth() + 1;
  const thisMonthHymns = hymns.filter(h => h.month === currentMonth);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <span className="text-gray-500 font-medium">동해교회 찬양대</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">총 인원</p>
            <p className="text-2xl font-bold text-gray-900">{totalMembers}명</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">이번 달 찬송가</p>
            <p className="text-2xl font-bold text-gray-900">{thisMonthHymns.length}곡</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">주간 연습</p>
            <p className="text-2xl font-bold text-gray-900">{schedules.length}회</p>
          </div>
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
                      style={{ width: `${(count / totalMembers) * 100}%` }}
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
                  <div className="flex-shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 text-gray-600 font-semibold text-sm">
                    {hymn.week}주
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
    </div>
  );
}
