// Read-only sheet music: draws a Score (the same model the player uses) as engraved-looking SVG.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { durationTicks, pitchToDiatonic, TPQ, type Clef, type Pitch, type Score, type ScoreItem, type ScorePart } from '../harmony/score';

const SP = 7; // distance between staff lines
const STAFF_H = SP * 4;
const INK = '#1a1a1a';

const BOTTOM_D: Record<Clef, number> = { treble: 30, bass: 18 }; // E4 / G2 sit on the bottom line
const SHARP_D = [35, 32, 36, 33, 30, 34, 31];  // F C G D A E B (treble)
const FLAT_D = [31, 34, 30, 33, 29, 32, 28];  // B E A D G C F (treble)

interface Placed { item: ScoreItem; onset: number; ticks: number; part: number }

interface MeasureLayout { w: number; xs: Map<number, number>; meter?: string }

function onsetsOf(part: ScorePart, mi: number) {
  let t = 0;
  return part.measures[mi].items.map(item => { const ticks = durationTicks(item.duration); const o = t; t += ticks; return { item, onset: o, ticks }; });
}

const gapW = (ticks: number) => 18 + 15 * Math.sqrt(Math.max(ticks, 6) / TPQ);

function layoutMeasure(score: Score, mi: number): MeasureLayout {
  const onsets = new Set<number>([0]);
  let total = 0;
  score.parts.forEach(p => {
    if (!p.measures[mi]) return;
    onsetsOf(p, mi).forEach(o => { onsets.add(o.onset); total = Math.max(total, o.onset + o.ticks); });
  });
  const sorted = [...onsets].sort((a, b) => a - b);
  const xs = new Map<number, number>();
  let x = 14;
  sorted.forEach((o, i) => {
    xs.set(o, x);
    const next = i + 1 < sorted.length ? sorted[i + 1] : Math.max(total, o + 6);
    x += gapW(next - o);
  });
  return { w: x + 4, xs, meter: score.parts[0]?.measures[mi]?.meter };
}

function keyGlyphs(fifths: number, clef: Clef) {
  const list = fifths > 0 ? SHARP_D.slice(0, fifths) : FLAT_D.slice(0, -fifths);
  return list.map(d => (clef === 'bass' ? d - 14 : d));
}

const yOf = (d: number, clef: Clef, top: number) => top + STAFF_H - (d - BOTTOM_D[clef]) * (SP / 2);

function Clefmark({ clef, top }: { clef: Clef; top: number }) {
  if (clef === 'treble') {
    return <text x={2} y={top + STAFF_H + 6} fontSize={46} fill={INK} fontFamily="'Noto Music','Bravura Text','Apple Symbols','Segoe UI Symbol',serif">𝄞</text>;
  }
  return <text x={2} y={top + STAFF_H - 3} fontSize={36} fill={INK} fontFamily="'Noto Music','Bravura Text','Apple Symbols','Segoe UI Symbol',serif">𝄢</text>;
}

function Rest({ base, x, top }: { base: string; x: number; top: number }) {
  const mid = top + SP * 2;
  switch (base) {
    case 'whole': return <rect x={x - 5} y={top + SP} width={10} height={SP / 2} fill={INK} />;
    case 'half': return <rect x={x - 5} y={mid - SP / 2} width={10} height={SP / 2} fill={INK} />;
    case 'quarter': return <path d={`M${x - 2} ${top + SP * 0.6} l5 5 l-5 5 l5 5 q-6 -1 -4 4`} stroke={INK} strokeWidth={1.8} fill="none" strokeLinejoin="round" />;
    default: {
      const n = base === 'eighth' ? 1 : base === 'sixteenth' ? 2 : 3;
      return <g stroke={INK} fill={INK} strokeWidth={1.3}>
        <line x1={x + 2} y1={top + SP * 0.9} x2={x - 2} y2={top + SP * 0.9 + 6 + (n - 1) * 4 + 8} />
        {Array.from({ length: n }, (_, i) => <circle key={i} cx={x - 1.5 + 0} cy={top + SP * 0.9 + 3 + i * 4} r={1.8} />)}
      </g>;
    }
  }
}

function drawPart(part: ScorePart, pi: number, mi: number, ml: MeasureLayout, x0: number, top: number, out: React.ReactNode[], showLyrics: boolean) {
  const m = part.measures[mi];
  if (!m) return;
  const clef = part.clef;
  const placed = onsetsOf(part, mi);
  const mid = BOTTOM_D[clef] + 4;
  // beam groups: consecutive short notes inside one beat
  const beamOf = new Map<number, number>();
  let g = -1; let lastBeat = -1; let prevIdx = -2;
  placed.forEach((p, i) => {
    const short = p.item.kind === 'note' && (p.item.duration.base === 'eighth' || p.item.duration.base === 'sixteenth' || p.item.duration.base === 'thirtysecond');
    if (!short) { prevIdx = -2; return; }
    const beat = Math.floor(p.onset / TPQ);
    if (prevIdx !== i - 1 || beat !== lastBeat) g++;
    beamOf.set(i, g); lastBeat = beat; prevIdx = i;
  });
  const groups = new Map<number, number[]>();
  beamOf.forEach((gi, i) => { const a = groups.get(gi) ?? []; a.push(i); groups.set(gi, a); });
  const single = new Set<number>();
  groups.forEach(a => { if (a.length < 2) single.add(a[0]); });
  const dirOf = (idx: number[]) => {
    const ds = idx.flatMap(i => [placed[i].item.pitch, ...(placed[i].item.also ?? [])].filter(Boolean).map(p => pitchToDiatonic(p as Pitch)));
    const avg = ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length);
    return avg >= mid ? 'down' : 'up';
  };
  const stem = new Map<number, { x: number; y1: number; y2: number; dir: 'up' | 'down' }>();
  const keyP = `${pi}-${mi}`;

  placed.forEach((p, i) => {
    const x = x0 + (ml.xs.get(p.onset) ?? 14);
    const it = p.item;
    if (it.kind === 'rest' || !it.pitch) {
      out.push(<Rest key={`r${keyP}-${i}`} base={it.duration.base} x={x} top={top} />);
      return;
    }
    const pitches = [it.pitch, ...(it.also ?? [])];
    const ds = pitches.map(pt => pitchToDiatonic(pt));
    const ys = ds.map(d => yOf(d, clef, top));
    const gi = beamOf.get(i);
    const dir = gi !== undefined && !single.has(i) ? dirOf(groups.get(gi)!) : dirOf([i]);
    const filled = it.duration.base !== 'whole' && it.duration.base !== 'half';
    // ledger lines
    const lo = Math.min(...ds); const hi = Math.max(...ds);
    for (let d = BOTTOM_D[clef] - 2; d >= lo; d -= 2) out.push(<line key={`ll${keyP}-${i}-${d}`} x1={x - 8} x2={x + 8} y1={yOf(d, clef, top)} y2={yOf(d, clef, top)} stroke={INK} strokeWidth={1} />);
    for (let d = BOTTOM_D[clef] + 10; d <= hi; d += 2) out.push(<line key={`lh${keyP}-${i}-${d}`} x1={x - 8} x2={x + 8} y1={yOf(d, clef, top)} y2={yOf(d, clef, top)} stroke={INK} strokeWidth={1} />);
    pitches.forEach((pt, k) => {
      const y = ys[k];
      out.push(<ellipse key={`n${keyP}-${i}-${k}`} cx={x} cy={y} rx={5} ry={3.6} transform={`rotate(-20 ${x} ${y})`} fill={filled ? INK : '#fff'} stroke={INK} strokeWidth={filled ? 0 : 1.4} />);
      if (k === 0 && it.show) {
        const sym = it.show === 'sharp' ? '♯' : it.show === 'flat' ? '♭' : '♮';
        out.push(<text key={`a${keyP}-${i}`} x={x - 15} y={y + 5} fontSize={15} fill={INK}>{sym}</text>);
      } else if (k > 0 && pt.alter !== 0 && it.show) { /* chord accidentals follow the first */ }
      if (it.duration.dotted) out.push(<circle key={`d${keyP}-${i}-${k}`} cx={x + 9} cy={y - (Math.round((y - top) / (SP / 2)) % 2 === 0 ? 2.5 : 0)} r={1.5} fill={INK} />);
    });
    if (it.tieNext) {
      const y = dir === 'up' ? Math.max(...ys) + 5 : Math.min(...ys) - 5;
      out.push(<path key={`t${keyP}-${i}`} d={`M${x + 3} ${y} q10 ${dir === 'up' ? 7 : -7} 20 0`} stroke={INK} strokeWidth={1.2} fill="none" />);
    }
    if (it.duration.base !== 'whole') {
      const sx = dir === 'up' ? x + 4.6 : x - 4.6;
      const yTop = Math.min(...ys); const yBot = Math.max(...ys);
      const y1 = dir === 'up' ? yBot : yTop;
      const y2 = dir === 'up' ? yTop - 26 : yBot + 26;
      stem.set(i, { x: sx, y1, y2, dir });
    }
    if (showLyrics && it.lyric && it.lyric !== '_') {
      out.push(<text key={`ly${keyP}-${i}`} x={x} y={top + STAFF_H + 24} fontSize={11} textAnchor="middle" fill={INK}>{it.lyric}</text>);
    }
  });

  // stems, flags and beams
  groups.forEach((idx, gi) => {
    if (idx.length < 2) return;
    const st = idx.map(i => stem.get(i)!);
    const dir = st[0].dir;
    const end = dir === 'up' ? Math.min(...st.map(s => s.y2)) : Math.max(...st.map(s => s.y2));
    st.forEach((s, k) => out.push(<line key={`s${keyP}-${gi}-${k}`} x1={s.x} x2={s.x} y1={s.y1} y2={end} stroke={INK} strokeWidth={1.2} />));
    const x1 = st[0].x; const x2 = st[st.length - 1].x;
    const levels = Math.max(...idx.map(i => (placed[i].item.duration.base === 'eighth' ? 1 : placed[i].item.duration.base === 'sixteenth' ? 2 : 3)));
    for (let l = 0; l < levels; l++) {
      const off = (dir === 'up' ? 1 : -1) * l * 4;
      out.push(<line key={`b${keyP}-${gi}-${l}`} x1={x1} x2={x2 + 0} y1={end + off} y2={end + off} stroke={INK} strokeWidth={3} />);
    }
  });
  stem.forEach((s, i) => {
    const bi = beamOf.get(i);
    const grouped = bi !== undefined && !single.has(i);
    if (grouped) return;
    out.push(<line key={`s${keyP}-${i}`} x1={s.x} x2={s.x} y1={s.y1} y2={s.y2} stroke={INK} strokeWidth={1.2} />);
    const base = placed[i].item.duration.base;
    const flags = base === 'eighth' ? 1 : base === 'sixteenth' ? 2 : base === 'thirtysecond' ? 3 : 0;
    for (let f = 0; f < flags; f++) {
      const yy = s.y2 + (s.dir === 'up' ? 1 : -1) * f * 5;
      out.push(<path key={`f${keyP}-${i}-${f}`} d={s.dir === 'up' ? `M${s.x} ${yy} q8 6 5 15` : `M${s.x} ${yy} q8 -6 5 -15`} stroke={INK} strokeWidth={1.6} fill="none" />);
    }
  });
}

function Bar({ x, top, bottom, kind }: { x: number; top: number; bottom: number; kind?: string }) {
  const thick = kind === 'final' || kind === 'repeat_end' || kind === 'repeat_start';
  return <g>
    <line x1={x} x2={x} y1={top} y2={bottom} stroke={INK} strokeWidth={thick ? 1 : 1.2} />
    {kind === 'double' && <line x1={x - 3} x2={x - 3} y1={top} y2={bottom} stroke={INK} strokeWidth={1} />}
    {thick && <line x1={x - 3.5} x2={x - 3.5} y1={top} y2={bottom} stroke={INK} strokeWidth={3} />}
    {kind === 'repeat_end' && [1.5, 2.5].map(k => <circle key={k} cx={x - 9} cy={top + SP * k} r={1.6} fill={INK} />)}
  </g>;
}

export default function ScoreViewer({ score, title, subtitle, onClose, closeLabel = '닫기' }: {
  score: Score; title: string; subtitle?: string; onClose: () => void; closeLabel?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(360);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const f = () => setCw(el.clientWidth);
    f();
    const ro = new ResizeObserver(f); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const W = Math.max(300, (cw - 12) / zoom);
  const layout = useMemo(() => {
    const nM = Math.max(0, ...score.parts.map(p => p.measures.length));
    const mls = Array.from({ length: nM }, (_, i) => layoutMeasure(score, i));
    const parts = score.parts.filter(p => !p.percussion);
    const sets = parts.length ? parts : score.parts;
    const headW = (first: boolean) => 34 + Math.abs(score.fifths) * 8 + (first ? 22 : 0);
    const systems: { from: number; to: number; scale: number; first: boolean }[] = [];
    let i = 0;
    while (i < nM) {
      const first = i === 0;
      const avail = W - 12 - headW(first);
      let j = i; let used = 0;
      while (j < nM && (j === i || used + mls[j].w <= avail)) { used += mls[j].w; j++; }
      const last = j >= nM;
      systems.push({ from: i, to: j, scale: last && used < avail * 0.6 ? 1 : avail / used, first });
      i = j;
    }
    return { mls, systems, sets };
  }, [score, W]);

  const sysGap = 26;
  const partGap = 44; // staff + lyrics line
  // lyrics are printed once, under the first part that has them
  const lyricPart = layout.sets.findIndex(p => p.measures.some(m => m.items.some(i => i.lyric && i.lyric !== '_')));
  const rowHs = layout.sets.map((_, i) => STAFF_H + (i === lyricPart ? 34 : 22));
  const rowTops = rowHs.map((_, i) => rowHs.slice(0, i).reduce((a, b) => a + b, 0));
  const sysH = rowHs.reduce((a, b) => a + b, 0) + 4;
  void partGap;
  const nodes: React.ReactNode[] = [];
  let y = 24;
  layout.systems.forEach((s, si) => {
    const sysTop = y;
    const hw = 12 + (s.first ? 0 : 0);
    const head = 34 + Math.abs(score.fifths) * 8 + (s.first ? 22 : 0);
    layout.sets.forEach((part, pi) => {
      const top = sysTop + rowTops[pi] + 12;
      for (let k = 0; k < 5; k++) nodes.push(<line key={`sl${si}-${pi}-${k}`} x1={hw} x2={W - 6} y1={top + k * SP} y2={top + k * SP} stroke={INK} strokeWidth={0.9} />);
      nodes.push(<g key={`cl${si}-${pi}`} transform={`translate(${hw})`}><Clefmark clef={part.clef} top={top} /></g>);
      keyGlyphs(score.fifths, part.clef).forEach((d, k) => nodes.push(
        <text key={`k${si}-${pi}-${k}`} x={hw + 26 + k * 8} y={yOf(d, part.clef, top) + 5} fontSize={14} fill={INK}>{score.fifths > 0 ? '♯' : '♭'}</text>));
      if (s.first) {
        const meter = part.measures[0]?.meter ?? `${score.beats}/${score.beatType}`;
        const [a, b] = meter.split('/');
        const tx = hw + 28 + Math.abs(score.fifths) * 8;
        nodes.push(<g key={`ts${si}-${pi}`} fill={INK} fontWeight={700} fontSize={16} textAnchor="middle" fontFamily="serif">
          <text x={tx} y={top + SP * 2 - 1}>{a}</text><text x={tx} y={top + STAFF_H - 1}>{b}</text></g>);
      }
      if (si === 0 && part.leadingRepeat) nodes.push(<Bar key={`lr${pi}`} x={hw + head - 4} top={top} bottom={top + STAFF_H} kind="repeat_start" />);
      let x = hw + head;
      for (let mi = s.from; mi < s.to; mi++) {
        const ml = layout.mls[mi];
        const mm = { ...ml, w: ml.w * s.scale, xs: new Map([...ml.xs].map(([k, v]) => [k, v * s.scale])) };
        drawPart(part, pi, mi, mm, x, top, nodes, pi === lyricPart);
        const pm = part.measures[mi];
        nodes.push(<Bar key={`bar${si}-${pi}-${mi}`} x={x + mm.w} top={top} bottom={top + STAFF_H} kind={pm?.end} />);
        if (pm?.chords?.length) pm.chords.forEach((c, ci) => nodes.push(<text key={`ch${si}-${pi}-${mi}-${ci}`} x={x + 14 * s.scale + (c.beat * TPQ / TPQ) * 28} y={top - 6} fontSize={11} fontWeight={700} fill="#444">{c.text}</text>));
        if (mi === s.from && s.first && mi === 0) { /* measure numbers are left out on purpose */ }
        x += mm.w;
      }
    });
    if (layout.sets.length > 1) {
      const t0 = sysTop + 12; const t1 = sysTop + rowTops[layout.sets.length - 1] + 12 + STAFF_H;
      nodes.push(<line key={`bl${si}`} x1={hw} x2={hw} y1={t0} y2={t1} stroke={INK} strokeWidth={1.6} />);
    }
    nodes.push(<text key={`mn${si}`} x={2} y={sysTop + 9} fontSize={9} fill="#888">{s.from + 1}</text>);
    y = sysTop + sysH + sysGap;
  });

  return (
    <div role="dialog" aria-label="악보 보기" style={{ position: 'fixed', inset: 0, zIndex: 75, background: '#f7f4ec', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #ddd' }}>
        <button onClick={onClose} style={{ border: '1px solid #bbb', borderRadius: 8, padding: '6px 12px', background: '#fff', cursor: 'pointer' }}>← {closeLabel}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#777' }}>{subtitle}</div>}
        </div>
        <button aria-label="작게" onClick={() => setZoom(z => Math.max(0.6, +(z - 0.15).toFixed(2)))} style={{ border: '1px solid #bbb', borderRadius: 8, width: 34, height: 34, background: '#fff' }}>−</button>
        <button aria-label="크게" onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))} style={{ border: '1px solid #bbb', borderRadius: 8, width: 34, height: 34, background: '#fff' }}>+</button>
      </div>
      <div ref={wrap} style={{ flex: 1, overflow: 'auto', padding: '4px 6px 40px' }}>
        <svg width={W * zoom} height={(y + 10) * zoom} viewBox={`0 0 ${W} ${y + 10}`} style={{ display: 'block', background: '#fff', borderRadius: 6, boxShadow: '0 1px 6px rgba(0,0,0,.12)' }}>
          {nodes}
        </svg>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#999', marginTop: 8 }}>보기 전용 · 재생 중인 음원은 플레이어에서 들을 수 있어요</p>
      </div>
    </div>
  );
}
