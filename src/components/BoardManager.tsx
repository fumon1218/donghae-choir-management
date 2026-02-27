import React, { useState, useEffect, FormEvent } from 'react';
import { X, Plus, Edit2, Trash2, MessagesSquare } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BoardCategory } from '../data';

interface BoardManagerProps {
    onClose: () => void;
}

export default function BoardManager({ onClose }: BoardManagerProps) {
    const [categories, setCategories] = useState<BoardCategory[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'board_categories'), orderBy('order', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cats: BoardCategory[] = [];
            snapshot.forEach((doc) => {
                cats.push({ id: doc.id, ...doc.data() } as BoardCategory);
            });
            setCategories(cats);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setName('');
        setDescription('');
        setIsAdding(false);
        setEditingId(null);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            await addDoc(collection(db, 'board_categories'), {
                name: name.trim(),
                description: description.trim(),
                order: categories.length // place at the end
            });
            resetForm();
        } catch (err) {
            console.error('Error creating board:', err);
            alert('게시판 생성 중 오류가 발생했습니다.');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId || !name.trim()) return;

        try {
            await updateDoc(doc(db, 'board_categories', editingId), {
                name: name.trim(),
                description: description.trim()
            });
            resetForm();
        } catch (err) {
            console.error('Error updating board:', err);
            alert('게시판 수정 중 오류가 발생했습니다.');
        }
    };

    const handleDelete = async (id: string, boardName: string) => {
        if (window.confirm(`'${boardName}' 게시판을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 내부의 모든 게시글도 함께 표기되지 않습니다.`)) {
            try {
                await deleteDoc(doc(db, 'board_categories', id));
            } catch (err) {
                console.error('Error deleting board:', err);
                alert('게시판 삭제 중 오류가 발생했습니다.');
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-2 text-gray-900">
                        <MessagesSquare className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold">게시판 관리</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Add/Edit Form */}
                    {(isAdding || editingId) && (
                        <form onSubmit={editingId ? handleUpdate : handleCreate} className="mb-8 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                            <h3 className="text-sm font-bold text-blue-900 mb-3">{editingId ? '게시판 수정' : '새 게시판 추가'}</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">게시판 이름</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder="예: 기도제목 나눔"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">설명 (선택)</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder="이 게시판의 목적을 짧게 적어주세요"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                                    <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">
                                        {editingId ? '수정 완료' : '추가하기'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* List header */}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-semibold text-gray-900">현재 게시판 목록</h3>
                        {!isAdding && !editingId && (
                            <button
                                onClick={() => setIsAdding(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                게시판 추가
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        {categories.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl bg-gray-50">
                                개설된 게시판이 없습니다.
                            </div>
                        ) : (
                            categories.map((cat) => (
                                <div key={cat.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors bg-white shadow-sm">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900">{cat.name}</h4>
                                        {cat.description && <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingId(cat.id);
                                                setName(cat.name);
                                                setDescription(cat.description || '');
                                                setIsAdding(false);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id, cat.name)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
