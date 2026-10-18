// Lyrics under the notes of one staff (the soprano of a hymn).
// Korean lyrics are sung one syllable per note, but a MIDI file has no slur information, so
// the syllables are "flowed" over the notes and the places where one syllable is held over
// several notes are marked by hand (`_`). Songs whose syllable count equals the note count
// are aligned automatically.

import type { Score } from './score';

/** A held syllable: the note has no text of its own and only continues the previous one. */
export const HOLD = '_';

/** Hangul syllables (one each), Latin words and numbers are what gets sung. */
export const tokenize = (s: string): string[] => s.match(/[가-힣]|[A-Za-z]+|[0-9]+/g) ?? [];

export interface ParsedLyrics {
  /** text of each numbered verse */
  verses: string[];
  /** the refrain that follows the first verse (a line like "(후렴)" starts it) */
  refrain: string;
}

export function parseLyricText(raw: string): ParsedLyrics {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const verses: string[][] = [];
  const refrain: string[] = [];
  let mode: 'none' | 'verse' | 'refrain' = 'none';
  let refrainDone = false;
  for (const line of lines) {
    const vm = /^\s*(\d+)\s*[.．]\s*(.*)$/.exec(line);
    if (vm) {
      verses.push(vm[2] ? [vm[2]] : []);
      mode = 'verse';
      if (refrain.length) refrainDone = true;
      continue;
    }
    if (/^\s*[(（][^()（）]{1,10}[)）]\s*$/.test(line)) {
      if (!refrainDone) mode = 'refrain';
      else mode = 'none';
      continue;
    }
    if (!line.trim()) continue;
    if (mode === 'verse') verses[verses.length - 1].push(line);
    else if (mode === 'refrain' && !refrainDone) refrain.push(line);
    else if (mode === 'none' && verses.length === 0) { verses.push([line]); mode = 'verse'; }
  }
  return { verses: verses.map(v => v.join('\n')), refrain: refrain.join('\n') };
}

export interface LyricOption { id: string; label: string; tokens: string[] }

/** The text pieces a user can flow onto the notes. */
export function lyricOptions(p: ParsedLyrics): LyricOption[] {
  const out: LyricOption[] = [];
  const ref = tokenize(p.refrain);
  p.verses.forEach((v, i) => {
    const t = tokenize(v);
    if (ref.length) out.push({ id: `v${i + 1}r`, label: `${i + 1}절 + 후렴`, tokens: [...t, ...ref] });
    out.push({ id: `v${i + 1}`, label: `${i + 1}절만`, tokens: t });
  });
  if (ref.length) out.push({ id: 'r', label: '후렴만', tokens: ref });
  if (p.verses.length > 1) {
    out.push({ id: 'all', label: '모든 절 (절마다 후렴 포함)', tokens: p.verses.flatMap(v => [...tokenize(v), ...ref]) });
    out.push({ id: 'allv', label: '모든 절 (후렴 없이)', tokens: p.verses.flatMap(v => tokenize(v)) });
  }
  return out;
}

// --- automatic alignment on a Score --------------------------------------------------------------

/**
 * Puts the lyrics under every part whose sung-note count equals a verse layout (only then it cannot be wrong;
 * a part with a different rhythm is left alone). Returns what was done, or null when no part matched.
 */
export function autoAlign(score: Score, raw: string): { label: string; parts: number[] } | null {
  const opts = lyricOptions(parseLyricText(raw));
  const done: number[] = [];
  let label = '';
  score.parts.forEach((part, pi) => {
    if (part.percussion) return;
    const sung: { lyric?: string }[] = [];
    let prevTie = false;
    for (const m of part.measures) for (const it of m.items) {
      if (it.kind === 'note') { if (!prevTie) sung.push(it); prevTie = !!it.tieNext; } else prevTie = false;
    }
    if (sung.length === 0 || sung.some(n => n.lyric)) return; // nothing to sing, or the file already has lyrics
    // longest text first: a song that plays every verse is the least likely to match by chance
    const hit = opts.find(o => o.tokens.length === sung.length);
    if (!hit) return;
    hit.tokens.forEach((t, i) => { sung[i].lyric = t; });
    done.push(pi);
    if (!label) label = hit.label;
  });
  return done.length ? { label, parts: done } : null;
}

// --- flowing lyrics on editor elements -------------------------------------------------------------

export interface LyricEl {
  id: string;
  x: number;
  y: number;
  staffIndex?: number;
  type: string;
  tie?: boolean;
  lyric?: string;
}

/** The notes of a staff that carry a syllable, in order: chords count once and tied notes continue the one before. */
export function singableNotes<T extends LyricEl>(els: T[], staff: number): T[] {
  const notes = els
    .filter(e => (e.staffIndex || 0) === staff && e.type.endsWith('_note'))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const out: T[] = [];
  let lastX = -1e9;
  let prev: T | null = null;
  for (const n of notes) {
    if (Math.abs(n.x - lastX) < 2) continue;          // another note of the same chord
    lastX = n.x;
    const continues = !!(prev && prev.tie && prev.y === n.y);
    prev = n;
    if (!continues) out.push(n);
  }
  return out;
}

export interface FlowResult {
  /** id -> new lyric (`null` removes it) */
  changes: Map<string, string | null>;
  /** index (in `order`) of the first note after the flowed text */
  end: number;
  usedTokens: number;
  leftoverTokens: number;
}

/**
 * Puts `tokens` on the notes from `start` on. Notes already marked as held (`_`) keep that mark and take no
 * syllable. `prevEnd` (the end of an earlier flow from the same note) lets stale syllables behind the new end be removed.
 */
export function flowLyrics(order: LyricEl[], start: number, tokens: string[], prevEnd?: number): FlowResult {
  const changes = new Map<string, string | null>();
  let t = 0;
  let i = start;
  for (; i < order.length; i++) {
    const el = order[i];
    if (el.lyric === HOLD) continue;
    if (t >= tokens.length) break;
    changes.set(el.id, tokens[t++]);
  }
  if (prevEnd !== undefined) {
    for (let k = i; k < Math.min(order.length, prevEnd); k++) {
      if (order[k].lyric && order[k].lyric !== HOLD) changes.set(order[k].id, null);
    }
  }
  return { changes, end: i, usedTokens: t, leftoverTokens: tokens.length - t };
}

/** Where the lyric line sits under a staff: below the staff, ledger lines and the lowest note. */
export function lyricBaseline(els: LyricEl[], staff: number): number {
  let low = 140;
  for (const e of els) if ((e.staffIndex || 0) === staff && e.type.endsWith('_note') && e.lyric) low = Math.max(low, e.y);
  return Math.max(196, low + 30);
}
