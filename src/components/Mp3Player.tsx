import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Plus, Trash2, Music, Search, Link2 } from 'lucide-react';
import { FilePlayer } from '../lib/audio/filePlayer';
import { addTrack, canLink, getTrackBlob, listTracks, pickLinkFiles, removeTrack, requestPersist, type TrackMeta } from '../lib/audio/trackStore';
import { artKeySong, getArt } from '../lib/audio/artStore';

type RepeatMode = 'off' | 'all' | 'one';
const SPEEDS = [0.5, 0.75, 0.9, 1, 1.1, 1.25];

const fmt = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * 연습 음원 플레이어: 기기에서 고른 mp3 등을 이 브라우저에만 저장해 두고 듣습니다.
 * 파트 연습용으로 구간 반복(A-B)과 재생 속도(음높이 유지)를 지원합니다. 아무것도 서버로 올라가지 않습니다.
 */
export default function Mp3Player() {
  const fp = useMemo(() => new FilePlayer(), []);
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [covers, setCovers] = useState<Record<number, string>>({});
  const [cur, setCur] = useState<number | null>(null); // track.n
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(0);
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [shuffle, setShuffle] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const loopRef = useRef<{ a: number | null; b: number | null }>({ a: null, b: null });
  const stateRef = useRef({ tracks, cur, repeat, shuffle });
  stateRef.current = { tracks, cur, repeat, shuffle };
  const loadSeq = useRef(0);

  useEffect(() => { loopRef.current = { a: loopA, b: loopB }; }, [loopA, loopB]);

  const refresh = useCallback(async () => {
    const list = await listTracks();
    setTracks(list);
    const urls: Record<number, string> = {};
    for (const t of list) {
      const b = await getArt(artKeySong('mine', t.n));
      if (b) urls[t.n] = URL.createObjectURL(b);
    }
    setCovers(old => { Object.values(old).forEach(u => URL.revokeObjectURL(u)); return urls; });
  }, []);

  useEffect(() => {
    void refresh();
    requestPersist();
    return () => { fp.dispose(); };
  }, [fp, refresh]);

  const curTrack = tracks.find(t => t.n === cur) ?? null;

  // position display + A-B repeat
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!fp.playing) return;
      const { a, b } = loopRef.current;
      if (a !== null && b !== null && fp.position >= b) fp.seek(a);
      setPos(fp.position);
    }, 100);
    return () => window.clearInterval(id);
  }, [fp]);

  const choose = useCallback((offset: 1 | -1, auto: boolean) => {
    const { tracks: ts, cur: c, repeat: rp, shuffle: sh } = stateRef.current;
    if (!ts.length) return null;
    const i = ts.findIndex(t => t.n === c);
    if (auto && rp === 'one' && i >= 0) return ts[i];
    if (sh && ts.length > 1) {
      let k = i;
      while (k === i) k = Math.floor(Math.random() * ts.length);
      return ts[k];
    }
    const nx = i + offset;
    if (nx >= ts.length) return auto && rp !== 'all' ? null : ts[0];
    if (nx < 0) return ts[ts.length - 1];
    return ts[nx];
  }, []);

  const loadAndPlay = useCallback(async (t: TrackMeta, autoplay = true) => {
    const seq = ++loadSeq.current;
    setMsg(null); setBusy(true);
    setLoopA(null); setLoopB(null);
    try {
      const blob = await getTrackBlob(t.n);
      if (!blob) throw new Error('음원 파일을 찾을 수 없어요. 다시 추가해 주세요.');
      const len = await fp.load(blob);
      if (seq !== loadSeq.current) return;
      setCur(t.n); setTotal(len); setPos(0);
      fp.setSpeed(speed);
      if (autoplay) {
        await fp.play(0);
        setPlaying(fp.playing);
        if (fp.blocked) setMsg('브라우저가 자동 재생을 막았어요. ▶ 버튼을 눌러 주세요.');
      } else setPlaying(false);
    } catch (e) {
      if (seq === loadSeq.current) { setMsg(e instanceof Error ? e.message : '재생하지 못했어요.'); setPlaying(false); }
    } finally {
      if (seq === loadSeq.current) setBusy(false);
    }
  }, [fp, speed]);

  // 곡이 끝나면 다음 곡
  useEffect(() => {
    fp.onEnd = () => {
      const nx = choose(1, true);
      if (nx) void loadAndPlay(nx); else setPlaying(false);
    };
  }, [fp, choose, loadAndPlay]);

  const toggle = async () => {
    if (!curTrack) { if (tracks[0]) await loadAndPlay(tracks[0]); return; }
    if (fp.playing) { fp.pause(); setPlaying(false); }
    else { await fp.play(); setPlaying(fp.playing); if (fp.blocked) setMsg('브라우저가 재생을 막았어요. 다시 눌러 주세요.'); }
  };
  const step = (o: 1 | -1) => { const t = choose(o, false); if (t) void loadAndPlay(t); };
  const seekTo = (s: number) => { fp.seek(s); setPos(s); };

  const changeSpeed = (v: number) => { setSpeed(v); fp.setSpeed(v); };
  const markA = () => { const p = fp.position; setLoopA(p); if (loopB !== null && loopB <= p) setLoopB(null); };
  const markB = () => {
    const p = fp.position;
    if (loopA === null) { setLoopA(0); setLoopB(p); return; }
    if (p <= loopA) { setLoopA(p); setLoopB(loopA); } else setLoopB(p);
  };

  const addFiles = async (files: File[], handles?: Parameters<typeof addTrack>[2][]) => {
    if (!files.length) return;
    setBusy(true); setMsg(null);
    let list = tracks;
    let added = 0, dup = 0, failed = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const r = await addTrack(files[i], list, handles?.[i]);
        if (r === 'dup') dup++; else { added++; list = [...list, r]; }
      } catch { failed++; }
    }
    await refresh();
    setBusy(false);
    setMsg([added ? `${added}곡을 추가했어요.` : '', dup ? `${dup}곡은 이미 있어요.` : '', failed ? `${failed}곡은 저장하지 못했어요 (저장 공간 확인).` : ''].filter(Boolean).join(' '));
  };

  const remove = async (t: TrackMeta) => {
    if (!window.confirm(`"${t.title}" 음원을 목록에서 지울까요?\n(이 기기에 저장된 복사본이 삭제됩니다)`)) return;
    if (t.n === cur) { fp.stop(); setPlaying(false); setCur(null); setTotal(0); setPos(0); }
    await removeTrack(t.n);
    await refresh();
  };

  // 잠금 화면·블루투스 이어폰 조작
  useEffect(() => {
    if (!('mediaSession' in navigator) || !curTrack) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: curTrack.title, artist: curTrack.artist || '동해교회 찬양대', album: curTrack.album || '연습 음원' });
      navigator.mediaSession.setActionHandler('play', () => { void toggle(); });
      navigator.mediaSession.setActionHandler('pause', () => { void toggle(); });
      navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
    } catch { /* optional */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curTrack?.n]);

  const shown = tracks.filter(t => {
    const q = query.trim().toLowerCase();
    return !q || `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q);
  });

  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">연습 음원</h1>
          <p className="text-xs text-gray-500 mt-1">음원은 이 기기(브라우저)에만 저장되고 서버로 올라가지 않습니다. 다른 기기에서는 따로 추가해 주세요.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileIn.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            <Plus className="w-4 h-4" /> 음원 추가
          </button>
          {canLink() && (
            <button
              onClick={async () => { const r = await pickLinkFiles(); await addFiles(r.map(x => x.file), r.map(x => x.handle)); }}
              disabled={busy}
              title="파일을 복사하지 않고 원본 위치를 연결합니다 (PC 크롬·엣지)"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" /> 원본 연결
            </button>
          )}
        </div>
        <input ref={fileIn} type="file" multiple hidden accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac"
          onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void addFiles(fs); }} />
      </div>

      {msg && <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">{msg}</div>}

      {/* 지금 재생 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 text-white flex items-center justify-center shrink-0 overflow-hidden">
            {curTrack && covers[curTrack.n] ? <img src={covers[curTrack.n]} alt="" className="w-full h-full object-cover" /> : <Music className="w-8 h-8 opacity-90" />}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-900 truncate">{curTrack ? curTrack.title : '재생할 음원을 고르세요'}</div>
            <div className="text-sm text-gray-500 truncate">{curTrack ? (curTrack.artist || curTrack.album || '내 음원') : `${tracks.length}곡`}</div>
          </div>
        </div>

        <div>
          <input
            type="range" min={0} max={Math.max(total, 0.1)} step={0.1} value={Math.min(pos, total || 0)}
            onChange={e => seekTo(Number(e.target.value))} disabled={!curTrack}
            aria-label="재생 위치" className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[11px] text-gray-500 tabular-nums"><span>{fmt(pos)}</span><span>{fmt(total)}</span></div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setShuffle(v => !v)} aria-pressed={shuffle} aria-label="셔플" className={`p-2 rounded-lg ${shuffle ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-50'}`}><Shuffle className="w-5 h-5" /></button>
          <button onClick={() => step(-1)} disabled={!tracks.length} aria-label="이전 곡" className="p-2 rounded-full text-gray-700 hover:bg-gray-100 disabled:opacity-40"><SkipBack className="w-6 h-6" /></button>
          <button onClick={() => void toggle()} disabled={!tracks.length || busy} aria-label={playing ? '일시정지' : '재생'} className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition">
            {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
          </button>
          <button onClick={() => step(1)} disabled={!tracks.length} aria-label="다음 곡" className="p-2 rounded-full text-gray-700 hover:bg-gray-100 disabled:opacity-40"><SkipForward className="w-6 h-6" /></button>
          <button
            onClick={() => setRepeat(r => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))}
            aria-label={`반복: ${repeat === 'off' ? '끔' : repeat === 'all' ? '전체' : '한 곡'}`}
            className={`p-2 rounded-lg ${repeat !== 'off' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-50'}`}
          >{repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}</button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 mr-1">구간 반복</span>
          <button onClick={markA} disabled={!curTrack} aria-label="구간 반복 시작 지점을 지금 위치로" className={chip(loopA !== null)}>A{loopA !== null ? ` ${fmt(loopA)}` : ''}</button>
          <button onClick={markB} disabled={!curTrack} aria-label="구간 반복 끝 지점을 지금 위치로" className={chip(loopB !== null)}>B{loopB !== null ? ` ${fmt(loopB)}` : ''}</button>
          {(loopA !== null || loopB !== null) && <button onClick={() => { setLoopA(null); setLoopB(null); }} className={chip(false)}>해제</button>}
          <span className="text-[11px] text-gray-400">{loopA !== null && loopB !== null ? '구간 반복 중' : loopA !== null ? 'B로 끝 지점을 정하세요' : '어려운 마디만 반복해서 연습해 보세요'}</span>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
            속도
            <select value={speed} onChange={e => changeSpeed(Number(e.target.value))} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white text-gray-700">
              {SPEEDS.map(v => <option key={v} value={v}>{v === 1 ? '보통 (1×)' : `${v}×`}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·가수·앨범 검색" aria-label="음원 검색" className="flex-1 text-sm outline-none bg-transparent" />
          <span className="text-xs text-gray-400">{shown.length}곡</span>
        </div>
        {tracks.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-gray-500">
            <Music className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            아직 음원이 없어요. <b>음원 추가</b>를 눌러 연습용 mp3를 골라 주세요.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
            {shown.map(t => {
              const on = t.n === cur;
              return (
                <li key={t.n} className={`flex items-center gap-3 px-4 py-2.5 ${on ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <button onClick={() => void loadAndPlay(t)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 text-white flex items-center justify-center shrink-0 overflow-hidden">
                      {covers[t.n] ? <img src={covers[t.n]} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium truncate ${on ? 'text-blue-700' : 'text-gray-900'}`}>{on && playing ? '▶ ' : ''}{t.title}</div>
                      <div className="text-[11px] text-gray-500 truncate">{t.linked ? '🔗 ' : ''}{t.artist || t.album || t.name}</div>
                    </div>
                  </button>
                  <button onClick={() => void remove(t)} aria-label={`${t.title} 삭제`} className="p-2 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
