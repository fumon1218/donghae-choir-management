import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { MessageSquare, Send, Image as ImageIcon, Youtube, Trash2, User, Clock, ExternalLink, X, Edit2, MessageCircle, Smile, ImagePlus } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, where, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BoardPost, BoardCategory, Comment } from '../data';

interface Post {
  id: string;
  author: string;
  content: string;
  imageUrl?: string;
  youtubeUrl?: string;
  createdAt: number;
}

interface BoardProps {
  boardId?: string;
  userRole?: string | null;
  userData?: any;
}

export default function Board({ boardId = 'default', userRole, userData }: BoardProps) {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [boardName, setBoardName] = useState('게시판');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit states
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Comment states
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // postId of the post showing picker
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const EMOJI_LIST = ['😀', '😂', '🥰', '😍', '😎', '🤔', '👍', '👏', '🙏', '🎉', '❤️', '🔥', '✨', '💯', '✅', '👌', '🙌', '💪'];

  const isAdmin = userRole === '대장' || userRole === '지휘자' || userRole?.includes('관리자');

  useEffect(() => {
    // Fetch generic board name
    const fetchBoardInfo = async () => {
      if (boardId === 'default') {
        setBoardName('자유게시판');
        return;
      }
      try {
        const boardDoc = await getDoc(doc(db, 'board_categories', boardId));
        if (boardDoc.exists()) {
          setBoardName(boardDoc.data().name);
        }
      } catch (err) {
        console.error('Failed to fetch board category:', err);
      }
    };
    fetchBoardInfo();

    const q = query(
      collection(db, 'board_posts'),
      where('boardId', '==', boardId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPosts: BoardPost[] = [];
      snapshot.forEach((doc) => {
        newPosts.push({ id: doc.id, ...doc.data() } as BoardPost);
      });
      // Sort newest first
      newPosts.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(newPosts);

      // 만약 현재 보고 있는 글이 삭제되었다면 목록으로 돌아가기
      if (selectedPostId && !newPosts.some(p => p.id === selectedPostId)) {
        setSelectedPostId(null);
      }
    }, (error) => {
      console.error('Error fetching board posts:', error);
      alert(`게시판 데이터를 불러오지 못했습니다: ${error.message}`);
    });

    return () => unsubscribe();
  }, [boardId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      const newPost: any = {
        boardId,
        author: userData?.name || '익명',
        authorUid: userData?.uid || 'unknown',
        content,
        createdAt: Date.now(),
      };

      if (imageUrl.trim()) {
        newPost.imageUrl = imageUrl.trim();
      }
      if (youtubeUrl.trim()) {
        newPost.youtubeUrl = youtubeUrl.trim();
      }

      await addDoc(collection(db, 'board_posts'), newPost);

      // Reset form
      setContent('');
      setImageUrl('');
      setYoutubeUrl('');
      setShowForm(false);
    } catch (error: any) {
      console.error('Error adding post:', error);
      alert(`게시글을 작성하는 중 오류가 발생했습니다: ${error.message || error}`);
    }
  };

  const handleDelete = async (postId: string) => {
    if (window.confirm('정말 이 게시글을 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'board_posts', postId));
        if (selectedPostId === postId) {
          setSelectedPostId(null);
        }
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('게시글을 삭제하는 중 오류가 발생했습니다.');
      }
    }
  };

  const startEditing = (post: BoardPost) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditImageUrl(post.imageUrl || '');
    setEditYoutubeUrl(post.youtubeUrl || '');
  };

  const cancelEditing = () => {
    setEditingPostId(null);
    setEditContent('');
    setEditImageUrl('');
    setEditYoutubeUrl('');
  };

  const handleUpdate = async (e: FormEvent, postId: string) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    try {
      await updateDoc(doc(db, 'board_posts', postId), {
        content: editContent,
        imageUrl: editImageUrl.trim() || null,
        youtubeUrl: editYoutubeUrl.trim() || null,
      });
      cancelEditing();
    } catch (error) {
      console.error('Error updating post:', error);
      alert('게시글을 수정하는 중 오류가 발생했습니다.');
    }
  };

  const handleAddComment = async (postId: string, e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim() && !commentImageUrl) return;

    try {
      const newComment: Comment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        author: userData?.name || '익명',
        authorUid: userData?.uid || 'unknown',
        content: commentText.trim(),
        createdAt: Date.now(),
      };

      if (commentImageUrl) {
        newComment.imageUrl = commentImageUrl;
      }

      await updateDoc(doc(db, 'board_posts', postId), {
        comments: arrayUnion(newComment)
      });

      setCommentText('');
      setCommentImageUrl('');
      setCommentingPostId(null);
      setShowEmojiPicker(null);
    } catch (error: any) {
      console.error('Error adding comment:', error);
      alert(`댓글을 작성하는 중 오류가 발생했습니다: ${error.message || error}`);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setCommentText(prev => prev + emoji);
  };

  const handleCommentImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const cancelComment = () => {
    setCommentingPostId(null);
    setCommentText('');
    setCommentImageUrl('');
    setShowEmojiPicker(null);
  };

  const handleDeleteComment = async (postId: string, comment: Comment) => {
    if (window.confirm('댓글을 삭제하시겠습니까?')) {
      try {
        await updateDoc(doc(db, 'board_posts', postId), {
          comments: arrayRemove(comment)
        });
      } catch (error) {
        console.error('Error deleting comment:', error);
        alert('댓글을 삭제하는 중 오류가 발생했습니다.');
      }
    }
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return null;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatDateShort = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${String(date.getFullYear()).slice(2)}.${date.getMonth() + 1}.${date.getDate()}`;
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, isEditing = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEditing) {
          setEditImageUrl(reader.result as string);
        } else {
          setImageUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{boardName}</h1>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) setSelectedPostId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${showForm ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {showForm ? '취소' : '글쓰기'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="나누고 싶은 이야기를 적어주세요..."
                className="w-full min-h-[100px] sm:min-h-[120px] p-3 sm:p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase ml-1">
                  <ImageIcon className="w-3 h-3" />
                  이미지 첨부
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrl.startsWith('data:') ? '이미지 파일 선택됨' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="이미지 URL 주소"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    disabled={imageUrl.startsWith('data:')}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                  >
                    파일 선택
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleImageUpload(e, false)}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                {imageUrl && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 mt-2">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-0 right-0 bg-black/50 text-white p-1 hover:bg-black/70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase ml-1">
                  <Youtube className="w-3 h-3" />
                  유튜브 링크
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
              >
                <Send className="w-4 h-4" />
                게시하기
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {posts.length > 0 ? (
          selectedPostId ? (
            // 상세 보기 모드
            posts.filter(p => p.id === selectedPostId).map((post) => (
              <div key={post.id} className="space-y-4 animate-in fade-in duration-300">
                <div className="flex justify-start mb-2">
                  <button
                    onClick={() => setSelectedPostId(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    목록으로
                  </button>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 sm:p-6">
                    <div className="flex justify-between items-start mb-4 sm:mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-gray-900 truncate">{post.author}</h3>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formatDate(post.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {post.authorUid === userData?.uid && (
                          <button
                            onClick={() => startEditing(post)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(post.authorUid === userData?.uid || isAdmin) && (
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {editingPostId === post.id ? (
                      <form onSubmit={(e) => handleUpdate(e, post.id)} className="space-y-4 bg-gray-50 p-4 border border-gray-200 rounded-xl">
                        <div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full min-h-[150px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase ml-1">
                              <ImageIcon className="w-3 h-3" />
                              이미지 첨부
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editImageUrl.startsWith('data:') ? '이미지 파일 선택됨' : editImageUrl}
                                onChange={(e) => setEditImageUrl(e.target.value)}
                                placeholder="이미지 URL 주소"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                disabled={editImageUrl.startsWith('data:')}
                              />
                              <button
                                type="button"
                                onClick={() => editFileInputRef.current?.click()}
                                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50"
                              >
                                파일 선택
                              </button>
                              <input
                                type="file"
                                ref={editFileInputRef}
                                onChange={(e) => handleImageUpload(e, true)}
                                accept="image/*"
                                className="hidden"
                              />
                            </div>
                            {editImageUrl && (
                              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 mt-2 shadow-sm">
                                <img src={editImageUrl} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setEditImageUrl('')}
                                  className="absolute top-0 right-0 bg-black/50 text-white p-1 hover:bg-black/70"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase ml-1">
                              <Youtube className="w-3 h-3" />
                              유튜브 링크
                            </label>
                            <input
                              type="text"
                              value={editYoutubeUrl}
                              onChange={(e) => setEditYoutubeUrl(e.target.value)}
                              placeholder="https://www.youtube.com/watch?v=..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50"
                          >
                            취소
                          </button>
                          <button
                            type="submit"
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm text-sm"
                          >
                            수정 완료
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="text-gray-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap mb-6 font-normal">
                          {post.content}
                        </div>

                        {post.imageUrl && (
                          <div className="mb-6 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                            <img src={post.imageUrl} alt="Post content" className="w-full max-h-[600px] object-contain bg-gray-50/50" />
                          </div>
                        )}

                        {post.youtubeUrl && (
                          <div className="mb-6">
                            {getYoutubeEmbedUrl(post.youtubeUrl) ? (
                              <div className="aspect-video rounded-2xl overflow-hidden border border-gray-100 shadow-lg">
                                <iframe
                                  src={getYoutubeEmbedUrl(post.youtubeUrl)!}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                ></iframe>
                              </div>
                            ) : (
                              <a
                                href={post.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl text-sm font-medium border border-red-100 hover:bg-red-100 transition-colors shadow-sm"
                              >
                                <Youtube className="w-5 h-5" />
                                유튜브 링크 열기
                                <ExternalLink className="w-4 h-4 ml-auto" />
                              </a>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {!editingPostId && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                        {post.comments && post.comments.length > 0 && (
                          <div className="space-y-4 mb-6">
                            {post.comments.map(comment => (
                              <div key={comment.id} className="flex gap-3 text-sm group">
                                <div className="font-bold text-gray-900 whitespace-nowrap pt-0.5">{comment.author}</div>
                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                  {comment.content && <div className="text-gray-700 break-words leading-relaxed">{comment.content}</div>}
                                  {comment.imageUrl && (
                                    <div className="mt-1 rounded-xl overflow-hidden border border-gray-100 max-w-sm shadow-sm">
                                      <img src={comment.imageUrl} alt="Comment attachment" className="w-full max-h-64 object-contain bg-gray-50" />
                                    </div>
                                  )}
                                  <div className="text-gray-400 text-[10px] sm:text-xs mt-0.5 sm:hidden">{formatDate(comment.createdAt)}</div>
                                </div>
                                <div className="text-gray-400 text-xs whitespace-nowrap hidden sm:block pt-0.5">{formatDate(comment.createdAt)}</div>
                                {(comment.authorUid === userData?.uid || isAdmin) && (
                                  <button
                                    onClick={() => handleDeleteComment(post.id, comment)}
                                    className="text-gray-300 hover:text-rose-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="댓글 삭제"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {commentingPostId === post.id ? (
                          <div className="mt-4 relative animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <form onSubmit={(e) => handleAddComment(post.id, e)} className="flex flex-col gap-3">
                              {/* Image Preview */}
                              {commentImageUrl && (
                                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 shadow-md">
                                  <img src={commentImageUrl} alt="Comment Preview" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setCommentImageUrl('')}
                                    className="absolute top-0 right-0 bg-black/50 text-white p-1.5 hover:bg-black/70 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              <div className="flex gap-2 items-end">
                                {showEmojiPicker === post.id && (
                                  <div className="absolute bottom-[100%] left-0 mb-3 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 grid grid-cols-6 gap-2 z-10 animate-in fade-in zoom-in-95 duration-200">
                                    {EMOJI_LIST.map(emoji => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleEmojiClick(emoji)}
                                        className="text-2xl hover:bg-blue-50 p-2 rounded-xl transition-all flex items-center justify-center"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                    <div className="col-span-6 flex justify-end mt-2 pt-2 border-t border-gray-100">
                                      <button
                                        type="button"
                                        onClick={() => setShowEmojiPicker(null)}
                                        className="text-xs text-gray-500 font-bold hover:text-blue-600 px-2 py-1 transition-colors"
                                      >
                                        닫기
                                      </button>
                                    </div>
                                  </div>
                                )}

                                <div className="flex-1 flex bg-gray-50 border border-gray-200 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all shadow-inner">
                                  <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(prev => prev === post.id ? null : post.id)}
                                    className="px-3 py-3 text-gray-400 hover:text-blue-500 transition-colors shrink-0"
                                    title="이모지 선택"
                                  >
                                    <Smile className="w-5 h-5 sm:w-6 sm:h-6" />
                                  </button>
                                  <input
                                    type="text"
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="댓글 내용을 입력해 주세요..."
                                    className="flex-1 py-3 text-sm sm:text-base focus:outline-none bg-transparent min-w-0"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => commentFileInputRef.current?.click()}
                                    className="px-3 py-3 text-gray-400 hover:text-emerald-500 transition-colors border-l border-gray-200 shrink-0"
                                    title="사진 첨부"
                                  >
                                    <ImagePlus className="w-5 h-5 sm:w-6 sm:h-6" />
                                  </button>
                                  <input
                                    type="file"
                                    ref={commentFileInputRef}
                                    onChange={handleCommentImageUpload}
                                    accept="image/*"
                                    className="hidden"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={cancelComment}
                                  className="px-3 py-3 text-gray-500 hover:text-gray-800 text-sm font-bold whitespace-nowrap"
                                >
                                  취소
                                </button>
                                <button
                                  type="submit"
                                  disabled={!commentText.trim() && !commentImageUrl}
                                  className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  <Send className="w-4 h-4" />
                                  등록
                                </button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCommentingPostId(post.id)}
                            className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-all bg-blue-50 px-4 py-2.5 rounded-xl border border-blue-100 shadow-sm"
                          >
                            <MessageCircle className="w-4 h-4" />
                            댓글 작성 {post.comments?.length ? `(${post.comments.length})` : ''}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            // 목록 보기 모드 (테이블)
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-16 text-center">번호</th>
                      <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">제목</th>
                      <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-24 text-center">글쓴이</th>
                      <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-28 text-center">작성일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {posts.map((post, index) => {
                      const title = post.content.split('\n')[0].slice(0, 40) + (post.content.split('\n')[0].length > 40 ? '...' : '');
                      const hasAttachments = post.imageUrl || post.youtubeUrl;

                      return (
                        <tr
                          key={post.id}
                          onClick={() => setSelectedPostId(post.id)}
                          className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                        >
                          <td className="px-4 py-4 text-sm text-gray-400 text-center font-medium">
                            {posts.length - index}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm sm:text-base font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                                {title}
                              </span>
                              {hasAttachments && (
                                <div className="flex gap-1 shrink-0">
                                  {post.imageUrl && <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />}
                                  {post.youtubeUrl && <Youtube className="w-3.5 h-3.5 text-rose-500" />}
                                </div>
                              )}
                              {post.comments && post.comments.length > 0 && (
                                <span className="text-[10px] sm:text-xs font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md">
                                  {post.comments.length}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 text-center font-medium whitespace-nowrap">
                            {post.author}
                          </td>
                          <td className="px-4 py-4 text-[10px] sm:text-xs text-gray-400 text-center font-medium whitespace-nowrap">
                            {formatDateShort(post.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mx-auto mb-4">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">게시글이 없습니다</h3>
            <p className="text-sm text-gray-500 mt-1">첫 번째 이야기를 들려주세요!</p>
          </div>
        )}
      </div>
    </div>
  );
}
