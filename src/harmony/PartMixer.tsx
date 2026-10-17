import type { CSSProperties } from 'react';

interface Props {
  names: string[];
  muted: number[];
  solo: number | null;
  vols: number[];
  onMute: (i: number) => void;
  onSolo: (i: number) => void;
  onVol: (i: number, v: number) => void;
  chip: (on: boolean) => CSSProperties;
  accent?: string;
}

/** One row per part: on/off, solo (「내 파트만」) and volume. Shared by both 나의 하모니 looks. */
export default function PartMixer({ names, muted, solo, vols, onMute, onSolo, onVol, chip, accent }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {names.map((n, i) => {
        const silent = solo !== null ? solo !== i : muted.includes(i);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(56px,1fr) auto auto minmax(80px,1.4fr)', gap: 8, alignItems: 'center', opacity: silent ? .55 : 1 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span>
            <button onClick={() => onMute(i)} aria-pressed={!muted.includes(i)} aria-label={`${n} 소리 ${muted.includes(i) ? '켜기' : '끄기'}`} style={chip(!muted.includes(i))}>{muted.includes(i) ? '꺼짐' : '켜짐'}</button>
            <button onClick={() => onSolo(i)} aria-pressed={solo === i} aria-label={`${n}만 듣기`} style={chip(solo === i)}>단독</button>
            <input type="range" min={0} max={150} step={5} value={Math.round((vols[i] ?? 1) * 100)}
              onChange={e => onVol(i, Number(e.target.value) / 100)} aria-label={`${n} 음량`}
              style={{ width: '100%', accentColor: accent }} />
          </div>
        );
      })}
    </div>
  );
}
