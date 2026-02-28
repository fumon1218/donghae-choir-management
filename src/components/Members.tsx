import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { Part, Member } from '../data';
import { Search, User, UserPlus, Copy, CheckCircle, Trash2, Clock, X, Check, Camera, Loader2, Plus, Smartphone, Monitor } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MembersProps {
  userRole: string | null;
  userData?: any;
}

export default function Members({ userRole, userData }: MembersProps) {
  const isAdmin = userRole === '대장' || userRole === '지휘자';
  const [activeTab, setActiveTab] = useState<Part | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Load join requests from Firestore
  useEffect(() => {
    const q = query(collection(db, 'join_requests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setJoinRequests(requests);
    });

    return () => unsubscribe();
  }, []);

  // Load members from Firestore (Real-time sync)
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memberList: Member[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // 대기권한 회원은 신청 목록에서 처리하므로 일반 명단에서는 제외 (검색 및 관리를 위해)
        if (data.role === '대기권한') return;

        memberList.push({
          id: doc.id,
          name: data.name || '',
          part: data.part || 'Orchestra',
          role: data.role || '일반대원',
          imageUrl: data.imageUrl
        } as Member);
      });
      setAllMembers(memberList);
    });

    return () => unsubscribe();
  }, []);

  // Admin (My Profile) logic - using a reserved ID "admin" or UID
  const myProfileId = userData?.uid || 'admin';
  const myProfile = allMembers.find(m => m.id === myProfileId) || {
    id: myProfileId,
    name: userData?.displayName || userData?.name || '지휘자 (나)',
    part: userData?.part || ('Orchestra' as Part),
    role: userRole || '지휘자',
    imageUrl: userData?.photoURL || userData?.imageUrl || null
  };

  const parts: (Part | 'All')[] = ['All', 'Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];

  const filteredMembers = allMembers.filter(member => {
    if (member.id === myProfileId) return false; // Hide my profile from the general list
    const matchesPart = activeTab === 'All' || member.part === activeTab;
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPart && matchesSearch;
  });


  const handleDelete = async (member: Member) => {
    if (window.confirm(`${member.name} 대원을 명단에서 완전히 삭제하시겠습니까?\n(데이터베이스에서 해당 계정 정보가 제거됩니다.)`)) {
      try {
        await deleteDoc(doc(db, 'users', member.id));
        alert(`${member.name} 대원이 삭제되었습니다.`);
      } catch (error) {
        console.error('Error deleting member:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleApprove = async (request: any) => {
    try {
      // 1. Update Firestore users collection to grant actual access
      if (request.uid) {
        await setDoc(doc(db, 'users', request.uid), {
          role: '일반대원',
          part: request.part,
          name: request.name,
          email: request.email || '',
          imageUrl: request.imageUrl || '',
          approvedAt: Date.now()
        }, { merge: true });
      }

      // 2. Update Firestore request status to mark as processed
      await updateDoc(doc(db, 'join_requests', request.id), {
        status: 'approved'
      });

      alert(`${request.name} 대원의 가입이 승인되었습니다.`);
    } catch (error: any) {
      console.error('Error approving request:', error);
      alert(`승인 처리 중 오류가 발생했습니다.\n${error.message || error}`);
    }
  };

  const handleReject = async (requestId: string) => {
    if (window.confirm('이 가입 신청을 거절하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'join_requests', requestId));
        alert('가입 신청이 거절되었습니다.');
      } catch (error) {
        console.error('Error rejecting request:', error);
        alert('처리 중 오류가 발생했습니다.');
      }
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', memberId), {
        role: newRole
      });
      // 실시간 Snapshot이 처리해주므로 로컬 state 업데이트는 기다리지 않아도 됨
    } catch (error) {
      console.error('Error updating role:', error);
      alert('역할 변경 중 오류가 발생했습니다.');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (memberId: string, e: ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      // ImgBB API Key from env
      const VITE_IMGBB_API_KEY = (import.meta as any).env?.VITE_IMGBB_API_KEY || '';

      if (!VITE_IMGBB_API_KEY) {
        alert('이미지 서버 설정(API Key)이 누락되었습니다.');
        setIsUploadingImage(false);
        return;
      }

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${VITE_IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const imageUrl = data.data.url;
        const userRef = doc(db, 'users', memberId);
        await updateDoc(userRef, {
          imageUrl: imageUrl
        });
      } else {
        throw new Error(data.error?.message || '업로드 실패');
      }
    } catch (error: any) {
      console.error('Image upload failed:', error);
      alert(`이미지 저장 중 오류가 발생했습니다: ${error.message || error}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUpdateMemberInfo = async (memberId: string, field: keyof Member, value: string) => {
    try {
      const userRef = doc(db, 'users', memberId);
      const updateData: any = { [field]: value };

      if (field === 'name') {
        updateData.displayName = value;
      }

      await updateDoc(userRef, updateData);

      setAllMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, [field]: value } : m
      ));

      if (selectedMember && selectedMember.id === memberId) {
        setSelectedMember(prev => prev ? { ...prev, [field]: value } : null);
      }
    } catch (error) {
      console.error('Failed to update member info:', error);
      alert('변경 사항을 저장하는 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">인원 관리</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsMobileView(!isMobileView)}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            title={isMobileView ? "PC 화면으로 보기" : "모바일 화면으로 보기"}
          >
            {isMobileView ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
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


      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isAdmin && joinRequests.length > 0 && (
          <div className="bg-blue-50/50 border-b border-blue-100 p-4">
            <h2 className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-600" />
              가입 대기자 ({joinRequests.length}명)
            </h2>
            <div className="space-y-2">
              {joinRequests.map(request => (
                <div key={request.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                      {request.part.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{request.name}</p>
                      <p className="text-xs text-gray-500">{request.part} 파트</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(request.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="거절"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleApprove(request)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      승인
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="p-4 border-b border-gray-100 bg-gray-50/30">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">내 프로필</h2>
            <div
              onClick={() => setSelectedMember(myProfile)}
              className="flex flex-col sm:flex-row sm:items-center p-4 border border-blue-100 rounded-xl hover:shadow-md transition-shadow bg-blue-50/30 cursor-pointer gap-4 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <div className="flex items-center gap-4 flex-1">
                <div className="relative">
                  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 overflow-hidden shadow-sm border-2 border-white">
                    {myProfile.imageUrl ? (
                      <img src={myProfile.imageUrl} alt={myProfile.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6" />
                    )}
                  </div>
                  {myProfile.role && (myProfile.role === '지휘자' || myProfile.role === '대장' || myProfile.role.includes('관리자')) && (
                    <span className="absolute -top-1 -right-1 text-base drop-shadow-sm">👑</span>
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-gray-900 truncate">
                      {myProfile.name}
                    </span>
                    {myProfile.role && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 whitespace-nowrap shadow-sm border border-blue-200">
                        {myProfile.role}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{myProfile.part}</div>
                </div>
              </div>
            </div>
          </div>
        )}

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
          {isMobileView ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  onClick={() => isAdmin && setSelectedMember(member)}
                  className={`flex flex-col sm:flex-row sm:items-center p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow bg-gray-50/50 gap-4 group ${isAdmin ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 overflow-hidden">
                        {member.imageUrl ? (
                          <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </div>
                      {member.role && (member.role === '지휘자' || member.role === '파트장' || member.role === '메인반주' || member.role === '게시판 관리자' || member.role.includes('관리자')) && (
                        <span className="absolute -top-1 -right-1 text-sm drop-shadow-sm">👑</span>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {member.name}
                        </span>
                        {member.role && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 whitespace-nowrap">
                            {member.role}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{member.part}</div>
                    </div>
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
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">사진</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">이름</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">파트</th>
                      <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">직분</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMembers.map((member) => (
                      <tr
                        key={member.id}
                        onClick={() => isAdmin && setSelectedMember(member)}
                        className={`hover:bg-gray-50 transition-colors ${isAdmin ? 'cursor-pointer' : ''}`}
                      >
                        <td className="p-4">
                          <div className="relative inline-block">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 overflow-hidden">
                              {member.imageUrl ? (
                                <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-5 w-5" />
                              )}
                            </div>
                            {member.role && (member.role === '지휘자' || member.role === '파트장' || member.role === '메인반주' || member.role === '게시판 관리자' || member.role.includes('관리자')) && (
                              <span className="absolute -top-1 -right-1 text-sm drop-shadow-sm">👑</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-900">{member.name}</td>
                        <td className="p-4 text-sm text-gray-500">{member.part}</td>
                        <td className="p-4">
                          {member.role && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {member.role}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {filteredMembers.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </div>

      {selectedMember && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 relative">
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedMember(null);
                  handleDelete(selectedMember);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-rose-500 hover:bg-rose-50 hover:text-rose-600 backdrop-blur shadow-sm transition-colors"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedMember(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-gray-500 hover:bg-gray-100 backdrop-blur shadow-sm transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative h-32 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-end justify-center pb-6">
              <div className="absolute -bottom-12 relative group">
                <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-lg overflow-hidden flex items-center justify-center relative">
                  {selectedMember.imageUrl ? (
                    <img src={selectedMember.imageUrl} alt={selectedMember.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <User className="h-10 w-10" />
                    </div>
                  )}
                  {selectedMember.role && (selectedMember.role === '지휘자' || selectedMember.role === '파트장' || selectedMember.role === '메인반주' || selectedMember.role === '게시판 관리자' || selectedMember.role.includes('관리자')) && (
                    <span className="absolute top-0 right-0 text-xl drop-shadow">👑</span>
                  )}
                  <div
                    className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center cursor-pointer transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploadingImage ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(selectedMember.id, e)}
                />
              </div>
            </div>

            <div className="pt-16 px-6 pb-6 text-center">
              <input
                type="text"
                value={selectedMember.name}
                onChange={(e) => handleUpdateMemberInfo(selectedMember.id, 'name', e.target.value)}
                className="text-xl font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none text-center transition-colors w-32"
              />
              <p className="text-sm text-gray-500 mt-1">{selectedMember.part} 파트</p>

              <div className="mt-6 pt-6 border-t border-gray-100 space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    파트 변경
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {parts.filter(p => p !== 'All').map((p) => (
                      <button
                        key={p}
                        onClick={() => handleUpdateMemberInfo(selectedMember.id, 'part', p)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${selectedMember.part === p
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    직분 (권한) 설정
                  </label>
                  <select
                    className="w-full text-sm border-gray-300 rounded-xl text-gray-700 focus:ring-blue-500 focus:border-blue-500 bg-white px-3 py-2.5 shadow-sm border"
                    value={selectedMember.role || ''}
                    onChange={(e) => handleRoleChange(selectedMember.id, e.target.value)}
                  >
                    <option value="">권한 없음 (일반 대원)</option>
                    <option value="대장">대장 👑</option>
                    <option value="지휘자">지휘자 👑</option>
                    <option value="파트장">파트장</option>
                    <option value="메인반주">메인반주</option>
                    <option value="부반주">부반주</option>
                    <option value="게시판 관리자">게시판 관리자 (전체)</option>
                    <option value="자유게시판 관리자">자유게시판 관리자 ✨</option>
                    <option value="시작찬송 관리자">시작찬송 관리자 ✨</option>
                    <option value="총무">총무</option>
                    <option value="서기">서기</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
}
