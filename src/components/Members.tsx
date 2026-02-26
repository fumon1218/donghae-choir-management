import { useState, useEffect } from 'react';
import { members as initialMembers, Part, Member } from '../data';
import { Search, User, UserPlus, Copy, CheckCircle, Trash2 } from 'lucide-react';

export default function Members() {
  const [activeTab, setActiveTab] = useState<Part | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [showInviteToast, setShowInviteToast] = useState(false);

  // Load members and handle permissions
  useEffect(() => {
    const savedMembers = localStorage.getItem('choir_extra_members');
    const extraMembers: Member[] = savedMembers ? JSON.parse(savedMembers) : [];

    // Check for updated roles in local storage
    const savedRoles = localStorage.getItem('choir_member_roles');
    const memberRoles: Record<string, string> = savedRoles ? JSON.parse(savedRoles) : {};

    const savedDeleted = localStorage.getItem('choir_deleted_members');
    const deletedMembers: string[] = savedDeleted ? JSON.parse(savedDeleted) : [];

    const combinedMembers = [...initialMembers, ...extraMembers].map(member => ({
      ...member,
      role: memberRoles[member.id] || member.role
    }));

    setAllMembers(combinedMembers.filter(m => !deletedMembers.includes(m.id)));
  }, []);

  const parts: (Part | 'All')[] = ['All', 'Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];

  const filteredMembers = allMembers.filter(member => {
    const matchesPart = activeTab === 'All' || member.part === activeTab;
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPart && matchesSearch;
  });

  const handleInvite = async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=true`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = inviteUrl;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (error) {
          console.error('Fallback copy failed', error);
          alert('초대 링크 복사에 실패했습니다. 지원하지 않는 환경입니다.');
          return;
        } finally {
          textArea.remove();
        }
      }
      setShowInviteToast(true);
      setTimeout(() => setShowInviteToast(false), 3000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('초대 링크를 복사하는데 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleDelete = (member: Member) => {
    if (window.confirm(`${member.name} 대원을 명단에서 삭제하시겠습니까?`)) {
      const savedExtra = localStorage.getItem('choir_extra_members');
      const extraMembers: Member[] = savedExtra ? JSON.parse(savedExtra) : [];
      const isExtra = extraMembers.some(m => m.id === member.id);

      if (isExtra) {
        const updatedExtra = extraMembers.filter(m => m.id !== member.id);
        localStorage.setItem('choir_extra_members', JSON.stringify(updatedExtra));
      } else {
        const savedDeleted = localStorage.getItem('choir_deleted_members');
        const deletedMembers: string[] = savedDeleted ? JSON.parse(savedDeleted) : [];
        if (!deletedMembers.includes(member.id)) {
          localStorage.setItem('choir_deleted_members', JSON.stringify([...deletedMembers, member.id]));
        }
      }
      setAllMembers(prev => prev.filter(m => m.id !== member.id));
    }
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    const savedRoles = localStorage.getItem('choir_member_roles');
    const memberRoles: Record<string, string> = savedRoles ? JSON.parse(savedRoles) : {};

    if (newRole) {
      memberRoles[memberId] = newRole;
    } else {
      delete memberRoles[memberId];
    }

    localStorage.setItem('choir_member_roles', JSON.stringify(memberRoles));

    setAllMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, role: newRole || undefined } : m
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">인원 관리</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleInvite}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            초대 링크 복사
          </button>
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
              placeholder="이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {showInviteToast && (
        <div className="fixed bottom-8 right-8 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">초대 링크가 클립보드에 복사되었습니다!</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px px-4" aria-label="Tabs">
            {parts.map((part) => (
              <button
                key={part}
                onClick={() => setActiveTab(part)}
                className={`
                  whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === part
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {part === 'All' ? '전체' : part}
                <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium ${activeTab === part ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {part === 'All' ? allMembers.length : allMembers.filter(m => m.part === part).length}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMembers.map((member) => (
              <div key={member.id} className="flex items-center p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow bg-gray-50/50">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <User className="h-5 w-5" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    {member.name}
                    {member.role && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {member.role === '지휘자' || member.role === '파트장' || member.role === '메인반주' || member.role === '게시판 관리자' || member.role.includes('관리자') ? '👑 ' : ''}{member.role}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{member.part}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="text-xs border-gray-300 rounded-lg text-gray-600 focus:ring-blue-500 focus:border-blue-500 bg-white px-2 py-1 shadow-sm"
                    value={member.role || ''}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  >
                    <option value="">권한 없음</option>
                    <option value="대장">대장</option>
                    <option value="지휘자">지휘자</option>
                    <option value="파트장">파트장</option>
                    <option value="메인반주">메인반주</option>
                    <option value="부반주">부반주</option>
                    <option value="게시판 관리자">게시판 관리자</option>
                    <option value="총무">총무</option>
                    <option value="서기">서기</option>
                  </select>
                  <button
                    onClick={() => handleDelete(member)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {filteredMembers.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
}
