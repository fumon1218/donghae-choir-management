import React, { useState, useEffect, FormEvent } from 'react';
import { X, Plus, Edit2, Trash2, MessagesSquare, ChevronUp, ChevronDown, Eye, EyeOff, Save, LayoutTemplate } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BoardCategory } from '../data';

interface BoardManagerProps {
    onClose: () => void;
}

export default function BoardManager({ onClose }: BoardManagerProps) {
    const [activeTab, setActiveTab] = useState<'boards' | 'menus'>('boards');
    const [categories, setCategories] = useState<BoardCategory[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Menu settings state
    const [menuConfig, setMenuConfig] = useState<Record<string, { label: string; visible: boolean }>>({});
    const baseMenuOptions = [
        { id: 'dashboard', defaultLabel: '대시보드' },
        { id: 'members', defaultLabel: '인원 관리' },
        { id: 'attendance', defaultLabel: '출석부' },
        { id: 'opening-hymns', defaultLabel: '시작찬송 관리' },
        { id: 'hymns', defaultLabel: '월별 찬송가' },
        { id: 'schedule', defaultLabel: '연습 스케줄' },
        { id: 'legacy-board', defaultLabel: '자유게시판 (구버전)' },
    ];

    // Form states
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'board_categories'), orderBy('order', 'asc'));
        const unsubscribeBoards = onSnapshot(q, (snapshot) => {
            const cats: BoardCategory[] = [];
            snapshot.forEach((doc) => {
                cats.push({ id: doc.id, ...doc.data() } as BoardCategory);
            });
            setCategories(cats);
        });

        const unsubscribeMenu = onSnapshot(doc(db, 'settings', 'menu_config'), (docSnap) => {
            if (docSnap.exists()) {
                setMenuConfig(docSnap.data() as Record<string, { label: string; visible: boolean }>);
            } else {
                setMenuConfig({});
            }
        });

        return () => {
            unsubscribeBoards();
            unsubscribeMenu();
        };
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
                order: categories.length > 0 ? categories[categories.length - 1].order + 1 : 0
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

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        if (categories.length < 2) return;
        const currentCat = categories[index];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        if (swapIndex < 0 || swapIndex >= categories.length) return;
        const swapCat = categories[swapIndex];

        // order 값을 교환
        const tempOrder = currentCat.order !== undefined ? currentCat.order : index;
        const swapOrder = swapCat.order !== undefined ? swapCat.order : swapIndex;

        try {
            const batch = writeBatch(db);
            const currentRef = doc(db, 'board_categories', currentCat.id);
            const swapRef = doc(db, 'board_categories', swapCat.id);

            batch.update(currentRef, { order: swapOrder });
            batch.update(swapRef, { order: tempOrder });

            await batch.commit();
        } catch (err) {
            console.error('Error reordering boards:', err);
            alert('순서 변경 중 오류가 발생했습니다.');
        }
    };

    const handleMenuChange = (id: string, field: 'label' | 'visible', value: string | boolean) => {
        setMenuConfig(prev => {
            const currentItem = prev[id] || {
                label: baseMenuOptions.find(o => o.id === id)?.defaultLabel || '',
                visible: true
            };
            return {
                ...prev,
                [id]: {
                    ...currentItem,
                    [field]: value
                }
            };
        });
    };

    const handleSaveMenuConfig = async () => {
        try {
            await setDoc(doc(db, 'settings', 'menu_config'), menuConfig);
            alert('기본 메뉴 설정이 성공적으로 저장되었습니다.');
        } catch (err) {
            console.error('Error saving menu config:', err);
            alert(`메뉴 설정 저장 중 오류가 발생했습니다: ${err.message || err}`);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full md:w-[700px] lg:w-[800px] overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex gap-6 items-center bg-gray-50/50 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('boards')}
                        className={`flex items-center gap-2 text-base font-bold transition-colors flex-shrink-0 ${activeTab === 'boards' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}
                    >
                        <MessagesSquare className="w-5 h-5" />
                        게시판 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('menus')}
                        className={`flex items-center gap-2 text-base font-bold transition-colors flex-shrink-0 ${activeTab === 'menus' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}
                    >
                        <LayoutTemplate className="w-5 h-5" />
                        고정 메뉴 설정
                    </button>
                    <button onClick={onClose} className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'boards' ? (
                        <>
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
                                        <div className="flex justify-end gap-2 pt-2 sm:pt-0">
                                            <button type="button" onClick={resetForm} className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
                                            <button type="submit" className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {categories.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl bg-gray-50">
                                        개설된 게시판이 없습니다.
                                    </div>
                                ) : (
                                    categories.map((cat, index) => (
                                        <div key={cat.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors bg-white shadow-sm">
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900">{cat.name}</h4>
                                                {cat.description && <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="flex flex-col mr-2 border-r border-gray-100 pr-2">
                                                    <button
                                                        onClick={() => handleMove(index, 'up')}
                                                        disabled={index === 0}
                                                        className={`p-0.5 rounded transition-colors ${index === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                    >
                                                        <ChevronUp className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleMove(index, 'down')}
                                                        disabled={index === categories.length - 1}
                                                        className={`p-0.5 rounded transition-colors ${index === categories.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                    >
                                                        <ChevronDown className="w-4 h-4" />
                                                    </button>
                                                </div>
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
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900">기본 메뉴 이름 및 숨김 설정</h3>
                                    <p className="text-sm text-gray-500 mt-1">대시보드, 출석부 등 고정된 메뉴들의 이름을 원하는 대로 바꾸거나 숨길 수 있습니다.</p>
                                </div>
                                <button
                                    onClick={handleSaveMenuConfig}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm text-sm whitespace-nowrap"
                                >
                                    <Save className="w-4 h-4" />
                                    설정 저장
                                </button>
                            </div>

                            <div className="space-y-3">
                                {baseMenuOptions.map(option => {
                                    const isVisible = menuConfig[option.id]?.visible !== false; // 기본값 true
                                    const currentLabel = menuConfig[option.id]?.label || option.defaultLabel;

                                    return (
                                        <div key={option.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-blue-200 transition-colors">
                                            <div className="flex-1 mr-4">
                                                <label className="block text-xs font-semibold text-gray-500 mb-1">
                                                    {option.defaultLabel} (고유 메뉴)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={currentLabel}
                                                    onChange={(e) => handleMenuChange(option.id, 'label', e.target.value)}
                                                    className={`w-full max-w-sm px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-colors ${!isVisible ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300 text-gray-900'}`}
                                                    placeholder={option.defaultLabel}
                                                    disabled={!isVisible}
                                                />
                                            </div>
                                            <div className="flex flex-col items-center justify-center min-w-[80px]">
                                                <button
                                                    onClick={() => handleMenuChange(option.id, 'visible', !isVisible)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isVisible ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                >
                                                    {isVisible ? (
                                                        <><Eye className="w-4 h-4" /> 표시 중</>
                                                    ) : (
                                                        <><EyeOff className="w-4 h-4" /> 숨김</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
