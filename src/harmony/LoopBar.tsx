import type { CSSProperties } from 'react';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Props {
  a: number | null;
  b: number | null;
  onA: () => void;
  onB: () => void;
  onClear: () => void;
  disabled?: boolean;
  chip: (on: boolean) => CSSProperties;
}

/** A-B repeat controls: 「A」 marks the start at the current position, 「B」 the end; the part in between loops. */
export default function LoopBar({ a, b, onA, onB, onClear, disabled, chip }: Props) {
  const active = a !== null && b !== null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
      <button onClick={onA} disabled={disabled} aria-label="구간 반복 시작 지점을 지금 위치로" style={chip(a !== null)}>A{a !== null ? ` ${fmt(a)}` : ''}</button>
      <button onClick={onB} disabled={disabled} aria-label="구간 반복 끝 지점을 지금 위치로" style={chip(b !== null)}>B{b !== null ? ` ${fmt(b)}` : ''}</button>
      {(a !== null || b !== null) && <button onClick={onClear} style={chip(false)}>반복 해제</button>}
      <span style={{ opacity: .7 }}>{active ? '구간 반복 중' : a !== null ? 'B를 눌러 끝 지점을 정하세요' : '구간 반복'}</span>
    </div>
  );
}
