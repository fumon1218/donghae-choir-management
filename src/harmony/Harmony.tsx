// 나의 하모니: 모아 둔 찬송가·합주곡을 듣는 작은 플레이어 (클래식 MP3 플레이어 느낌).
// 화면 = 목록 / 재생 / 가사 / 옵션. 앨범 아트는 기기의 사진을 골라 곡별·분류별로 지정합니다.

import LoopBar from './LoopBar';
import PartMixer from './PartMixer';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioEngine, InstrumentName } from './audio';
import { buildPlayable, FilePlayer, ScorePlayer, type Playable } from './scorePlayer';
import { addTrack, canLink, canLinkFolder, getTrackBlob, listTracks, pickLinkFiles, pickLinkFolder, removeTrack, requestPersist, type TrackMeta } from '../lib/audio/trackStore';
import { artKeyBook, artKeySong, delArt, getArt, putArt, shrinkImage } from '../lib/audio/artStore';
import { getBooks, getIndex, type HymnBook, type HymnEntry } from '../lib/hymnData';
import HarmonyModern, { type MetroState } from './HarmonyModern';
import { Metronome, pulseOf } from './metronome';
import { SKINS, skinById, probeImage, type Skin } from './harmonySkins';
import type { Score } from './score';

/** pseudo book for the score that is open in the editor (「듣기」 on a score of your own) */
export const EDITOR_BOOK_ID = '__editor__';
export interface LoadedSong { score: Score; lyrics: string | null; partNames: string[] }

interface Props {
  engine: AudioEngine;
  onExit: () => void;
  loadSong: (book: HymnBook, h: HymnEntry) => Promise<LoadedSong>;
  /** open the song's sheet music in the editor */
  onOpenScore?: (book: HymnBook, h: HymnEntry) => void;
  /** play this song (and the rest of its book) right away, e.g. when coming from the sheet music */
  startWith?: { book: HymnBook; h: HymnEntry; measure?: number } | null;
}


type View = 'books' | 'list' | 'now' | 'lyrics' | 'opts' | 'pls' | 'plsong';

/** A saved playlist keeps a small copy of each entry, so it still lists songs while the books are loading. */
interface PlItem { book: string; n: number; title: string; section: string; set?: string }
interface Playlist { id: string; name: string; items: PlItem[] }
const PL_KEY = 'harmony_playlists_v1';
const loadPls = (): Playlist[] => {
  try {
    const v = JSON.parse(localStorage.getItem(PL_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string' && Array.isArray(x.items)) : [];
  } catch { return []; }
};
type Repeat = 'off' | 'all' | 'one';

const SOUNDS: Array<{ id: InstrumentName | ''; label: string }> = [
  { id: '', label: '자동 (피아노)' },
  { id: 'piano', label: '피아노' },
  { id: 'organ', label: '오르간' },
  { id: 'choir', label: '합창 (아)' },
  { id: 'string_ensemble', label: '현악 합주' },
  { id: 'flute', label: '플루트' },
] as Array<{ id: InstrumentName | ''; label: string }>;

const BOOK_LOOK: Record<string, { a: string; b: string }> = {
  grace: { a: '#6d7bd9', b: '#2f3a8f' },
  hymn: { a: '#3fb7a5', b: '#146a63' },
  ensemble: { a: '#f0b44c', b: '#b0661c' },
  mine: { a: '#e0708a', b: '#8f2a47' },
};
const lookOf = (id: string) => BOOK_LOOK[id] ?? { a: '#8a94a6', b: '#475066' };

const MINE: HymnBook = { id: 'mine', name: '내 음원', format: 'audio' };
const entryOf = (t: TrackMeta): HymnEntry => ({ n: t.n, title: t.title, section: `${t.linked ? '🔗 ' : ''}${t.artist || '내 음원'}`, parts: [], lyric: false, set: t.album || undefined });

const fmt = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// ---- tiny inline icons (no extra icon imports) ----
const Ico = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
);
const I_PLAY = 'M8 5v14l11-7z';
const I_PAUSE = 'M6 5h4v14H6zM14 5h4v14h-4z';
const I_PREV = 'M6 6h2v12H6zM9.5 12 18 18V6z';
const I_NEXT = 'M16 6h2v12h-2zM6 18l8.5-6L6 6z';
const I_MENU = 'M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z';
const I_VIEW = 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a1.3 1.3 0 1 1 0 2.6A1.3 1.3 0 0 1 12 7zm-1.3 4h2.6v6h-2.6z';

function Cover({ url, book, size, title }: { url?: string | null; book: string; size: number; title?: string }) {
  const l = lookOf(book);
  if (url) return <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', borderRadius: size > 90 ? 10 : 6, display: 'block' }} />;
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: size > 90 ? 10 : 6, background: `linear-gradient(145deg, ${l.a}, ${l.b})`, color: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, fontWeight: 700, flex: 'none', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)' }}>
      {title ? title.charAt(0) : '♪'}
    </div>
  );
}

/** cute ears / antlers / dial drawn above the player body */
function Deco({ skin }: { skin: Skin }) {
  const a = skin.decoA ?? '#fff', b = skin.decoB ?? '#ccc', edge = skin.bodyBorder;
  const abs = (st: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', pointerEvents: 'none', ...st });
  if (skin.deco === 'knob') {
    return <div style={abs({ top: -9, right: 34, width: 54, height: 12, borderRadius: '4px 4px 0 0', background: `repeating-linear-gradient(90deg, ${a} 0 3px, ${b} 3px 5px)`, boxShadow: '0 -2px 4px rgba(0,0,0,.4)' })} />;
  }
  const ear = (side: 'l' | 'r'): React.ReactNode => {
    const left = side === 'l';
    if (skin.deco === 'cat') {
      return (
        <div style={abs({ top: -46, [left ? 'left' : 'right']: 30, width: 70, height: 56, background: a, clipPath: 'polygon(0% 100%, 12% 0%, 100% 100%)', transform: left ? 'none' : 'scaleX(-1)', filter: `drop-shadow(0 0 1px ${edge})` })}>
          <div style={{ position: 'absolute', left: 14, top: 16, width: 38, height: 38, background: b, clipPath: 'polygon(0% 100%, 14% 0%, 100% 100%)' }} />
        </div>
      );
    }
    if (skin.deco === 'bunny') {
      return (
        <div style={abs({ top: -92, [left ? 'left' : 'right']: 40, width: 58, height: 112, borderRadius: '50% 50% 30% 30% / 70% 70% 30% 30%', background: a, border: `1px solid ${edge}`, transform: `rotate(${left ? -9 : 9}deg)` })}>
          <div style={{ position: 'absolute', left: 12, top: 14, width: 32, height: 82, borderRadius: '50% 50% 40% 40% / 70% 70% 30% 30%', background: b }} />
        </div>
      );
    }
    // deer: antler + side ear
    return (
      <>
        <div style={abs({ top: -58, [left ? 'left' : 'right']: 70, width: 40, height: 62, transform: `rotate(${left ? -8 : 8}deg)` })}>
          <div style={{ position: 'absolute', left: 14, top: 18, width: 14, height: 46, borderRadius: 8, background: a }} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: 13, height: 30, borderRadius: 8, background: a, transform: 'rotate(-12deg)' }} />
          <div style={{ position: 'absolute', left: 28, top: 0, width: 13, height: 30, borderRadius: 8, background: a, transform: 'rotate(12deg)' }} />
        </div>
        <div style={abs({ top: -14, [left ? 'left' : 'right']: -22, width: 56, height: 40, borderRadius: '50%', background: a, border: `1px solid ${edge}`, transform: `rotate(${left ? -22 : 22}deg)` })}>
          <div style={{ position: 'absolute', left: 10, top: 9, width: 34, height: 22, borderRadius: '50%', background: b }} />
        </div>
      </>
    );
  };
  return <>{ear('l')}{ear('r')}</>;
}

export default function Harmony({ engine, onExit, loadSong, onOpenScore, startWith }: Props) {
  const sp = useMemo(() => new ScorePlayer(engine), [engine]);
  const fp = useMemo(() => new FilePlayer(), []);
  const act = useRef<ScorePlayer | FilePlayer>(sp);
  const P = () => act.current;
  const [books, setBooks] = useState<HymnBook[]>([]);
  const [lists, setLists] = useState<Record<string, HymnEntry[]>>({});
  const [bookId, setBookId] = useState('');
  const [view, setView] = useState<View>('books');
  const [pls, setPls] = useState<Playlist[]>(loadPls);
  const [plId, setPlId] = useState('');
  const [addFor, setAddFor] = useState<PlItem | null>(null);
  const savePls = (next: Playlist[]) => { setPls(next); try { localStorage.setItem(PL_KEY, JSON.stringify(next)); } catch { setNote('재생목록을 저장하지 못했어요. (저장 공간 부족)'); } };
  const [q, setQ] = useState('');
  const [sec, setSec] = useState('전체');
  const [cur, setCur] = useState<{ book: HymnBook; h: HymnEntry } | null>(null);
  const [queue, setQueue] = useState<Array<{ book: HymnBook; h: HymnEntry }>>([]);
  const [qi, setQi] = useState(0);
  const [pl, setPl] = useState<Playable | null>(null);
  const [partNames, setPartNames] = useState<string[]>([]);
  const [lyricText, setLyricText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>('all');
  const [speed, setSpeed] = useState(1);
  const [sound, setSound] = useState<InstrumentName | ''>('');
  const [muted, setMuted] = useState<number[]>([]);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [solo, setSoloState] = useState<number | null>(null);
  const [vols, setVolsState] = useState<number[]>([]);
  const [arts, setArts] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [skinId, setSkinId] = useState<string>(() => { try { return localStorage.getItem('harmony_skin_v1') ?? 'silver'; } catch { return 'silver'; } });
  const [skinOpen, setSkinOpen] = useState(false);
  const metronome = useMemo(() => new Metronome(), []);
  const [metro, setMetroState] = useState<MetroState>(() => {
    try { const v = JSON.parse(localStorage.getItem('harmony_metro_v1') ?? '{}'); return { on: !!v.on, count: v.count === 1 || v.count === 2 ? v.count : 0, bpm: typeof v.bpm === 'number' ? v.bpm : 100 }; } catch { return { on: false, count: 0, bpm: 100 }; }
  });
  const setMetro = (m: Partial<MetroState>) => setMetroState(prev => { const n = { ...prev, ...m }; try { localStorage.setItem('harmony_metro_v1', JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const metroRef = useRef(metro);
  metroRef.current = metro;
  const [ui, setUi] = useState<'retro' | 'modern'>(() => { try { return localStorage.getItem('harmony_ui_v1') === 'modern' ? 'modern' : 'retro'; } catch { return 'retro'; } });
  const chooseUi = (u: 'retro' | 'modern') => { setUi(u); try { localStorage.setItem('harmony_ui_v1', u); } catch { /* ignore */ } };
  const [skinImgs, setSkinImgs] = useState<Record<string, string>>({});
  const [coverImgs, setCoverImgs] = useState<Record<string, string>>({});
  const S = skinById(skinId);
  const chooseSkin = (id: string) => { setSkinId(id); try { localStorage.setItem('harmony_skin_v1', id); } catch { /* ignore */ } };
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const tracks = useRef<TrackMeta[]>([]);
  const artMode = useRef<'song' | 'book'>('song');
  const token = useRef(0);
  const cache = useRef(new Map<string, Promise<LoadedSong>>());
  const live = useRef({ queue, qi, shuffle, repeat });
  live.current = { queue, qi, shuffle, repeat };

  // ---- data ----
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const bs: HymnBook[] = await getBooks();
        if (dead) return;
        setBooks([...bs, MINE]);
        const all: Record<string, HymnEntry[]> = {};
        await Promise.all(bs.map(async b => {
          try { all[b.id] = await getIndex(b.id); } catch { /* the book stays empty */ }
        }));
        tracks.current = await listTracks();
        all.mine = tracks.current.map(entryOf);
        if (!dead) setLists(all);
      } catch { if (!dead) setErr('곡 목록을 불러오지 못했어요.'); }
    })();
    return () => { dead = true; };
  }, []);

  // pictures the owner added to public/harmony/ (body textures per skin, default covers per book)
  useEffect(() => {
    let dead = false;
    probeImage('skins', skinId).then(u => { if (!dead && u) setSkinImgs(p => (p[skinId] === u ? p : { ...p, [skinId]: u })); });
    return () => { dead = true; };
  }, [skinId]);
  useEffect(() => {
    if (!skinOpen) return;
    let dead = false;
    SKINS.forEach(k => probeImage('skins', k.id).then(u => { if (!dead && u) setSkinImgs(p => (p[k.id] === u ? p : { ...p, [k.id]: u })); }));
    return () => { dead = true; };
  }, [skinOpen]);
  useEffect(() => {
    let dead = false;
    ['default', 'grace', 'hymn', 'ensemble', 'mine'].forEach(b => probeImage('covers', b).then(u => { if (!dead && u) setCoverImgs(p => ({ ...p, [b]: u })); }));
    return () => { dead = true; };
  }, []);

  // ---- album art (object URLs for song / book covers) ----
  const loadArt = useCallback(async (key: string) => {
    const b = await getArt(key);
    setArts(prev => {
      const next = { ...prev };
      if (next[key]) URL.revokeObjectURL(next[key]);
      if (b) next[key] = URL.createObjectURL(b); else delete next[key];
      return next;
    });
  }, []);
  useEffect(() => { books.forEach(b => void loadArt(artKeyBook(b.id))); }, [books, loadArt]);
  // covers of the user's own tracks (embedded pictures) show in the list header and player
  const mineIds = (lists.mine ?? []).map(h => h.n).join(',');
  useEffect(() => { (lists.mine ?? []).forEach(h => void loadArt(artKeySong('mine', h.n))); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineIds, loadArt]);
  useEffect(() => { if (cur) void loadArt(artKeySong(cur.book.id, cur.h.n)); }, [cur, loadArt]);
  const artsRef = useRef(arts);
  artsRef.current = arts;
  useEffect(() => () => { Object.values(artsRef.current).forEach(u => URL.revokeObjectURL(u)); }, []);
  const coverOf = (book: string, n?: number) => (n !== undefined ? arts[artKeySong(book, n)] : undefined) ?? arts[artKeyBook(book)] ?? coverImgs[book] ?? coverImgs.default ?? null;

  const pickArt = async (file: File | undefined) => {
    if (!file || !cur) return;
    try {
      const blob = await shrinkImage(file);
      const key = artMode.current === 'song' ? artKeySong(cur.book.id, cur.h.n) : artKeyBook(cur.book.id);
      const ok = await putArt(key, blob);
      if (!ok) { setNote('이 브라우저에서는 이미지를 저장할 수 없어요.'); return; }
      await loadArt(key);
      setNote(artMode.current === 'song' ? '이 곡의 앨범 아트를 바꿨어요.' : `「${cur.book.name}」 전체의 기본 이미지로 정했어요.`);
    } catch (e) { setNote(e instanceof Error ? e.message : '이미지를 불러오지 못했어요.'); }
  };
  const chooseArt = (mode: 'song' | 'book') => { artMode.current = mode; fileRef.current?.click(); };
  const clearArt = async (mode: 'song' | 'book') => {
    if (!cur) return;
    const key = mode === 'song' ? artKeySong(cur.book.id, cur.h.n) : artKeyBook(cur.book.id);
    await delArt(key);
    await loadArt(key);
    setNote(mode === 'song' ? '이 곡의 이미지를 지웠어요.' : '분류 기본 이미지를 지웠어요.');
  };

  // ---- playback ----
  const getLoaded = useCallback((book: HymnBook, h: HymnEntry) => {
    const k = `${book.id}:${h.n}`;
    if (book.id === EDITOR_BOOK_ID) return loadSong(book, h);   // the open score changes all the time: never cached
    let p = cache.current.get(k);
    if (!p) {
      p = loadSong(book, h);
      p.catch(() => cache.current.delete(k));
      cache.current.set(k, p);
      if (cache.current.size > 5) cache.current.delete(cache.current.keys().next().value as string);
    }
    return p;
  }, [loadSong]);

  const pulseFor = (pb: Playable | null) => (pb?.tempo ? pulseOf(pb.tempo, pb.beats ?? 4, pb.beatType ?? 4, pb.pickupSec ?? 0) : pulseOf(metroRef.current.bpm, 4, 4, 0));
  const doCountIn = async (pb: Playable | null, spd: number) => {
    const m = metroRef.current;
    if (m.count <= 0) return;
    const pu = pulseFor(pb);
    await metronome.countIn(m.count, pu.perBar, pu.period / spd);
  };

  const start = useCallback(async (items: Array<{ book: HymnBook; h: HymnEntry }>, idx: number, goNow: boolean) => {
    const it = items[idx];
    if (!it) return;
    const my = ++token.current;
    engine.unlock();
    metronome.unlock();
    sp.stop();
    fp.stop();
    const audioKind = it.book.format === 'audio';
    act.current = audioKind ? fp : sp;
    setPlaying(false);
    setLoading(true);
    setErr(null);
    setQueue(items);
    setQi(idx);
    setCur(it);
    setPos(0);
    if (goNow) setView('now');
    let started: Playable | null = null;
    try {
      if (audioKind) {
        const blob = await getTrackBlob(it.h.n);
        if (!blob) throw new Error('저장된 음원을 찾을 수 없어요. 다시 추가해 주세요.');
        const dur = await fp.load(blob);
        if (my !== token.current) return;
        started = { notes: [], cues: [], total: dur, partCount: 1, programs: [] };
        setPl(started);
        setPartNames([]);
        setLyricText(null);
        setMuted([]);
      } else {
        const r = await getLoaded(it.book, it.h);
        if (my !== token.current) return;
        const built = buildPlayable(r.score);
        if (built.notes.length === 0) throw new Error('이 곡에는 재생할 음표가 없어요.');
        sp.load(built);
        sp.muted = new Set();
        sp.solo = null; sp.vols = [];
        setMuted([]); setSoloState(null); setVolsState([]);
        started = built;
        setPl(built);
        setPartNames(r.partNames);
        setLyricText(r.lyrics);
      }
      setNote(null);
      fp.speed = speed;
      if (metroRef.current.count > 0) {
        setNote('카운트 인…');
        await doCountIn(started, speed);
        if (my !== token.current) return;
        setNote(null);
      }
      let at = 0;
      const mi = startMeasure.current;
      startMeasure.current = null;
      if (mi && mi > 0 && !audioKind && started.tempo && started.beats && started.beatType) {
        // fixed-tempo estimate of where measure `mi` begins (a tempo change in the middle makes it approximate)
        const bar = started.beats * (4 / started.beatType) * 60 / started.tempo;
        const pk = started.pickupSec ?? 0;
        at = Math.min(Math.max(0, started.total - 1), pk > 0 ? pk + (mi - 1) * bar : mi * bar);
      }
      await P().play(at);
      if (at > 0) setPos(at);
      if (my !== token.current) return;
      setPlaying(P().playing);
      if (P().blocked) setNote('브라우저가 소리를 막고 있어요. 기기의 무음 모드와 볼륨을 확인하고 ▶를 눌러 주세요.');
      // warm up the next song
      const nx = items[(idx + 1) % items.length];
      if (nx && items.length > 1 && nx.book.format !== 'audio') void getLoaded(nx.book, nx.h).catch(() => {});
    } catch (e) {
      if (my !== token.current) return;
      setErr(e instanceof Error ? e.message : '곡을 불러오지 못했어요.');
    } finally {
      if (my === token.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, sp, fp, speed, getLoaded, metronome]);

  const step = useCallback((dir: 1 | -1, auto: boolean) => {
    const { queue: qs, qi: i, shuffle: sh, repeat: rp } = live.current;
    if (qs.length === 0) return;
    if (auto && rp === 'one') { void start(qs, i, false); return; }
    let n: number;
    if (sh && qs.length > 1) { do { n = Math.floor(Math.random() * qs.length); } while (n === i); }
    else n = i + dir;
    if (n >= qs.length) { if (auto && rp === 'off') { setPlaying(false); return; } n = 0; }
    if (n < 0) n = qs.length - 1;
    void start(qs, n, false);
  }, [start]);

  // coming from the sheet music's 「듣기」: start that song as soon as the song lists are loaded
  const startedWith = useRef(false);
  const startMeasure = useRef<number | null>(null);
  const volTimer = useRef(0);
  useEffect(() => {
    if (!startWith || startedWith.current) return;
    if (startWith.book.id === EDITOR_BOOK_ID) {
      startedWith.current = true;
      startMeasure.current = startWith.measure ?? null;
      void start([{ book: startWith.book, h: startWith.h }], 0, true);
      return;
    }
    const bl = lists[startWith.book.id];
    const bk = books.find(b => b.id === startWith.book.id);
    if (!bl || !bk) return;
    startedWith.current = true;
    startMeasure.current = startWith.measure ?? null;
    const idx = Math.max(0, bl.findIndex(x => x.n === startWith.h.n));
    setBookId(bk.id);
    void start(bl.map(h => ({ book: bk, h })), idx, true);
  }, [startWith, lists, books, start]);

  useEffect(() => { const f = () => step(1, true); sp.onEnd = f; fp.onEnd = f; }, [sp, fp, step]);
  useEffect(() => { sp.speed = speed; fp.speed = speed; P().refresh(); }, [sp, fp, speed]);
  useEffect(() => { sp.instrument = sound === '' ? null : sound; sp.refresh(); }, [sp, sound]);
  useEffect(() => () => { token.current++; sp.stop(); fp.dispose(); }, [sp, fp]);

  // A-B repeat: the score player loops by itself, a recorded file is steered from the clock below
  const loopOn = loopA !== null && loopB !== null && loopB > loopA ? { a: loopA, b: loopB } : null;
  const loopRef = useRef(loopOn);
  loopRef.current = loopOn;
  useEffect(() => { sp.loop = loopOn; sp.refresh(); }, [sp, loopOn?.a, loopOn?.b]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLoopA(null); setLoopB(null); }, [cur?.book.id, cur?.h.n]);
  const markA = () => { const t = P().position; setLoopA(t); if (loopB !== null && loopB <= t + 0.5) setLoopB(null); };
  const markB = () => { const t = P().position; const a = loopA ?? 0; if (t <= a + 0.5) return; setLoopA(a); setLoopB(t); };
  const clearLoop = () => { setLoopA(null); setLoopB(null); };

  // progress clock
  useEffect(() => {
    const id = window.setInterval(() => {
      if (P().playing) {
        const l = loopRef.current;
        if (l && P() === fp && fp.position >= l.b) { fp.seek(l.a); setPos(l.a); return; }
        setPos(P().position);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [sp, fp]);

  const togglePlay = () => {
    engine.unlock();
    if (!pl) return;
    if (P().playing) { P().pause(); setPlaying(false); }
    else {
      setPlaying(true);
      metronome.unlock();
      const fromStart = P().position < 0.3 && metroRef.current.count > 0;
      void (async () => {
        if (fromStart) { setNote('카운트 인…'); await doCountIn(pl, speed); setNote(null); }
        await P().play();
        setPlaying(P().playing);
      })();
    }
  };

  // metronome clicks while playing: one per beat of the song (or of the hand-set tempo for audio files)
  useEffect(() => {
    if (!metro.on || !playing || !pl) return undefined;
    const pu = pulseFor(pl);
    const spd = speed;
    let lastK = Number.NEGATIVE_INFINITY;
    const id = window.setInterval(() => {
      const t = P().position;
      const k = Math.ceil((t - pu.anchor) / pu.period - 1e-6);
      if (k < lastK) lastK = k - 1;
      const delta = (pu.anchor + k * pu.period - t) / spd;
      const now = metronome.now();
      if (now === null || k === lastK || delta > 0.12 || delta < -0.02) return;
      const accent = ((k % pu.perBar) + pu.perBar) % pu.perBar === 0;
      metronome.clickAt(now + Math.max(0, delta), accent);
      lastK = k;
    }, 25);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metro.on, metro.bpm, playing, pl, speed, metronome]);

  const toggleMute = (i: number) => {
    const s = new Set(sp.muted);
    if (s.has(i)) s.delete(i); else s.add(i);
    sp.muted = s;
    setMuted([...s]);
    sp.refresh();
  };
  const toggleSolo = (i: number) => { sp.solo = sp.solo === i ? null : i; setSoloState(sp.solo); sp.refresh(); };
  const setVol = (i: number, v: number) => {
    const a = [...sp.vols]; while (a.length <= i) a.push(1); a[i] = v; sp.vols = a; setVolsState(a);
    if (sp.playing) { window.clearTimeout(volTimer.current); volTimer.current = window.setTimeout(() => sp.refresh(), 250); }   // re-start once the slider rests
  };

  // lock-screen / headset controls where the browser has them
  useEffect(() => {
    try {
      const ms = navigator.mediaSession;
      if (!ms || !cur) return;
      const art = coverOf(cur.book.id, cur.h.n);
      ms.metadata = new MediaMetadata({ title: cur.h.title, artist: cur.book.name, album: '나의 하모니', artwork: art ? [{ src: art, sizes: '640x640', type: 'image/jpeg' }] : [] });
      ms.setActionHandler('play', () => { void P().play().then(() => setPlaying(P().playing)); });
      ms.setActionHandler('pause', () => { P().pause(); setPlaying(false); });
      ms.setActionHandler('nexttrack', () => step(1, false));
      ms.setActionHandler('previoustrack', () => step(-1, false));
    } catch { /* not supported */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, arts, sp, fp, step]);

  // ---- list ----
  const book = books.find(b => b.id === bookId);
  const list = lists[bookId] ?? [];
  const sections = useMemo(() => {
    const c = new Map<string, number>();
    list.forEach(h => c.set(h.section, (c.get(h.section) ?? 0) + 1));
    return [...c.entries()];
  }, [list]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s+/g, '');
    return list.filter(h => {
      if (sec !== '전체' && h.section !== sec) return false;
      if (!t) return true;
      if (/^\d+$/.test(t)) return String(h.n).startsWith(t);
      return h.title.toLowerCase().replace(/\s+/g, '').includes(t) || (h.set ?? '').toLowerCase() === t;
    });
  }, [list, q, sec]);

  const addLinks = async (folder: boolean) => {
    const picked = await (folder ? pickLinkFolder() : pickLinkFiles());
    if (picked.length === 0) { setNote(folder ? '연결할 음원이 없거나 취소했어요.' : '취소했어요.'); return; }
    await addFiles(picked.map(p => p.file), picked.map(p => p.handle));
  };

  const addFiles = async (files: FileList | File[] | null, handles?: Parameters<typeof addTrack>[2][]) => {
    if (!files || files.length === 0) return;
    if (!handles) requestPersist();
    const list = Array.from(files);
    let added = 0, dup = 0, failed = 0, reason = '';
    for (let i = 0; i < list.length; i++) {
      setNote(`음원 추가 중… (${i + 1}/${list.length})`);
      try {
        const r = await addTrack(list[i], tracks.current, handles?.[i]);
        if (r === 'dup') dup++;
        else { tracks.current = [...tracks.current, r]; added++; }
      } catch (e) { failed++; reason = e instanceof Error ? e.message : ''; }
    }
    setLists(prev => ({ ...prev, mine: tracks.current.map(entryOf) }));
    setNote(`${added}곡을 추가했어요.${dup ? ` (이미 있는 ${dup}곡은 건너뜀)` : ''}${failed ? ` ${failed}곡은 저장하지 못했어요${/저장 공간|Quota/i.test(reason) ? ' — 저장 공간이 부족해요' : ''}.` : ''}`);
  };

  const dropTrack = async (h: HymnEntry) => {
    if (!window.confirm(`「${h.title}」을(를) 내 음원에서 지울까요?\n(기기의 원본 파일은 그대로예요)`)) return;
    if (cur && cur.book.id === 'mine' && cur.h.n === h.n) { token.current++; fp.stop(); setPlaying(false); setCur(null); setPl(null); }
    await removeTrack(h.n);
    tracks.current = tracks.current.filter(t => t.n !== h.n);
    setLists(prev => ({ ...prev, mine: tracks.current.map(entryOf) }));
    setNote('내 음원에서 지웠어요.');
  };

  const playFromList = (i: number) => { if (book) void start(shown.map(h => ({ book, h })), i, true); };

  // ---- lyric line that follows the music (only when the words could be matched to the notes) ----
  const cueLine = useMemo(() => {
    if (!pl || pl.cues.length === 0) return null;
    const cues = pl.cues;
    let lo = 0, hi = cues.length - 1, idx = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].t <= pos + 0.05) { idx = m; lo = m + 1; } else hi = m - 1; }
    const from = Math.max(0, idx - 5), to = Math.min(cues.length, idx + 9);
    const join = (a: string, b: string) => (/[가-힣]$/.test(a) || /^[가-힣]/.test(b) ? a + b : a + ' ' + b);
    const part = (s: number, e: number) => cues.slice(s, e).reduce((acc, c) => { const t = c.text === '_' ? '' : c.text; return acc ? join(acc, t) : t; }, '');
    return { before: part(from, idx), now: cues[idx].text === '_' ? '' : cues[idx].text, after: part(idx + 1, to) };
  }, [pl, pos]);

  const isAudio = cur?.book.format === 'audio';
  const div = isAudio ? 1 : speed;
  const total = pl?.total ? pl.total / div : 0;
  const shownPos = (scrub ?? pos) / div;
  const names = useMemo(() => {
    const n = pl?.partCount ?? 0;
    if (cur && cur.book.format !== 'nwc' && n === 4) return ['소프라노', '알토', '테너', '베이스'];
    return Array.from({ length: n }, (_, i) => partNames[i] || `파트 ${i + 1}`);
  }, [pl, partNames, cur]);

  // ---- layout pieces ----
  const lcdText = S.ink;
  const rowBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', textAlign: 'left', width: '100%', color: lcdText, background: 'transparent', border: 0, borderBottom: `1px solid ${S.line}`, cursor: 'pointer', font: 'inherit' };
  const chip = (on: boolean): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 999, border: `1px solid ${S.frame}`, background: on ? S.ink : 'transparent', color: on ? S.inkOn : lcdText, fontSize: 12, cursor: 'pointer' });
  const itemOf = (book: string, h: HymnEntry): PlItem => ({ book, n: h.n, title: h.title, section: h.section, ...(h.set ? { set: h.set } : {}) });
  const curPl = pls.find(p => p.id === plId);
  const addTo = (id: string | null) => {
    if (!addFor) return;
    let next = pls;
    let target = id;
    if (!target) {
      const name = window.prompt('새 재생목록 이름', '내 재생목록')?.trim();
      if (!name) return;
      target = `p${Date.now().toString(36)}`;
      next = [...next, { id: target, name, items: [] }];
    }
    const t = target;
    let dup = false;
    next = next.map(p => {
      if (p.id !== t) return p;
      if (p.items.some(x => x.book === addFor.book && x.n === addFor.n)) { dup = true; return p; }
      return { ...p, items: [...p.items, addFor] };
    });
    savePls(next);
    setNote(dup ? '이미 그 재생목록에 있어요.' : `「${next.find(p => p.id === t)?.name}」에 담았어요.`);
    setAddFor(null);
  };
  const playPl = (p: Playlist, from: number) => {
    const items = p.items.flatMap(x => { const b = books.find(bk => bk.id === x.book); return b ? [{ book: b, h: { n: x.n, title: x.title, section: x.section, parts: [], lyric: false, set: x.set } as HymnEntry }] : []; });
    if (items.length === 0) { setNote('재생할 수 있는 곡이 없어요.'); return; }
    void start(items, Math.min(from, items.length - 1), true);
  };
  const titleOfView = view === 'pls' ? '내 재생목록' : view === 'plsong' ? (curPl?.name ?? '재생목록') : view === 'books' ? '나의 하모니' : view === 'list' ? (book?.name ?? '') : view === 'now' ? '재생 중' : view === 'lyrics' ? '가사' : '옵션';

  const goBack = () => {
    if (view === 'list' || view === 'pls') setView('books');
    else if (view === 'plsong') setView('pls');
    else if (view === 'books') { if (cur) setView('now'); }
    else if (view === 'now') setView(bookId ? 'list' : 'books');
    else setView('now');
  };
  const cycle = () => setView(v => (v === 'now' ? 'lyrics' : v === 'lyrics' ? 'opts' : 'now'));

  const circle = (size: number): React.CSSProperties => ({ width: size, height: size, borderRadius: S.btnRadius, border: `1px solid ${S.btnBorder}`, background: S.btnBg, boxShadow: S.btnShadow, color: S.btnInk, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 });

  const addDialog = (
    <>
      {addFor && (
        <div role="dialog" aria-label="재생목록에 담기" onClick={() => setAddFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(94vw, 400px)', maxHeight: '70vh', overflowY: 'auto', background: S.page, color: S.pageInk, borderRadius: '16px 16px 0 0', padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>「{addFor.title}」 담기</div>
            {pls.map(p => <button key={p.id} onClick={() => addTo(p.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 8px', background: 'transparent', border: 0, borderBottom: '1px solid rgba(255,255,255,.15)', color: 'inherit', cursor: 'pointer', font: 'inherit' }}>{p.name} <span style={{ opacity: .6, fontSize: 12 }}>({p.items.length}곡)</span></button>)}
            <button onClick={() => addTo(null)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 8px', background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', font: 'inherit', fontWeight: 700 }}>＋ 새 재생목록 만들기</button>
          </div>
        </div>
      )}
    </>
  );
  const fileInputs = (
    <>
      <input ref={audioRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac" multiple hidden onChange={e => { void addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { void pickArt(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );

  if (ui === 'modern') {
    return (
      <>
        <HarmonyModern
          books={books} lists={lists} queue={queue} qi={qi} cur={cur} playing={playing} loading={loading} err={err} note={note}
          isAudio={!!isAudio} pos={shownPos} total={total} hasTrack={!!pl} speed={speed} repeat={repeat} shuffle={shuffle}
          lyricText={lyricText} cueLine={cueLine} coverOf={coverOf}
          start={(items, idx, goNow) => { void start(items, idx, goNow); }}
          togglePlay={togglePlay} step={step}
          seek={sec => { P().seek(sec); setPos(sec); }}
          setShuffle={setShuffle} setRepeat={setRepeat} setSpeed={setSpeed}
          pls={pls} playPl={playPl} openAdd={setAddFor} itemOf={itemOf}
          names={names} muted={muted} toggleMute={toggleMute} loopA={loopA} loopB={loopB} markA={markA} markB={markB} clearLoop={clearLoop} solo={solo} toggleSolo={toggleSolo} vols={vols} setVol={setVol} hasParts={!!pl && pl.partCount > 1}
          sound={sound} setSound={setSound} sounds={SOUNDS}
          chooseArt={chooseArt}
          mine={{ canLink: canLink(), canLinkFolder: canLinkFolder(), link: f => { void addLinks(f); }, copy: () => audioRef.current?.click(), drop: h => { void dropTrack(h); } }}
          onSwitchUi={() => chooseUi('retro')}
          onOpenScore={onOpenScore ? (b, h) => { token.current++; sp.stop(); fp.stop(); onOpenScore(b, h); } : undefined}
          metro={metro} setMetro={setMetro} songTempo={pl?.tempo ?? null} timeSig={`${pl?.beats ?? 4}/${pl?.beatType ?? 4}`}
          onExit={() => { token.current++; sp.stop(); fp.stop(); onExit(); }}
        />
        {addDialog}
        {fileInputs}
      </>
    );
  }

  return (
    <div role="dialog" aria-label="나의 하모니" style={{ position: 'fixed', inset: 0, zIndex: 70, overflowY: 'auto', background: S.page, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 12px 28px', color: S.pageInk, fontFamily: 'inherit' }}>
      <div style={{ width: 'min(94vw, 400px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, letterSpacing: 1 }}>나의 하모니</div>
        <span style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => chooseUi('modern')} aria-label="최신 플레이어 화면으로 바꾸기" style={{ background: 'rgba(255,255,255,.12)', color: 'inherit', border: 0, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>📱 최신</button>
        <button onClick={() => setSkinOpen(true)} aria-label="플레이어 스타일 바꾸기" style={{ background: 'rgba(255,255,255,.12)', color: 'inherit', border: 0, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>🎨 스타일</button>
        <button onClick={() => { token.current++; sp.stop(); fp.stop(); onExit(); }} style={{ background: 'rgba(255,255,255,.12)', color: 'inherit', border: 0, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>나가기</button>
        </span>
      </div>

      {/* body */}
      <div style={{ width: 'min(94vw, 400px)', borderRadius: S.bodyRadius, padding: '20px 18px 24px', position: 'relative', marginTop: S.deco === 'bunny' ? 104 : S.deco === 'deer' ? 70 : S.deco === 'cat' ? 54 : 0, background: skinImgs[S.id] ? `url(${skinImgs[S.id]}) center / cover no-repeat, ${S.body}` : S.body, boxShadow: S.bodyShadow, border: `1px solid ${S.bodyBorder}` }}>
        {S.deco && <Deco skin={S} />}
        {/* LCD */}
        <div style={{ height: 'min(54vh, 400px)', minHeight: 300, borderRadius: S.lcdRadius, border: S.lcdFrame, background: S.lcdBg, boxShadow: S.lcdShadow, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: lcdText, ...(S.mono ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' } : {}), ...(S.glow ? { textShadow: S.glow } : {}) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: S.head, borderBottom: `1px solid ${S.frame}`, fontSize: 13, fontWeight: 700 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOfView}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{playing ? '▶' : cur ? '❚❚' : ''}{repeat === 'one' ? ' 🔂' : repeat === 'all' ? ' 🔁' : ''}{shuffle ? ' 🔀' : ''}</span>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {err && <div style={{ margin: 10, fontSize: 13, color: '#8a1c1c' }}>{err}</div>}

            {view === 'books' && (
              <div>
                {books.map(b => (
                  <button key={b.id} onClick={() => { setBookId(b.id); setQ(''); setSec('전체'); setView('list'); }} style={{ ...rowBase, padding: '9px 10px' }}>
                    <Cover url={coverOf(b.id)} book={b.id} size={46} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{b.name}</span>
                      <span style={{ display: 'block', fontSize: 12, opacity: .7 }}>{lists[b.id] ? (b.id === 'mine' && lists[b.id].length === 0 ? '기기의 음원을 추가해 보세요' : `${lists[b.id].length}곡`) : '불러오는 중…'}</span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                ))}
                {books.length > 0 && (
                  <button onClick={() => setView('pls')} style={{ ...rowBase, padding: '9px 10px' }}>
                    <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: S.head, flex: 'none' }}>★</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>내 재생목록</span>
                      <span style={{ display: 'block', fontSize: 12, opacity: .7 }}>{pls.length ? `${pls.length}개` : '좋아하는 곡을 모아 보세요'}</span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                )}
                {books.length === 0 && !err && <div style={{ margin: 12, fontSize: 13 }}>불러오는 중…</div>}
              </div>
            )}

            {view === 'list' && (
              <div>
                <div style={{ display: 'flex', gap: 6, padding: 8, position: 'sticky', top: 0, background: S.sticky, borderBottom: `1px solid ${S.line}` }}>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="번호·제목 검색" inputMode="search" aria-label="검색" style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 6, border: `1px solid ${S.frame}`, background: S.input, color: lcdText, fontSize: 13 }} />
                  <select value={sec} onChange={e => setSec(e.target.value)} aria-label="분류" style={{ maxWidth: 110, padding: '5px 4px', borderRadius: 6, border: `1px solid ${S.frame}`, background: S.input, color: lcdText, fontSize: 12 }}>
                    <option value="전체">전체</option>
                    {sections.map(([s, c]) => <option key={s} value={s}>{s} ({c})</option>)}
                  </select>
                </div>
                {bookId === 'mine' && (
                  <>
                    {canLink() && <button onClick={() => void addLinks(false)} style={{ ...rowBase, fontWeight: 700, fontSize: 13 }}>＋ 원본 파일 연결 (복사 안 함)</button>}
                    {canLinkFolder() && <button onClick={() => void addLinks(true)} style={{ ...rowBase, fontWeight: 700, fontSize: 13 }}>＋ 폴더 통째로 연결</button>}
                    <button onClick={() => audioRef.current?.click()} style={{ ...rowBase, fontWeight: 700, fontSize: 13 }}>＋ {canLink() ? '복사해서 저장 (브라우저에 보관)' : '기기에서 음원 추가 (mp3 · m4a · wav …)'}</button>
                  </>
                )}
                {shown.length === 0 && <div style={{ margin: 12, fontSize: 13 }}>{list.length ? '찾는 곡이 없어요.' : bookId === 'mine' ? '아직 음원이 없어요. 위 버튼으로 추가해 보세요.' : '불러오는 중…'}</div>}
                {shown.length > 0 && (
                  <button onClick={() => playFromList(0)} style={{ ...rowBase, fontWeight: 700, fontSize: 13 }}>▶ 이 목록 처음부터 재생 ({shown.length}곡)</button>
                )}
                {shown.map((h, i) => {
                  const on = cur && cur.book.id === bookId && cur.h.n === h.n;
                  return (
                    <div key={h.n} style={{ display: 'flex', alignItems: 'stretch', background: on ? `${S.hi}` : 'transparent' }}>
                    <button onClick={() => playFromList(i)} style={{ ...rowBase, flex: 1, minWidth: 0, background: 'transparent' }}>
                      <span style={{ width: 34, textAlign: 'right', fontSize: 13, fontWeight: 700, flex: 'none' }}>{on ? '▶' : bookId === 'mine' ? i + 1 : h.n}</span>
                      {bookId === 'mine' && arts[artKeySong('mine', h.n)] && <Cover url={arts[artKeySong('mine', h.n)]} book="mine" size={30} />}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
                        <span style={{ display: 'block', fontSize: 11, opacity: .65 }}>{h.section}{h.set ? ` · ${h.set}` : ''}</span>
                      </span>
                    </button>
                    <button onClick={() => setAddFor(itemOf(bookId, h))} aria-label={`${h.title} 재생목록에 담기`} title="재생목록에 담기" style={{ border: 0, borderBottom: `1px solid ${S.line}`, background: 'transparent', color: lcdText, padding: '0 10px', cursor: 'pointer', fontSize: 16 }}>＋</button>
                    {bookId === 'mine' && <button onClick={() => void dropTrack(h)} aria-label={`${h.title} 지우기`} title="내 음원에서 지우기" style={{ border: 0, borderBottom: `1px solid ${S.line}`, background: 'transparent', color: lcdText, padding: '0 12px', cursor: 'pointer', fontSize: 16 }}>×</button>}
                    </div>
                  );
                })}
              </div>
            )}

            {view === 'pls' && (
              <div>
                <button onClick={() => { const name = window.prompt('새 재생목록 이름', '내 재생목록')?.trim(); if (name) savePls([...pls, { id: `p${Date.now().toString(36)}`, name, items: [] }]); }} style={{ ...rowBase, fontWeight: 700, fontSize: 13 }}>＋ 새 재생목록</button>
                {pls.length === 0 && <div style={{ margin: 12, fontSize: 13 }}>아직 없어요. 곡 목록의 ＋ 버튼이나 재생 화면의 「재생목록에 담기」로 모을 수 있어요.</div>}
                {pls.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'stretch' }}>
                    <button onClick={() => { setPlId(p.id); setView('plsong'); }} style={{ ...rowBase, flex: 1, minWidth: 0 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ display: 'block', fontSize: 11, opacity: .65 }}>{p.items.length}곡</span>
                      </span>
                    </button>
                    <button onClick={() => { const nm = window.prompt('이름 바꾸기', p.name)?.trim(); if (nm) savePls(pls.map(x => x.id === p.id ? { ...x, name: nm } : x)); }} aria-label={`${p.name} 이름 바꾸기`} title="이름 바꾸기" style={{ border: 0, borderBottom: `1px solid ${S.line}`, background: 'transparent', color: lcdText, padding: '0 10px', cursor: 'pointer', fontSize: 14 }}>✎</button>
                    <button onClick={() => { if (window.confirm(`「${p.name}」 재생목록을 지울까요? (곡 자체는 그대로예요)`)) savePls(pls.filter(x => x.id !== p.id)); }} aria-label={`${p.name} 지우기`} title="지우기" style={{ border: 0, borderBottom: `1px solid ${S.line}`, background: 'transparent', color: lcdText, padding: '0 12px', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {view === 'plsong' && curPl && (
              <div>
                {curPl.items.length === 0 && <div style={{ margin: 12, fontSize: 13 }}>비어 있어요. 곡 목록의 ＋ 버튼으로 담아 보세요.</div>}
                {curPl.items.length > 0 && <button onClick={() => playPl(curPl, 0)} style={{ ...rowBase, fontWeight: 700, fontSize: 13 }}>▶ 처음부터 재생 ({curPl.items.length}곡)</button>}
                {curPl.items.map((x, i) => {
                  const bn = books.find(b => b.id === x.book)?.name ?? x.book;
                  const on = cur && cur.book.id === x.book && cur.h.n === x.n;
                  return (
                    <div key={`${x.book}:${x.n}`} style={{ display: 'flex', alignItems: 'stretch', background: on ? S.hi : 'transparent' }}>
                      <button onClick={() => playPl(curPl, i)} style={{ ...rowBase, flex: 1, minWidth: 0, background: 'transparent' }}>
                        <span style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 700, flex: 'none' }}>{on ? '▶' : i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.title}</span>
                          <span style={{ display: 'block', fontSize: 11, opacity: .65 }}>{bn}{x.set ? ` · ${x.set}` : ''}</span>
                        </span>
                      </button>
                      <button disabled={i === 0} onClick={() => savePls(pls.map(p => { if (p.id !== curPl.id) return p; const a = [...p.items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...p, items: a }; }))} aria-label="위로" style={{ border: 0, borderBottom: `1px solid ${S.line}`, background: 'transparent', color: lcdText, padding: '0 8px', cursor: 'pointer', opacity: i === 0 ? .25 : 1 }}>▲</button>
                      <button onClick={() => savePls(pls.map(p => p.id === curPl.id ? { ...p, items: p.items.filter((_, k) => k !== i) } : p))} aria-label={`${x.title} 빼기`} title="재생목록에서 빼기" style={{ border: 0, borderBottom: `1px solid ${S.line}`, background: 'transparent', color: lcdText, padding: '0 12px', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}

            {view === 'now' && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                {!cur && <div style={{ fontSize: 13, marginTop: 40 }}>메뉴에서 곡을 골라 주세요.</div>}
                {cur && (
                  <>
                    <button onClick={() => chooseArt('song')} aria-label="앨범 아트 바꾸기" title="눌러서 앨범 아트 바꾸기" style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,.35)', borderRadius: 10 }}>
                      <Cover url={coverOf(cur.book.id, cur.h.n)} book={cur.book.id} size={150} title={cur.h.title} />
                    </button>
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isAudio ? '' : `${cur.h.n}. `}{cur.h.title}</div>
                      <div style={{ fontSize: 12, opacity: .75 }}>{isAudio ? cur.h.section : `${cur.book.name} · ${cur.h.section}`}{cur.h.set ? ` · ${cur.h.set}` : ''}</div>
                      {loading && <div style={{ fontSize: 12, marginTop: 2 }}>불러오는 중…</div>}
                      <button onClick={() => setAddFor(itemOf(cur.book.id, cur.h))} style={{ marginTop: 6, padding: '3px 12px', borderRadius: 999, border: `1px solid ${S.frame}`, background: 'transparent', color: lcdText, fontSize: 12, cursor: 'pointer' }}>★ 재생목록에 담기</button>
                      {!isAudio && onOpenScore && <button onClick={() => { token.current++; sp.stop(); fp.stop(); onOpenScore(cur.book, cur.h); }} style={{ marginTop: 6, marginLeft: 6, padding: '3px 12px', borderRadius: 999, border: `1px solid ${S.frame}`, background: 'transparent', color: lcdText, fontSize: 12, cursor: 'pointer' }}>악보 보기</button>}
                    </div>
                    <div style={{ width: '100%' }}>
                      <input type="range" min={0} max={Math.max(1, Math.round((pl?.total ?? 1) * 10))} value={Math.round((scrub ?? pos) * 10)} aria-label="재생 위치"
                        onChange={e => setScrub(Number(e.target.value) / 10)}
                        onPointerUp={() => { if (scrub !== null) { P().seek(scrub); setPos(scrub); setScrub(null); } }}
                        onKeyUp={() => { if (scrub !== null) { P().seek(scrub); setPos(scrub); setScrub(null); } }}
                        style={{ width: '100%', accentColor: S.ink }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span>{fmt(shownPos)}</span><span>-{fmt(Math.max(0, total - shownPos))}</span></div>
                      <LoopBar a={loopA} b={loopB} onA={markA} onB={markB} onClear={clearLoop} disabled={!pl} chip={chip} />
                    </div>
                  </>
                )}
              </div>
            )}

            {view === 'lyrics' && (
              <div style={{ padding: '10px 14px', fontSize: 15, lineHeight: 1.7 }}>
                {!cur && <div style={{ fontSize: 13 }}>재생 중인 곡이 없어요.</div>}
                {cur && cueLine && (
                  <div style={{ margin: '4px 0 12px', padding: '10px 8px', borderRadius: 8, background: `${S.hi}`, textAlign: 'center', fontSize: 18, fontWeight: 600, wordBreak: 'keep-all' }}>
                    <span style={{ opacity: .45 }}>{cueLine.before}</span>
                    <span style={{ background: S.ink, color: S.inkOn, borderRadius: 4, padding: '0 3px', margin: '0 1px' }}>{cueLine.now || '–'}</span>
                    <span>{cueLine.after}</span>
                  </div>
                )}
                {cur && lyricText && <div style={{ whiteSpace: 'pre-wrap' }}>{lyricText}</div>}
                {cur && !lyricText && <div style={{ fontSize: 13, opacity: .75 }}>{isAudio ? '내 음원은 가사를 보여 주지 않아요.' : '이 곡은 가사가 없어요.'}</div>}
              </div>
            )}

            {view === 'opts' && (
              <div style={{ padding: '10px 12px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>속도 ×{speed.toFixed(1)}</div>
                  <input type="range" min={0.5} max={1.5} step={0.1} value={speed} aria-label="속도" onChange={e => setSpeed(Number(e.target.value))} style={{ width: '100%', accentColor: S.ink }} />
                </div>
                {!isAudio && <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>소리</div>
                  <select value={sound} onChange={e => setSound(e.target.value as InstrumentName | '')} aria-label="소리" style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: `1px solid ${S.frame}`, background: S.input, color: lcdText }}>
                    {SOUNDS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>}
                {pl && pl.partCount > 1 && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>파트 믹서 <span style={{ fontWeight: 400, opacity: .7 }}>(단독 = 그 파트만, 슬라이더 = 음량)</span></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <PartMixer names={names} muted={muted} solo={solo} vols={vols} onMute={toggleMute} onSolo={toggleSolo} onVol={setVol} chip={chip} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => setShuffle(s => !s)} aria-pressed={shuffle} style={chip(shuffle)}>셔플</button>
                  <button onClick={() => setRepeat(r => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))} style={chip(repeat !== 'off')}>반복: {repeat === 'off' ? '끔' : repeat === 'all' ? '전체' : '한 곡'}</button>
                </div>
                {cur && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>앨범 아트 <span style={{ fontWeight: 400, opacity: .7 }}>(기기의 사진)</span></div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => chooseArt('song')} style={chip(false)}>이 곡 이미지 고르기</button>
                      <button onClick={() => chooseArt('book')} style={chip(false)}>「{cur.book.name}」 전체 이미지 고르기</button>
                      <button onClick={() => void clearArt('song')} style={chip(false)}>이 곡 이미지 지우기</button>
                      <button onClick={() => void clearArt('book')} style={chip(false)}>분류 이미지 지우기</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {note && <div style={{ padding: '4px 10px', fontSize: 12, background: `${S.hi}`, borderTop: `1px solid ${S.line}` }}>{note}</div>}
        </div>

        {/* buttons */}
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <button onClick={goBack} aria-label="메뉴 / 뒤로" title="메뉴 / 뒤로" style={circle(48)}><Ico d={I_MENU} /></button>
          <button onClick={() => step(-1, false)} aria-label="이전 곡" style={circle(52)}><Ico d={I_PREV} /></button>
          <button onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'} style={circle(68)}><Ico d={playing ? I_PAUSE : I_PLAY} size={30} /></button>
          <button onClick={() => step(1, false)} aria-label="다음 곡" style={circle(52)}><Ico d={I_NEXT} /></button>
          <button onClick={cycle} aria-label="화면 바꾸기 (재생 · 가사 · 옵션)" title="화면 바꾸기" style={circle(48)}><Ico d={I_VIEW} /></button>
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: S.label, letterSpacing: 2 }}>나의 하모니</div>
      </div>

      {addDialog}
      {skinOpen && (
        <div role="dialog" aria-label="플레이어 스타일" onClick={() => setSkinOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#17181d', color: '#e8eaf0', borderRadius: '18px 18px 0 0', padding: '14px 12px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
              <b>플레이어 스타일</b>
              <button onClick={() => setSkinOpen(false)} style={{ background: 'rgba(255,255,255,.12)', color: 'inherit', border: 0, borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>닫기</button>
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 4px 8px' }}>
              {SKINS.map(k => {
                const on = k.id === skinId;
                return (
                  <button key={k.id} onClick={() => chooseSkin(k.id)} aria-pressed={on} aria-label={`${k.name} 스타일`} style={{ flex: 'none', width: 104, background: 'transparent', border: 0, padding: 0, color: 'inherit', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ position: 'relative', marginTop: k.deco ? 34 : 0, height: 132, borderRadius: Math.min(k.bodyRadius, 24), padding: 9, background: skinImgs[k.id] ? `url(${skinImgs[k.id]}) center / cover no-repeat, ${k.body}` : k.body, border: `2px solid ${on ? '#ffd24a' : k.bodyBorder}`, boxShadow: on ? '0 0 0 2px #ffd24a' : k.bodyShadow, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      {k.deco && <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: 400, height: 0, transform: 'scale(.26)', transformOrigin: 'top left' }}><Deco skin={k} /></div>}
                      <div style={{ height: 58, borderRadius: Math.min(k.lcdRadius, 8), border: k.lcdFrame.replace(/\d+px/, '2px'), background: k.lcdBg, boxShadow: k.lcdShadow }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ width: 18, height: 18, borderRadius: k.btnRadius, background: k.btnBg, border: `1px solid ${k.btnBorder}` }} />
                        <span style={{ width: 28, height: 28, borderRadius: k.btnRadius, background: k.btnBg, border: `1px solid ${k.btnBorder}` }} />
                        <span style={{ width: 18, height: 18, borderRadius: k.btnRadius, background: k.btnBg, border: `1px solid ${k.btnBorder}` }} />
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: on ? 700 : 500, color: on ? '#ffd24a' : 'inherit' }}>{k.name}</div>
                    <div style={{ fontSize: 10, opacity: .6, lineHeight: 1.3 }}>{k.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {fileInputs}
    </div>
  );
}
