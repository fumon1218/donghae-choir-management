// 월별 찬송가 편집용: 찬송가/은혜찬송가에서 번호나 제목으로 곡을 찾아 고릅니다.
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { getBooks, getIndex, type HymnEntry } from '../lib/hymnData';

const PICK_BOOKS = ['hymn', 'grace'];
const LABEL: Record<string, string> = { hymn: '찬송가', grace: '은혜찬송' };

export default function HymnPicker({ initialBook, onPick, onClose }: {
  initialBook?: string;
  onPick: (book: string, entry: HymnEntry) => void;
  onClose: () => void;
}) {
  const [book, setBook] = useState(initialBook && PICK_BOOKS.includes(initialBook) ? initialBook : 'hymn');
  const [lists, setLists] = useState<Record<string, HymnEntry[]>>({});
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    getBooks()
      .then(bs => Promise.all(PICK_BOOKS.filter(id => bs.some(b => b.id === id)).map(async id => [id, await getIndex(id)] as const)))
      .then(rows => { if (live) setLists(Object.fromEntries(rows)); })
      .catch(e => { if (live) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);

  const list = lists[book];
  const shown = useMemo(() => {
    if (!list) return [];
    const t = q.trim().replace(/장$/, '');
    if (!t) return list.slice(0, 60);
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      return list.filter(h => h.n === n || String(h.n).startsWith(t)).slice(0, 60);
    }
    const low = t.toLowerCase();
    return list.filter(h => h.title.toLowerCase().includes(low)).slice(0, 60);
  }, [list, q]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center" role="dialog" aria-label="찬송가 찾기" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">찬송가 찾기</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="닫기"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3 space-y-2 border-b border-gray-100">
          <div className="flex gap-2">
            {PICK_BOOKS.map(id => (
              <button key={id} onClick={() => setBook(id)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${book === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                {LABEL[id]}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} inputMode="search"
              placeholder="번호 또는 제목 (예: 305, 주 하나님)"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>
        <div className="overflow-auto flex-1">
          {err && <p className="p-4 text-sm text-rose-600">{err}</p>}
          {!list && !err && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}
          {list && shown.length === 0 && <p className="p-6 text-center text-sm text-gray-500">찾는 곡이 없어요.</p>}
          {shown.map(h => (
            <button key={h.n} onClick={() => onPick(book, h)} className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50 active:bg-blue-100">
              <span className="font-semibold text-blue-700 mr-2">{h.n}장</span>
              <span className="text-sm text-gray-900">{h.title}</span>
              {h.section && <span className="block text-xs text-gray-400">{h.section}</span>}
            </button>
          ))}
          {list && !q.trim() && <p className="p-3 text-center text-xs text-gray-400">처음 60곡만 보여요. 번호나 제목으로 검색하세요.</p>}
        </div>
      </div>
    </div>
  );
}
