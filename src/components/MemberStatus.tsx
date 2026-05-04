import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Member } from '../data';
import { Users, Search, Edit2, X, Camera, Save, Loader2 } from 'lucide-react';

interface MemberStatusProps {
    userData: any;
    userRole: string | null;
}

export default function MemberStatus({ userData, userRole }: MemberStatusProps) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editName, setEditName] = useState('');
    const [editImageUrl, setEditImageUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const memberList: Member[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.role === '대기권한') return;

                memberList.push({
                    id: doc.id,
                    name: data.name || data.displayName || '이름 없음',
                    part: data.part || 'Orchestra',
                    role: data.role || '일반대원',
                    imageUrl: data.imageUrl || data.photoURL
                } as Member);
            });
            // Sort by part then name
            const partOrder = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Orchestra'];
            memberList.sort((a, b) => {
                const partA = partOrder.indexOf(a.part as string);
                const partB = partOrder.indexOf(b.part as string);
                if (partA !== partB) return partA - partB;
                return a.name.localeCompare(b.name);
            });
            setMembers(memberList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching members:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) {
                alert('이미지 크기가 너무 큽니다 (1MB 이하만 가능)');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData?.uid || isSaving) return;

        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'users', userData.uid), {
                name: editName,
                imageUrl: editImageUrl
            });
            setIsEditingProfile(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            alert('프로필 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.part?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                        <Users className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">인원 현황</h1>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="이름, 파트, 직분 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full md:w-64 transition-all shadow-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredMembers.map((member) => (
                        <div
                            key={member.id}
                            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group relative"
                        >
                            <div
                                className={`w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold overflow-hidden shrink-0 border-2 ${member.id === userData?.uid ? 'border-blue-400 animate-pulse-subtle cursor-pointer' : 'border-gray-50'}`}
                                onClick={() => {
                                    if (member.id === userData?.uid) {
                                        setEditName(userData.name || '');
                                        setEditImageUrl(userData.imageUrl || '');
                                        setIsEditingProfile(true);
                                    }
                                }}
                            >
                                {member.imageUrl ? (
                                    <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                                ) : (
                                    member.name.charAt(0)
                                )}
                                {member.id === userData?.uid && (
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-gray-900 truncate">{member.name}</h3>
                                    {member.id === userData?.uid && (
                                        <span className="px-1.5 py-0.5 bg-blue-50 text-[10px] font-bold text-blue-600 rounded">나</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs font-medium px-2 py-0.5 bg-gray-50 text-gray-600 rounded-full border border-gray-100">
                                        {member.part}
                                    </span>
                                    <span className="text-xs font-medium text-gray-400">
                                        {member.role || '일반대원'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Profile Edit Modal */}
            {isEditingProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !isSaving && setIsEditingProfile(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">내 프로필 수정</h2>
                            <button
                                onClick={() => !isSaving && setIsEditingProfile(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                disabled={isSaving}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-gray-400 text-2xl font-black">
                                        {editImageUrl ? (
                                            <img src={editImageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            editName.charAt(0) || '?'
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center text-white cursor-pointer hover:bg-blue-700 shadow-sm transition-all transform hover:scale-110 active:scale-95 overflow-hidden">
                                        <Camera className="w-4 h-4" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={isSaving}
                                        />
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium">권장: 1MB 이하의 고화질 정방형 이미지</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">이름</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-medium text-gray-900"
                                        placeholder="표시할 이름을 입력하세요"
                                        maxLength={20}
                                        required
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingProfile(false)}
                                    className="flex-1 px-6 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                                    disabled={isSaving}
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-[2] px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    저장하기
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
