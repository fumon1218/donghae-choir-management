// 나의 하모니 "최신 플레이어" 화면: 커버 색이 번지는 전체 화면 재생 · 가사 · 재생목록 (최신 스트리밍 앱 느낌).
// All playback state lives in Harmony.tsx; this file only draws it and calls back.

import LoopBar from './LoopBar';
import PartMixer from './PartMixer';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { HymnBook, HymnEntry } from '../lib/hymnData';
import type { InstrumentName } from './audio';

export interface Entry { book: HymnBook; h: HymnEntry }
export interface PlItemLite { book: string; n: number; title: string; section: string; set?: string }
export interface PlaylistLite { id: string; name: string; items: PlItemLite[] }
export type Repeat = 'off' | 'all' | 'one';

export interface ModernProps {
  books: HymnBook[];
  lists: Record<string, HymnEntry[]>;
  queue: Entry[];
  qi: number;
  cur: Entry | null;
  playing: boolean;
  loading: boolean;
  err: string | null;
  note: string | null;
  isAudio: boolean;
  pos: number;          // seconds, already speed-corrected
  total: number;
  hasTrack: boolean;
  speed: number;
  repeat: Repeat;
  shuffle: boolean;
  lyricText: string | null;
  cueLine: { before: string; now: string; after: string } | null;
  coverOf: (book: string, n?: number) => string | null;
  start: (items: Entry[], idx: number, goNow: boolean) => void;
  togglePlay: () => void;
  step: (dir: 1 | -1, auto: boolean) => void;
  seek: (sec: number) => void;
  setShuffle: (f: (v: boolean) => boolean) => void;
  setRepeat: (f: (v: Repeat) => Repeat) => void;
  setSpeed: (v: number) => void;
  pls: PlaylistLite[];
  playPl: (p: PlaylistLite, from: number) => void;
  openAdd: (it: PlItemLite) => void;
  itemOf: (book: string, h: HymnEntry) => PlItemLite;
  names: string[];
  muted: number[];
  toggleMute: (i: number) => void;
  loopA: number | null;
  loopB: number | null;
  markA: () => void;
  markB: () => void;
  clearLoop: () => void;
  solo: number | null;
  toggleSolo: (i: number) => void;
  vols: number[];
  setVol: (i: number, v: number) => void;
  hasParts: boolean;
  sound: InstrumentName | '';
  setSound: (v: InstrumentName | '') => void;
  sounds: Array<{ id: InstrumentName | ''; label: string }>;
  chooseArt: (mode: 'song' | 'book') => void;
  mine: { canLink: boolean; canLinkFolder: boolean; link: (folder: boolean) => void; copy: () => void; drop: (h: HymnEntry) => void };
  onSwitchUi: () => void;
  onExit: () => void;
  /** open the current song's sheet music in the editor (not offered for the user's own audio files) */
  onOpenScore?: (book: HymnBook, h: HymnEntry) => void;
  metro: MetroState;
  setMetro: (m: Partial<MetroState>) => void;
  /** written tempo of the current score song (quarter notes / min), null for audio files */
  songTempo: number | null;
  timeSig: string;
}

export interface MetroState { on: boolean; count: 0 | 1 | 2; bpm: number }

const ACCENTS: Array<{ id: string; label: string; c: string }> = [
  { id: 'blue', label: '파랑', c: '#4aa3ff' }, { id: 'pink', label: '분홍', c: '#ff5a8a' },
  { id: 'green', label: '초록', c: '#2fd08a' }, { id: 'amber', label: '황금', c: '#ffb020' },
];
type ThemeMode = 'cover' | 'dark' | 'light';
const THEME_KEY = 'harmony_theme_v1';
const readTheme = (): { mode: ThemeMode; accent: string } => {
  try {
    const v = JSON.parse(localStorage.getItem(THEME_KEY) ?? '{}');
    return { mode: v.mode === 'dark' || v.mode === 'light' ? v.mode : 'cover', accent: ACCENTS.some(a => a.id === v.accent) ? v.accent : 'blue' };
  } catch { return { mode: 'cover', accent: 'blue' }; }
};

/** True on a wide, landscape screen (an iPad held sideways, a computer): two panes side by side. */
function useWide(): boolean {
  const q = '(min-width: 820px) and (orientation: landscape)';
  const [w, setW] = useState(() => { try { return window.matchMedia(q).matches; } catch { return false; } });
  useEffect(() => {
    try {
      const m = window.matchMedia(q);
      const f = () => setW(m.matches);
      m.addEventListener('change', f);
      f();
      return () => m.removeEventListener('change', f);
    } catch { return undefined; }
  }, []);
  return w;
}

const fmt = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// ---- icons ----
const Ico = ({ d, size = 24, stroke }: { d: string; size?: number; stroke?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : 'none'} strokeWidth={stroke ? 1.8 : 0} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const D = {
  play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zM14 5h4v14h-4z', prev: 'M6 6h2.2v12H6zM9.8 12 19 18.4V5.6z', next: 'M15.8 6H18v12h-2.2zM5 18.4 14.2 12 5 5.6z',
  down: 'M5 9l7 7 7-7', close: 'M6 6l12 12M18 6 6 18', more: 'M12 5.5a1.4 1.4 0 1 0 0-.01zM12 12a1.4 1.4 0 1 0 0-.01zM12 18.5a1.4 1.4 0 1 0 0-.01z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM4 12l2-.6.6-1.5-1-1.8 1.7-1.7 1.8 1 1.5-.6L11 4h2l.6 2 1.5.6 1.8-1 1.7 1.7-1 1.8.6 1.5 2 .6v2l-2 .6-.6 1.5 1 1.8-1.7 1.7-1.8-1-1.5.6L13 20h-2l-.6-2-1.5-.6-1.8 1-1.7-1.7 1-1.8-.6-1.5L4 14z',
  shuffle: 'M3 7h3.5c2 0 3.2 1 4.3 3l2.4 4c1.100 2 2.300 3 4.300 3H21M3 17h3.500c2 0 3.200-1 4.300-3M13.200 10c1.100-2 2.300-3 4.300-3H21M18.500 4.500 21 7l-2.500 2.500M18.500 14.500 21 17l-2.500 2.500',
  repeat: 'M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3',
  queue: 'M4 6h12M4 11h12M4 16h7M15 14v6l5-3z', lyr: 'M5 5h14v10H9l-4 4zM8.500 9h7M8.500 12h4',
  bolt: 'M13 3 5 13h5l-1 8 8-10h-5z', plus: 'M12 5v14M5 12h14',
  metro: 'M8 21 10 4h4l2 17zM12 17 17 6M9.500 13h5',
  score: 'M5 5h14v14H5zM5 9h14M5 13h14M5 17h14',
};

/** Average colour of a picture (8×8 sample) so the background can bleed out of the cover. */
function useDominant(url: string | null): [number, number, number] {
  const [rgb, setRgb] = useState<[number, number, number]>([54, 96, 140]);
  useEffect(() => {
    if (!url) { setRgb([54, 96, 140]); return; }
    let dead = false;
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 8;
        const g = c.getContext('2d'); if (!g) return;
        g.drawImage(img, 0, 0, 8, 8);
        const d = g.getImageData(0, 0, 8, 8).data;
        let r = 0, gg = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
        if (!dead && n) setRgb([Math.round(r / n), Math.round(gg / n), Math.round(b / n)]);
      } catch { /* a picture we may not read: keep the default colour */ }
    };
    img.src = url;
    return () => { dead = true; };
  }, [url]);
  return rgb;
}

function Cover({ url, size, radius = 8, label }: { url: string | null; size: number | string; radius?: number; label?: string }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'cover', borderRadius: radius, display: 'block', flex: 'none' }} />;
  return <div aria-hidden="true" style={{ width: size, height: size, borderRadius: radius, flex: 'none', background: 'linear-gradient(135deg,#5b6cff,#2b2f66)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: typeof size === 'number' ? size / 3 : 40 }}>{(label ?? '♪').slice(0, 1)}</div>;
}

type Screen = 'now' | 'lyrics' | 'queue';
type Tab = 'queue' | 'library' | 'lists' | 'lyrics';
type Menu = 'none' | 'song' | 'settings' | 'metro' | 'jump';

export default function HarmonyModern(p: ModernProps) {
  const wide = useWide();
  const [screen, setScreen] = useState<Screen>(p.cur ? 'now' : 'queue');
  const [tab, setTab] = useState<Tab>(p.queue.length ? 'queue' : 'library');
  const [bookId, setBookId] = useState('');
  const [plId, setPlId] = useState('');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<Menu>('none');
  const [drag, setDrag] = useState<number | null>(null);
  const [theme, setThemeState] = useState(readTheme);
  const setTheme = (t: Partial<{ mode: ThemeMode; accent: string }>) => setThemeState(prev => { const n = { ...prev, ...t }; try { localStorage.setItem(THEME_KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const [jumpBook, setJumpBook] = useState('');
  const [jumpN, setJumpN] = useState('');
  const taps = useRef<number[]>([]);
  const press = useRef<{ t: number; long: boolean }>({ t: 0, long: false });

  const light = theme.mode === 'light';
  const accent = (ACCENTS.find(a => a.id === theme.accent) ?? ACCENTS[0]).c;
  const base = light ? '20,24,31' : '255,255,255';
  const w = (a: string) => `rgba(${base},${a})`;
  const ink = light ? '#14181f' : '#fff';
  const dim = w('.62');
  const onAccent = theme.accent === 'amber' ? '#1b1300' : '#fff';

  const cover = p.cur ? p.coverOf(p.cur.book.id, p.cur.h.n) : null;
  const [r, g, b] = useDominant(cover);
  const mix = (k: number, t: number) => Math.round(k * t + 255 * (1 - t));
  const bg = theme.mode === 'cover'
    ? `linear-gradient(180deg, rgb(${r},${g},${b}) 0%, rgb(${Math.round(r * .35)},${Math.round(g * .38)},${Math.round(b * .45)}) 55%, #070b12 100%)`
    : theme.mode === 'dark'
      ? `radial-gradient(circle at 50% -10%, ${accent}33, transparent 55%), linear-gradient(180deg, #121722, #06080d)`
      : `linear-gradient(180deg, rgb(${mix(r, .22)},${mix(g, .22)},${mix(b, .22)}) 0%, #eef1f6 60%, #e3e7ef 100%)`;

  const inAnyList = p.cur ? p.pls.some(l => l.items.some(x => x.book === p.cur!.book.id && x.n === p.cur!.h.n)) : false;
  const shownPos = drag ?? p.pos;
  const commitSeek = () => { if (drag !== null) { p.seek(drag * (p.isAudio ? 1 : p.speed)); setDrag(null); } };

  const iconBtn = (extra?: React.CSSProperties): React.CSSProperties => ({ background: 'transparent', border: 0, color: ink, cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', ...extra });
  const pill: React.CSSProperties = { padding: '9px 16px', borderRadius: 999, border: `1px solid ${w('.4')}`, background: w('.08'), color: ink, fontSize: 15, cursor: 'pointer' };
  const chip = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 999, border: `1px solid ${on ? accent : w('.35')}`, background: on ? accent : 'transparent', color: on ? onAccent : ink, fontSize: 14, cursor: 'pointer' });

  // ---- navigation (one screen at a time on a phone, side by side when wide) ----
  const goLyrics = () => { if (wide) { setTab('lyrics'); } else setScreen('lyrics'); };
  const goTab = (t: Tab) => { setTab(t); setBookId(''); setPlId(''); setQ(''); if (!wide) setScreen('queue'); };

  // ---- library helpers ----
  const book = p.books.find(x => x.id === bookId);
  const list = p.lists[bookId] ?? [];
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s+/g, '');
    if (!t) return list;
    if (/^\d+$/.test(t)) return list.filter(h => String(h.n).startsWith(t));
    return list.filter(h => h.title.toLowerCase().replace(/\s+/g, '').includes(t));
  }, [list, q]);

  const row = (key: string, cov: string | null, title: string, sub: string, on: boolean, onClick: () => void, right?: React.ReactNode, label?: string) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={onClick} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '9px 4px', background: 'transparent', border: 0, color: on ? accent : ink, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
        <span style={{ position: 'relative', display: 'flex' }}>
          <Cover url={cov} size={54} radius={6} label={label ?? title} />
          {on && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}><Ico d={D.play} size={22} /></span>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          <span style={{ display: 'block', fontSize: 14, color: on ? accent : dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
        </span>
      </button>
      {right}
    </div>
  );
  const smallBtn = (label: string, aria: string, onClick: () => void) => (
    <button onClick={onClick} aria-label={aria} title={aria} style={{ ...iconBtn({ padding: '8px 10px' }), color: dim, fontSize: 18 }}>{label}</button>
  );

  const tabs: Array<[Tab, string]> = [['queue', '대기열'], ['library', '라이브러리'], ['lists', '재생목록'], ...(wide ? [['lyrics', '가사'] as [Tab, string]] : [])];
  const sectionTabs = (
    <div style={{ display: 'flex', gap: 22, padding: '0 20px', borderBottom: `1px solid ${w('.12')}`, overflowX: 'auto' }}>
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => { setTab(id); setBookId(''); setPlId(''); setQ(''); }} aria-pressed={tab === id}
          style={{ background: 'transparent', border: 0, borderBottom: `3px solid ${tab === id ? ink : 'transparent'}`, color: tab === id ? ink : dim, padding: '14px 0 11px', fontSize: 18, fontWeight: tab === id ? 800 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
      ))}
    </div>
  );

  // ---- pieces ----
  const seekBar = (
    <div>
      <input type="range" min={0} max={Math.max(1, Math.round(p.total * 10))} value={Math.round(shownPos * 10)} disabled={!p.hasTrack} aria-label="재생 위치"
        onChange={e => setDrag(Number(e.target.value) / 10)} onPointerUp={commitSeek} onKeyUp={commitSeek}
        style={{ width: '100%', accentColor: accent, height: 4 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: dim, marginTop: 6 }}><span>{fmt(shownPos)}</span><span>{fmt(p.total)}</span></div>
      <div style={{ marginTop: 8, color: dim }}><LoopBar a={p.loopA} b={p.loopB} onA={p.markA} onB={p.markB} onClear={p.clearLoop} disabled={!p.hasTrack} chip={chip} /></div>
    </div>
  );

  const coverPress = {
    onPointerDown: () => { press.current = { t: window.setTimeout(() => { press.current.long = true; p.chooseArt('song'); }, 650), long: false }; },
    onPointerUp: () => window.clearTimeout(press.current.t),
    onPointerLeave: () => window.clearTimeout(press.current.t),
    onPointerCancel: () => window.clearTimeout(press.current.t),
    onClick: () => { if (press.current.long) { press.current.long = false; return; } setMenu('song'); },
  };

  const nowScreen = (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 22px calc(18px + env(safe-area-inset-bottom))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
        {wide ? <button onClick={p.onExit} aria-label="나가기" style={{ ...iconBtn({ padding: '8px 12px' }), fontSize: 15 }}>나가기</button>
          : <button onClick={() => setScreen('queue')} aria-label="목록으로" style={iconBtn()}><Ico d={D.down} size={30} stroke /></button>}
        <span style={{ display: 'flex' }}>
          <button onClick={() => setMenu('metro')} aria-label="메트로놈" aria-pressed={p.metro.on} style={{ ...iconBtn(), color: p.metro.on || p.metro.count > 0 ? accent : ink }}><Ico d={D.metro} size={26} stroke /></button>
          <button onClick={() => setMenu('settings')} aria-label="설정" style={iconBtn()}><Ico d={D.gear} size={26} stroke /></button>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.cur ? (
          <button {...coverPress} aria-label="곡 메뉴 (길게 누르면 앨범 이미지 바꾸기)" title="길게 누르면 앨범 이미지를 바꿔요" style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', width: 'min(100%, 46vh)', aspectRatio: '1 / 1', boxShadow: '0 12px 36px rgba(0,0,0,.4)', borderRadius: 6, overflow: 'hidden', touchAction: 'manipulation' }}>
            <Cover url={cover} size="100%" radius={0} label={p.cur.h.title} />
          </button>
        ) : <div style={{ color: dim }}>곡을 골라 주세요.</div>}
      </div>
      {p.cur && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.isAudio ? '' : `${p.cur.h.n}. `}{p.cur.h.title}</div>
              <div style={{ fontSize: 17, color: dim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.isAudio ? p.cur.h.section : `${p.cur.book.name} · ${p.cur.h.section}`}{p.cur.h.set ? ` · ${p.cur.h.set}` : ''}</div>
            </div>
            <button onClick={() => p.openAdd(p.itemOf(p.cur!.book.id, p.cur!.h))} aria-label="재생목록에 담기" aria-pressed={inAnyList} style={{ ...iconBtn(), color: inAnyList ? '#ff5a7a' : ink }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill={inAnyList ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d={D.heart} /></svg>
            </button>
            <button onClick={() => setMenu('song')} aria-label="곡 메뉴" style={iconBtn()}><Ico d={D.more} size={28} /></button>
          </div>
          {p.loading && <div style={{ fontSize: 13, color: dim, marginTop: 4 }}>불러오는 중…</div>}
          {p.err && <div style={{ fontSize: 13, color: '#ff8a8a', marginTop: 4 }}>{p.err}</div>}
          {p.note && !p.err && <div style={{ fontSize: 13, color: accent, marginTop: 4 }}>{p.note}</div>}
        </>
      )}
      <div style={{ marginTop: 22 }}>{seekBar}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
        <button onClick={() => p.setRepeat(v => (v === 'off' ? 'all' : v === 'all' ? 'one' : 'off'))} aria-label={`반복: ${p.repeat === 'off' ? '끔' : p.repeat === 'all' ? '전체' : '한 곡'}`} style={{ ...iconBtn(), color: p.repeat === 'off' ? dim : accent, position: 'relative' }}>
          <Ico d={D.repeat} size={30} stroke />{p.repeat === 'one' && <span style={{ position: 'absolute', fontSize: 11, fontWeight: 800 }}>1</span>}
        </button>
        <button onClick={() => p.step(-1, false)} aria-label="이전 곡" style={iconBtn()}><Ico d={D.prev} size={44} /></button>
        <button onClick={p.togglePlay} aria-label={p.playing ? '일시정지' : '재생'} style={iconBtn({ padding: 4 })}><Ico d={p.playing ? D.pause : D.play} size={74} /></button>
        <button onClick={() => p.step(1, false)} aria-label="다음 곡" style={iconBtn()}><Ico d={D.next} size={44} /></button>
        <button onClick={() => p.setShuffle(v => !v)} aria-label="셔플" aria-pressed={p.shuffle} style={{ ...iconBtn(), color: p.shuffle ? accent : dim }}><Ico d={D.shuffle} size={30} stroke /></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
        <button onClick={goLyrics} aria-label="가사" style={iconBtn()}><Ico d={D.lyr} size={30} stroke /></button>
        <button onClick={() => { const bk = p.cur?.book.format !== 'audio' ? p.cur?.book.id : undefined; setJumpBook(prev => prev || bk || p.books.find(x => x.format !== 'audio')?.id || ''); setMenu('jump'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 999, border: `1px solid ${w('.45')}`, background: w('.06'), color: ink, fontSize: 16, cursor: 'pointer' }}>
          <Ico d={D.bolt} size={16} />빠른 선곡
        </button>
        {p.cur && !p.isAudio && p.onOpenScore
          ? <button onClick={() => p.onOpenScore!(p.cur!.book, p.cur!.h)} aria-label="악보 보기" title="악보 보기" style={iconBtn()}><Ico d={D.score} size={30} stroke /></button>
          : <button onClick={() => goTab('queue')} aria-label="재생목록" style={iconBtn()}><Ico d={D.queue} size={30} stroke /></button>}
      </div>
    </div>
  );

  const lyricsBody = (
    <div style={{ padding: '14px 22px' }}>
      {p.cueLine && (
        <div style={{ marginBottom: 18, fontSize: 24, fontWeight: 800, lineHeight: 1.5, wordBreak: 'keep-all' }}>
          <span style={{ opacity: .4 }}>{p.cueLine.before}</span>
          <span style={{ color: onAccent, background: accent, borderRadius: 5, padding: '0 3px', margin: '0 1px' }}>{p.cueLine.now || '–'}</span>
          <span>{p.cueLine.after}</span>
        </div>
      )}
      {p.lyricText
        ? p.lyricText.split('\n').map((ln, i) => <div key={i} style={{ fontSize: 21, lineHeight: 1.75, wordBreak: 'keep-all', color: i === 0 ? ink : dim, fontWeight: i === 0 ? 800 : 400, minHeight: ln ? undefined : 16 }}>{ln}</div>)
        : <div style={{ color: dim, fontSize: 16 }}>{!p.cur ? '재생 중인 곡이 없어요.' : p.isAudio ? '내 음원은 가사를 보여 주지 않아요.' : '이 곡은 가사가 없어요.'}</div>}
    </div>
  );

  const lyricsScreen = (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 14px' }}>
        <button onClick={() => setScreen('now')} aria-label="닫기" style={iconBtn()}><Ico d={D.close} size={30} stroke /></button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cur?.h.title ?? ''}</div>
          <div style={{ fontSize: 15, color: dim }}>{p.cur ? p.cur.book.name : ''}</div>
        </div>
        {p.cur && !p.isAudio && p.onOpenScore
          ? <button onClick={() => p.onOpenScore!(p.cur!.book, p.cur!.h)} aria-label="악보 보기" style={{ ...iconBtn({ padding: '8px 6px' }), fontSize: 14 }}>악보</button>
          : <span style={{ width: 46 }} />}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{lyricsBody}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, padding: '8px 0' }}>
        <button onClick={() => p.setSpeed(p.speed >= 1.5 ? 0.8 : Math.round((p.speed + 0.1) * 10) / 10)} aria-label="속도 바꾸기" style={{ ...iconBtn(), border: `2px solid ${ink}`, borderRadius: 999, width: 46, height: 46, fontSize: 13, fontWeight: 800 }}>×{p.speed.toFixed(1)}</button>
        <button onClick={() => p.setRepeat(v => (v === 'off' ? 'all' : v === 'all' ? 'one' : 'off'))} aria-label="반복" style={{ ...iconBtn(), color: p.repeat === 'off' ? dim : accent }}><Ico d={D.repeat} size={28} stroke /></button>
        <button onClick={() => p.setShuffle(v => !v)} aria-label="셔플" style={{ ...iconBtn(), color: p.shuffle ? accent : dim }}><Ico d={D.shuffle} size={28} stroke /></button>
      </div>
      <div style={{ padding: '0 22px 6px' }}>{seekBar}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 34, padding: '4px 0 calc(16px + env(safe-area-inset-bottom))' }}>
        <button onClick={() => p.step(-1, false)} aria-label="이전 곡" style={iconBtn()}><Ico d={D.prev} size={40} /></button>
        <button onClick={p.togglePlay} aria-label={p.playing ? '일시정지' : '재생'} style={iconBtn()}><Ico d={p.playing ? D.pause : D.play} size={64} /></button>
        <button onClick={() => p.step(1, false)} aria-label="다음 곡" style={iconBtn()}><Ico d={D.next} size={40} /></button>
      </div>
    </div>
  );

  const playFrom = (items: Entry[], i: number) => { p.start(items, i, true); if (!wide) setScreen('now'); };
  const playPlGo = (l: PlaylistLite, i: number) => { p.playPl(l, i); if (!wide) setScreen('now'); };

  const queueBody = (
    <div>
      {p.queue.length === 0 && <div style={{ padding: 24, color: dim, fontSize: 16 }}>대기열이 비어 있어요. 「라이브러리」에서 곡을 골라 보세요.</div>}
      {p.queue.map((it, i) => row(`${it.book.id}:${it.h.n}:${i}`, p.coverOf(it.book.id, it.h.n), it.h.title, `${it.book.name}${it.h.set ? ` · ${it.h.set}` : ''}`, i === p.qi && !!p.cur, () => playFrom(p.queue, i),
        smallBtn('＋', `${it.h.title} 재생목록에 담기`, () => p.openAdd(p.itemOf(it.book.id, it.h))), it.h.title))}
    </div>
  );

  const libraryBody = !bookId ? (
    <div>
      {p.books.map(bk => row(bk.id, p.coverOf(bk.id), bk.name, p.lists[bk.id] ? `${p.lists[bk.id].length}곡` : '불러오는 중…', false, () => { setBookId(bk.id); setQ(''); }, <span aria-hidden="true" style={{ color: dim, paddingRight: 8, fontSize: 22 }}>›</span>, bk.name))}
    </div>
  ) : (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <button onClick={() => { setBookId(''); setQ(''); }} aria-label="책 목록으로" style={iconBtn({ padding: '6px 10px' })}><span style={{ fontSize: 24 }}>‹</span></button>
        <div style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>{book?.name}</div>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="번호·제목 검색" aria-label="검색" inputMode="search" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: 0, background: w('.12'), color: ink, fontSize: 16, marginBottom: 6 }} />
      {bookId === 'mine' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0 10px' }}>
          {p.mine.canLink && <button onClick={() => p.mine.link(false)} style={pill}>＋ 원본 파일 연결</button>}
          {p.mine.canLinkFolder && <button onClick={() => p.mine.link(true)} style={pill}>＋ 폴더 연결</button>}
          <button onClick={p.mine.copy} style={pill}>＋ {p.mine.canLink ? '복사해서 저장' : '기기에서 음원 추가'}</button>
        </div>
      )}
      {shown.length === 0 && <div style={{ color: dim, padding: 12, fontSize: 15 }}>{list.length ? '찾는 곡이 없어요.' : bookId === 'mine' ? '아직 음원이 없어요. 위 버튼으로 추가해 보세요.' : '불러오는 중…'}</div>}
      {shown.length > 0 && <button onClick={() => book && playFrom(shown.map(h => ({ book, h })), 0)} style={{ ...pill, margin: '4px 0 6px' }}>▶ 전체 재생 ({shown.length}곡)</button>}
      {shown.map((h, i) => book && row(`${h.n}`, p.coverOf(book.id, h.n), bookId === 'mine' ? h.title : `${h.n}. ${h.title}`, `${h.section}${h.set ? ` · ${h.set}` : ''}`, !!p.cur && p.cur.book.id === book.id && p.cur.h.n === h.n, () => playFrom(shown.map(x => ({ book, h: x })), i),
        <>
          {smallBtn('＋', `${h.title} 재생목록에 담기`, () => p.openAdd(p.itemOf(book.id, h)))}
          {bookId === 'mine' && smallBtn('×', `${h.title} 지우기`, () => p.mine.drop(h))}
        </>, h.title))}
    </div>
  );

  const curList = p.pls.find(l => l.id === plId);
  const listsBody = !curList ? (
    <div>
      {p.pls.length === 0 && <div style={{ padding: 24, color: dim, fontSize: 16 }}>아직 없어요. 곡의 ♡ 나 ＋ 버튼으로 재생목록을 만들 수 있어요.</div>}
      {p.pls.map(l => row(l.id, l.items[0] ? p.coverOf(l.items[0].book, l.items[0].n) : null, l.name, `${l.items.length}곡`, false, () => setPlId(l.id), <span aria-hidden="true" style={{ color: dim, paddingRight: 8, fontSize: 22 }}>›</span>, l.name))}
    </div>
  ) : (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <button onClick={() => setPlId('')} aria-label="재생목록 목록으로" style={iconBtn({ padding: '6px 10px' })}><span style={{ fontSize: 24 }}>‹</span></button>
        <div style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>{curList.name}</div>
        {curList.items.length > 0 && <button onClick={() => playPlGo(curList, 0)} style={pill}>▶ 재생</button>}
      </div>
      {curList.items.length === 0 && <div style={{ padding: 16, color: dim }}>비어 있어요.</div>}
      {curList.items.map((x, i) => row(`${x.book}:${x.n}`, p.coverOf(x.book, x.n), x.title, `${p.books.find(bk => bk.id === x.book)?.name ?? x.book}${x.set ? ` · ${x.set}` : ''}`, !!p.cur && p.cur.book.id === x.book && p.cur.h.n === x.n, () => playPlGo(curList, i), undefined, x.title))}
    </div>
  );

  const tabBody = tab === 'queue' ? queueBody : tab === 'library' ? libraryBody : tab === 'lists' ? listsBody : lyricsBody;
  const tabPadding = tab === 'lyrics' ? 0 : '8px 20px 16px';

  const miniPlayer = p.cur && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px calc(10px + env(safe-area-inset-bottom))', background: w('.1'), backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <button onClick={() => setScreen('now')} aria-label="재생 화면 열기" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'transparent', border: 0, color: ink, textAlign: 'left', cursor: 'pointer', font: 'inherit', padding: 0 }}>
        <Cover url={cover} size={46} radius={6} label={p.cur.h.title} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cur.h.title}</span>
      </button>
      <button onClick={() => p.step(-1, false)} aria-label="이전 곡" style={iconBtn()}><Ico d={D.prev} size={28} /></button>
      <button onClick={p.togglePlay} aria-label={p.playing ? '일시정지' : '재생'} style={iconBtn()}><Ico d={p.playing ? D.pause : D.play} size={36} /></button>
      <button onClick={() => p.step(1, false)} aria-label="다음 곡" style={iconBtn()}><Ico d={D.next} size={28} /></button>
    </div>
  );

  const queueScreen = (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px' }}>
        <button onClick={() => (p.cur ? setScreen('now') : p.onExit())} aria-label={p.cur ? '재생 화면으로' : '나가기'} style={iconBtn()}><Ico d={D.close} size={30} stroke /></button>
        <div style={{ fontSize: 22, fontWeight: 800 }}>나의 하모니</div>
        <button onClick={() => setMenu('settings')} aria-label="설정" style={iconBtn()}><Ico d={D.gear} size={26} stroke /></button>
      </div>
      {sectionTabs}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: tabPadding }}>{tabBody}</div>
      {miniPlayer}
    </div>
  );

  // ---- sheets ----
  const sheet = (title: string, body: React.ReactNode) => (
    <div role="dialog" aria-label={title} onClick={() => setMenu('none')} style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '82%', overflowY: 'auto', background: light ? '#fff' : '#161a22', color: ink, borderRadius: '20px 20px 0 0', padding: '16px 20px calc(22px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b style={{ fontSize: 18 }}>{title}</b>
          <button onClick={() => setMenu('none')} style={{ ...iconBtn({ padding: '4px 12px' }), background: w('.12'), borderRadius: 8, fontSize: 14 }}>닫기</button>
        </div>
        {body}
      </div>
    </div>
  );
  const item = (label: string, onClick: () => void) => (
    <button onClick={() => { setMenu('none'); onClick(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 4px', background: 'transparent', border: 0, borderBottom: `1px solid ${w('.1')}`, color: ink, fontSize: 17, cursor: 'pointer', font: 'inherit' }}>{label}</button>
  );
  const heading = (t: string, extra?: React.ReactNode) => <div style={{ fontWeight: 700, marginBottom: 6 }}>{t}{extra}</div>;

  const songMenu = p.cur && sheet(p.cur.h.title, (
    <>
      {!p.isAudio && p.onOpenScore && item('악보 보기', () => p.onOpenScore!(p.cur!.book, p.cur!.h))}
      {item('♡ 재생목록에 담기', () => p.openAdd(p.itemOf(p.cur!.book.id, p.cur!.h)))}
      {item('이 곡 앨범 이미지 고르기', () => p.chooseArt('song'))}
      {item(`「${p.cur.book.name}」 전체 이미지 고르기`, () => p.chooseArt('book'))}
    </>
  ));

  const tap = () => {
    const now = Date.now();
    const a = taps.current.filter(t => now - t < 2500);
    a.push(now);
    taps.current = a;
    if (a.length >= 3) {
      const avg = (a[a.length - 1] - a[0]) / (a.length - 1);
      p.setMetro({ bpm: Math.max(30, Math.min(240, Math.round(60000 / avg))) });
    }
  };
  const metroMenu = sheet('메트로놈', (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        {heading('재생 중 박자 소리')}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={chip(!p.metro.on)} onClick={() => p.setMetro({ on: false })}>끄기</button>
          <button style={chip(p.metro.on)} onClick={() => p.setMetro({ on: true })}>켜기</button>
        </div>
      </div>
      <div>
        {heading('카운트 인', <span style={{ fontWeight: 400, opacity: .6, fontSize: 13 }}> (재생 전에 박자를 먼저 들려줘요)</span>)}
        <div style={{ display: 'flex', gap: 8 }}>
          {([[0, '없음'], [1, '1마디'], [2, '2마디']] as const).map(([n, l]) => <button key={n} style={chip(p.metro.count === n)} onClick={() => p.setMetro({ count: n })}>{l}</button>)}
        </div>
      </div>
      <div>
        {p.songTempo !== null ? (
          <>
            {heading('이 곡의 박자')}
            <div style={{ fontSize: 15, color: dim, lineHeight: 1.6 }}>{p.timeSig} 박자 · ♩ = {Math.round(p.songTempo * p.speed)}{p.speed !== 1 ? ` (원래 ${p.songTempo}, 속도 ×${p.speed.toFixed(1)})` : ''}<br />곡의 빠르기를 그대로 따라가요. 속도를 바꾸면 박자 소리도 같이 바뀌어요.</div>
          </>
        ) : (
          <>
            {heading('빠르기 (♩ = 분당 박)')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={chip(false)} onClick={() => p.setMetro({ bpm: Math.max(30, p.metro.bpm - 2) })} aria-label="느리게">－</button>
              <b style={{ fontSize: 26, minWidth: 64, textAlign: 'center' }}>{p.metro.bpm}</b>
              <button style={chip(false)} onClick={() => p.setMetro({ bpm: Math.min(240, p.metro.bpm + 2) })} aria-label="빠르게">＋</button>
              <button style={chip(false)} onClick={tap}>탭 템포</button>
            </div>
            <div style={{ fontSize: 13, color: dim, marginTop: 6 }}>내 음원은 빠르기를 알 수 없어요. 곡에 맞춰 직접 맞추거나, 박자에 맞춰 「탭 템포」를 3번 이상 눌러 보세요. 4/4 박자로 소리 나요.</div>
          </>
        )}
      </div>
    </div>
  ));

  const jumpList = p.lists[jumpBook] ?? [];
  const jumpHit = jumpN && /^\d+$/.test(jumpN) ? jumpList.find(h => h.n === Number(jumpN)) : undefined;
  const jumpBk = p.books.find(x => x.id === jumpBook);
  const doJump = () => {
    if (!jumpHit || !jumpBk) return;
    setMenu('none');
    playFrom(jumpList.map(h => ({ book: jumpBk, h })), jumpList.indexOf(jumpHit));
  };
  const jumpMenu = sheet('번호로 이동', (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {p.books.filter(x => x.format !== 'audio').map(bk => <button key={bk.id} style={chip(jumpBook === bk.id)} onClick={() => setJumpBook(bk.id)}>{bk.name}</button>)}
      </div>
      <input value={jumpN} onChange={e => setJumpN(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={e => { if (e.key === 'Enter') doJump(); }} placeholder="곡 번호" aria-label="곡 번호" inputMode="numeric" autoFocus
        style={{ padding: '14px 16px', borderRadius: 12, border: 0, background: w('.12'), color: ink, fontSize: 28, fontWeight: 800, textAlign: 'center' }} />
      <div style={{ minHeight: 24, textAlign: 'center', fontSize: 17, color: jumpHit ? ink : dim }}>
        {jumpN ? (jumpHit ? `${jumpHit.n}. ${jumpHit.title}` : '그 번호의 곡이 없어요.') : `${jumpBk?.name ?? ''} ${jumpList[0] ? `${jumpList[0].n}~${jumpList[jumpList.length - 1].n}번` : ''}`}
      </div>
      <button onClick={doJump} disabled={!jumpHit} style={{ ...chip(true), padding: '14px', fontSize: 17, opacity: jumpHit ? 1 : .4 }}>▶ 이 곡부터 재생</button>
      <button onClick={() => { setMenu('none'); goTab('library'); }} style={{ ...chip(false), padding: '12px' }}>목록에서 찾기</button>
    </div>
  ));

  const settingsMenu = sheet('설정', (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        {heading('플레이어 화면')}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={chip(false)} onClick={() => { setMenu('none'); p.onSwitchUi(); }}>MP3 모드로 바꾸기</button>
          <button style={chip(true)} aria-pressed="true">최신 플레이어 (지금)</button>
        </div>
      </div>
      <div>
        {heading('배경')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['cover', '표지 색'], ['dark', '어둡게'], ['light', '밝게']] as const).map(([id, l]) => <button key={id} style={chip(theme.mode === id)} aria-pressed={theme.mode === id} onClick={() => setTheme({ mode: id })}>{l}</button>)}
        </div>
      </div>
      <div>
        {heading('강조 색')}
        <div style={{ display: 'flex', gap: 12 }}>
          {ACCENTS.map(a => <button key={a.id} aria-label={`${a.label} 강조 색`} aria-pressed={theme.accent === a.id} onClick={() => setTheme({ accent: a.id })} style={{ width: 38, height: 38, borderRadius: '50%', background: a.c, border: theme.accent === a.id ? `3px solid ${ink}` : `3px solid transparent`, cursor: 'pointer', boxShadow: '0 0 0 1px rgba(0,0,0,.2)' }} />)}
        </div>
      </div>
      <div>
        {heading(`속도 ×${p.speed.toFixed(1)}`)}
        <input type="range" min={0.5} max={1.5} step={0.1} value={p.speed} aria-label="속도" onChange={e => p.setSpeed(Number(e.target.value))} style={{ width: '100%', accentColor: accent }} />
      </div>
      {!p.isAudio && (
        <div>
          {heading('소리')}
          <select value={p.sound} onChange={e => p.setSound(e.target.value as InstrumentName | '')} aria-label="소리" style={{ width: '100%', padding: 10, borderRadius: 8, border: 0, background: w('.12'), color: ink, fontSize: 16 }}>
            {p.sounds.map(s => <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.label}</option>)}
          </select>
        </div>
      )}
      {p.hasParts && (
        <div>
          {heading('파트 믹서', <span style={{ fontWeight: 400, opacity: .6, fontSize: 13 }}> (단독 = 그 파트만, 슬라이더 = 음량)</span>)}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <PartMixer names={p.names} muted={p.muted} solo={p.solo} vols={p.vols} onMute={p.toggleMute} onSolo={p.toggleSolo} onVol={p.setVol} chip={chip} accent={accent} />
          </div>
        </div>
      )}
      <button onClick={p.onExit} style={{ ...chip(false), alignSelf: 'flex-start' }}>나가기</button>
    </div>
  ));

  const content = wide ? (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div style={{ width: '44%', minWidth: 360, display: 'flex', flexDirection: 'column' }}>{nowScreen}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${w('.12')}`, background: w('.04') }}>
        {sectionTabs}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: tabPadding }}>{tabBody}</div>
      </div>
    </div>
  ) : screen === 'now' ? nowScreen : screen === 'lyrics' ? lyricsScreen : queueScreen;

  return (
    <div role="dialog" aria-label="나의 하모니 (최신 플레이어)" style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', background: bg, color: ink, paddingTop: 'env(safe-area-inset-top)', fontFamily: 'inherit', transition: 'background .6s' }}>
      <div style={{ flex: 1, minHeight: 0, width: wide ? '100%' : 'min(100%, 560px)', alignSelf: 'center', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {content}
        {menu === 'song' && songMenu}
        {menu === 'settings' && settingsMenu}
        {menu === 'metro' && metroMenu}
        {menu === 'jump' && jumpMenu}
      </div>
    </div>
  );
}
