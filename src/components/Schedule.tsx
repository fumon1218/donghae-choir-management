import { useState, useEffect } from 'react';
import { schedules as initialSchedules, Schedule as ScheduleType } from '../data';
import { Clock, MapPin, CalendarDays, Edit2, Save, X, Plus, Trash2 } from 'lucide-react';

interface ScheduleProps {
  userRole: string | null;
}

export default function Schedule({ userRole }: ScheduleProps) {
  const isAdmin = userRole === '대장' || userRole === '지휘자' || userRole?.includes('관리자');
  const [schedules, setSchedules] = useState<ScheduleType[]>(() => {
    const saved = localStorage.getItem('choir_schedules');
    return saved ? JSON.parse(saved) : initialSchedules;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editList, setEditList] = useState<ScheduleType[]>([]);

  const handleStartEdit = () => {
    setEditList([...schedules]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    setSchedules(editList);
    localStorage.setItem('choir_schedules', JSON.stringify(editList));
    setIsEditing(false);
  };

  const handleUpdateItem = (index: number, field: keyof ScheduleType, value: string) => {
    const newList = [...editList];
    newList[index] = { ...newList[index], [field]: value };
    setEditList(newList);
  };

  const handleAddItem = () => {
    setEditList([...editList, { day: '', time: '', location: '', description: '' }]);
  };

  const handleDeleteItem = (index: number) => {
    setEditList(editList.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">연습 스케줄</h1>
        {isAdmin && (
          !isEditing ? (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
              스케줄 수정
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              정기 연습 일정
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              찬양대 정기 연습 및 파트별 연습 시간표입니다.
            </p>
          </div>
          {isAdmin && isEditing && (
            <button
              onClick={handleAddItem}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              일정 추가
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-100">
          {(isEditing ? editList : schedules).map((schedule, idx) => (
            <div key={idx} className="p-6 hover:bg-gray-50 transition-colors">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">요일</label>
                      <input
                        type="text"
                        value={schedule.day}
                        onChange={(e) => handleUpdateItem(idx, 'day', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="예: 주일 (일요일)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">시간</label>
                      <input
                        type="text"
                        value={schedule.time}
                        onChange={(e) => handleUpdateItem(idx, 'time', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="예: 09:00 - 10:30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">장소</label>
                      <input
                        type="text"
                        value={schedule.location}
                        onChange={(e) => handleUpdateItem(idx, 'location', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="예: 제1찬양대실"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">설명</label>
                      <input
                        type="text"
                        value={schedule.description}
                        onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="예: 주일 1부 예배 찬양 연습"
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteItem(idx)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="sm:w-48 flex-shrink-0">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {schedule.day}
                    </span>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center text-gray-700">
                      <Clock className="w-5 h-5 mr-3 text-gray-400" />
                      <span className="font-medium">{schedule.time}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                      <span>{schedule.location}</span>
                    </div>
                  </div>

                  <div className="sm:w-64 flex-shrink-0 text-sm text-gray-500 bg-gray-100/50 px-4 py-2 rounded-lg">
                    {schedule.description}
                  </div>
                </div>
              )}
            </div>
          ))}
          {(isEditing ? editList : schedules).length === 0 && (
            <div className="p-12 text-center text-gray-500">
              등록된 연습 일정이 없습니다.
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 font-bold">
            i
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-900">연습 참여 안내</h3>
          <ul className="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>모든 대원은 연습 시작 10분 전까지 지정된 장소에 도착해 주시기 바랍니다.</li>
            <li>불참 시 반드시 파트장에게 사전에 연락해 주시기 바랍니다.</li>
            <li>특별 연습 일정은 별도로 공지됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
