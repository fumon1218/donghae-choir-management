import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { members as initialMembers, Part, Member } from '../data';
import { Search, User, UserPlus, Copy, CheckCircle, Trash2, Clock, X, Check, Camera, Loader2, Plus } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Members() {
  const [activeTab, setActiveTab] = useState<Part | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [showInviteToast, setShowInviteToast] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
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

  // Load members and handle permissions
  useEffect(() => {
    const savedMembers = localStorage.getItem('choir_extra_members');
    const extraMembers: Member[] = savedMembers ? JSON.parse(savedMembers) : [];

    // Check for updated roles in local storage
    const savedRoles = localStorage.getItem('choir_member_roles');
    const memberRoles: Record<string, string> = savedRoles ? JSON.parse(savedRoles) : {};

    const savedImages = localStorage.getItem('choir_member_images');
    const memberImages: Record<string, string> = savedImages ? JSON.parse(savedImages) : {};

    const savedDeleted = localStorage.getItem('choir_deleted_members');
    const deletedMembers: string[] = savedDeleted ? JSON.parse(savedDeleted) : [];

    const combinedMembers = [...initialMembers, ...extraMembers].map(member => ({
      ...member,
      role: memberRoles[member.id] || member.role,
      imageUrl: memberImages[member.id] || member.imageUrl
    }));

    setAllMembers(combinedMembers.filter(m => !deletedMembers.includes(m.id)));
  }, []);

  // Admin (My Profile) logic - using a reserved ID "admin"
  const myProfileId = 'admin';
  const myProfile = allMembers.find(m => m.id === myProfileId) || {
    id: myProfileId,
    name: '지휘자 (나)',
    part: 'Orchestra' as Part,
    role: '지휘자'
  };

  const parts: (Part | 'All')[] = ['All', 'Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];

  const filteredMembers = allMembers.filter(member => {
    if (member.id === myProfileId) return false; // Hide my profile from the general list
    const matchesPart = activeTab === 'All' || member.part === activeTab;
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPart && matchesSearch;
  });

  const handleInvite = async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=true`;

    // 1. 모바일 기기의 기본 공유하기 (카카오톡, 문자 등) 시도
    if (navigator.share) {
      try {
        await navigator.share({
          title: '동해교회 찬양대 초대',
          text: '동해교회 찬양대 웹 앱에 초대합니다.',
          url: inviteUrl,
        });
        return; // 공유 성공 시 종료
      } catch (error) {
        console.log('공유 취소 또는 실패', error);
      }
    }

    // 2. 최신 클립보드 API 복사 시도
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setShowInviteToast(true);
        setTimeout(() => setShowInviteToast(false), 3000);
        return;
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }

    // 3. 최후의 수단: 구형 브라우저 및 인앱 브라우저 (카카오톡 등) 대비
    try {
      const textArea = document.createElement("textarea");
      textArea.value = inviteUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setShowInviteToast(true);
        setTimeout(() => setShowInviteToast(false), 3000);
      } else {
        setShowFallbackModal(true);
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
      setShowFallbackModal(true);
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

  const handleApprove = async (request: any) => {
    try {
      // 1. Update Firestore request status
      const requestRef = doc(db, 'join_requests', request.id);
      await updateDoc(requestRef, {
        status: 'approved'
      });

      // 2. Add to local members (in a real app this would also be synced to a members collection in Firestore)
      const newMember: Member = {
        id: `extra-${Date.now()}`,
        name: request.name,
        part: request.part,
      };

      const savedMembers = localStorage.getItem('choir_extra_members');
      const extraMembers = savedMembers ? JSON.parse(savedMembers) : [];
      localStorage.setItem('choir_extra_members', JSON.stringify([...extraMembers, newMember]));

      setAllMembers(prev => [...prev, newMember]);
      alert(`${request.name} 대원의 가입이 승인되었습니다.`);
    } catch (error) {
      console.error('Error approving request:', error);
      alert('승인 처리 중 오류가 발생했습니다.');
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

    // Update selectedMember if open
    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember(prev => prev ? { ...prev, role: newRole || undefined } : null);
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

    try {
      setIsUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);

      const VITE_IMGBB_API_KEY = typeof process !== 'undefined' && process.env && process.env.VITE_IMGBB_API_KEY ? process.env.VITE_IMGBB_API_KEY : (import.meta as any).env?.VITE_IMGBB_API_KEY || '';

      if (!VITE_IMGBB_API_KEY) {
        alert('ImgBB API 키가 설정되지 않았습니다. 환경변수를 확인해주세요.');
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

        // Save to local storage
        const savedImages = localStorage.getItem('choir_member_images');
        const memberImages: Record<string, string> = savedImages ? JSON.parse(savedImages) : {};
        memberImages[memberId] = imageUrl;
        localStorage.setItem('choir_member_images', JSON.stringify(memberImages));

        setAllMembers(prev => prev.map(m =>
          m.id === memberId ? { ...m, imageUrl } : m
        ));

        if (selectedMember && selectedMember.id === memberId) {
          setSelectedMember(prev => prev ? { ...prev, imageUrl } : null);
        }
      } else {
        alert('이미지 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUpdateMemberInfo = (memberId: string, field: keyof Member, value: string) => {
    // Basic local state update for name/part
    setAllMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, [field]: value } : m
    ));

    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember(prev => prev ? { ...prev, [field]: value } : null);
    }

    // Note: full persistence for name/part edits isn't completely implemented 
    // for initialMembers since they are static in data.ts, but works for extraMembers.
    // We update choir_extra_members if it's a new member.
    const savedExtra = localStorage.getItem('choir_extra_members');
    const extraMembers: Member[] = savedExtra ? JSON.parse(savedExtra) : [];
    const isExtra = extraMembers.some(m => m.id === memberId);
    if (isExtra) {
      const updatedExtra = extraMembers.map(m => m.id === memberId ? { ...m, [field]: value } : m);
      localStorage.setItem('choir_extra_members', JSON.stringify(updatedExtra));
    }
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
          <span className="text-sm font-medium">초대 링크가 복사되었습니다!</span>
        </div>
      )}

      {showFallbackModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-900">초대 링크 복사</h3>
                <button
                  onClick={() => setShowFallbackModal(false)}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                현재 브라우저 환경에서 자동 복사를 지원하지 않습니다. 아래 입력창의 <b>주소를 길게 눌러 직접 복사</b>해 주세요.
              </p>
              <input
                type="text"
                readOnly
                value={`${window.location.origin}${window.location.pathname}?invite=true`}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowFallbackModal(false)}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {joinRequests.length > 0 && (
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
              <div
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className="flex flex-col sm:flex-row sm:items-center p-4 border border-gray-100 rounded-xl hover:shadow-md transition-shadow bg-gray-50/50 cursor-pointer gap-4 group"
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
            {filteredMembers.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
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
                    <option value="파트장">파트장 👑</option>
                    <option value="메인반주">메인반주 👑</option>
                    <option value="부반주">부반주</option>
                    <option value="게시판 관리자">게시판 관리자 👑</option>
                    <option value="총무">총무</option>
                    <option value="서기">서기</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
