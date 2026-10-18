// 찬송가 연습: the sheet-music app's 나의 하모니 player, fed from Firestore (login required).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Harmony from '../harmony/Harmony';
import { AudioEngine } from '../harmony/audio';
import { loadSong } from '../harmony/loadSong';
import type { LoadedSong } from '../harmony/Harmony';
import ScoreViewer from './ScoreViewer';
import HymnUpload from './HymnUpload';
import { getBooks, getIndex, resetHymnCache, type HymnBook, type HymnEntry } from '../lib/hymnData';

export interface PracticeTarget { book: string; n: number }

const engine = new AudioEngine();

export default function HymnPractice({ userRole, target, onExit }: { userRole: string | null; target?: PracticeTarget | null; onExit: () => void }) {
  const canUpload = userRole === '대장' || userRole === '지휘자';
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [err, setErr] = useState('');
  const [start, setStart] = useState<{ book: HymnBook; h: HymnEntry } | null>(null);
  const [view, setView] = useState<{ book: HymnBook; h: HymnEntry; fromLink: boolean } | null>(null);
  const [viewSong, setViewSong] = useState<LoadedSong | null>(null);
  const [viewErr, setViewErr] = useState('');
  const [upload, setUpload] = useState(false);
  const [tick, setTick] = useState(0);
  const handled = useRef<PracticeTarget | null>(null);

  useEffect(() => {
    let live = true;
    setState('loading');
    getBooks().then(async books => {
      if (!live) return;
      // a month's hymn picked in "월별 찬송가": start that song and show its score (view only)
      if (target && handled.current !== target) {
        handled.current = target;
        const book = books.find(b => b.id === target.book);
        if (book) {
          try {
            const h = (await getIndex(book.id)).find(x => x.n === target.n);
            if (h && live) { setStart({ book, h }); setView({ book, h, fromLink: true }); }
          } catch { /* the player still opens */ }
        }
      }
      if (live) setState('ready');
    }).catch(e => { if (live) { setErr(e instanceof Error ? e.message : String(e)); setState('empty'); } });
    return () => { live = false; };
  }, [target, tick]);

  useEffect(() => {
    if (!view) { setViewSong(null); setViewErr(''); return; }
    let live = true;
    setViewSong(null); setViewErr('');
    loadSong(view.book, view.h).then(s => { if (live) setViewSong(s); }).catch(e => { if (live) setViewErr(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [view]);

  const startWith = useMemo(() => start, [start]);

  const box: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 70, background: '#14161c', color: '#eee', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' };

  if (state === 'loading') return <div style={box}>불러오는 중…</div>;
  if (state === 'empty') {
    return (
      <div style={box}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>찬송가 연습</div>
        <div style={{ maxWidth: 360, lineHeight: 1.6 }}>{err}</div>
        {canUpload && <button onClick={() => setUpload(true)} style={{ padding: '10px 18px', borderRadius: 10, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 700 }}>자료 올리기</button>}
        <button onClick={onExit} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #666', background: 'transparent', color: '#eee' }}>나가기</button>
        {upload && <HymnUpload onClose={() => { setUpload(false); resetHymnCache(); setTick(t => t + 1); }} />}
      </div>
    );
  }
  return (
    <>
      <Harmony
        engine={engine}
        onExit={onExit}
        loadSong={loadSong}
        onOpenScore={(book, h) => setView({ book, h, fromLink: false })}
        startWith={startWith}
      />
      {canUpload && (
        <button onClick={() => setUpload(true)} title="찬송가 자료 올리기·갱신" style={{ position: 'fixed', right: 10, bottom: 10, zIndex: 71, padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11 }}>자료 관리</button>
      )}
      {view && (viewSong
        ? <ScoreViewer score={viewSong.score} title={`${view.h.n}. ${view.h.title}`} subtitle={view.book.name} onClose={() => setView(null)} closeLabel="플레이어" />
        : <div style={{ ...box, zIndex: 75, background: '#f7f4ec', color: '#333' }}>
            {viewErr ? <><div>{viewErr}</div><button onClick={() => setView(null)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #999' }}>닫기</button></> : '악보를 불러오는 중…'}
          </div>)}
      {upload && <HymnUpload onClose={() => { setUpload(false); resetHymnCache(); setTick(t => t + 1); }} />}
    </>
  );
}
