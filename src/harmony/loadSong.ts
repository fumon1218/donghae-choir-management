// Loads one song (from Firestore) as a Score for the 찬송가 연습 player.
import { elementsToScore } from './score';
import type { LoadedSong } from './Harmony';
import { midiToScore, parseMidi } from './midi';
import { parseNWCTXT as parseNWCTXTText } from './nwctxt';
import { nwcBinaryToText } from './nwcbin';
import { closeSmallGaps } from './hymnMidi';
import { autoAlign } from './lyrics';
import { getBooks, getIndex, getSong, MONTHLY_ID, resolveMonthly } from '../lib/hymnData';
import type { HymnBook, HymnEntry } from '../lib/hymnData';


const GENERIC_PART_NAME = /^(staff|track|part)[\s_-]*\d*$/i;
const SATB = ['소프라노', '알토', '테너', '베이스'];
const MIDI_GRID = 12;

const PITCHES = [
  { name: '도6', y: 20, freq: 1046.50 },
  { name: '시5', y: 30, freq: 987.77 },
  { name: '라5', y: 40, freq: 880.00 },
  { name: '솔5', y: 50, freq: 783.99 },
  { name: '파5', y: 60, freq: 698.46 },
  { name: '미5', y: 70, freq: 659.25 },
  { name: '레5', y: 80, freq: 587.33 },
  { name: '도5', y: 90, freq: 523.25 },
  { name: '시4', y: 100, freq: 493.88 },
  { name: '라4', y: 110, freq: 440.00 },
  { name: '솔4', y: 120, freq: 392.00 },
  { name: '파4', y: 130, freq: 349.23 },
  { name: '미4', y: 140, freq: 329.63 },
  { name: '레4', y: 150, freq: 293.66 },
  { name: '도4', y: 160, freq: 261.63 },
  { name: '시3', y: 170, freq: 246.94 },
  { name: '라3', y: 180, freq: 220.00 },
];

const BASS_PITCHES = [
  { name: '미4', y: 20, freq: 329.63 },
  { name: '레4', y: 30, freq: 293.66 },
  { name: '도4', y: 40, freq: 261.63 },
  { name: '시3', y: 50, freq: 246.94 },
  { name: '라3', y: 60, freq: 220.00 },
  { name: '솔3', y: 70, freq: 196.00 },
  { name: '파3', y: 80, freq: 174.61 },
  { name: '미3', y: 90, freq: 164.81 },
  { name: '레3', y: 100, freq: 146.83 },
  { name: '도3', y: 110, freq: 130.81 },
  { name: '시2', y: 120, freq: 123.47 },
  { name: '라2', y: 130, freq: 110.00 },
  { name: '솔2', y: 140, freq: 98.00 },
  { name: '파2', y: 150, freq: 87.31 },
  { name: '미2', y: 160, freq: 82.41 },
  { name: '레2', y: 170, freq: 73.42 },
  { name: '도2', y: 180, freq: 65.41 },
];


export async function loadSong(book: HymnBook, h: HymnEntry): Promise<LoadedSong> {
  if (book.id === MONTHLY_ID) {
    const t = resolveMonthly(h.n);
    const rb = t && (await getBooks()).find(b => b.id === t.book);
    const rh = t && rb && (await getIndex(rb.id)).find(x => x.n === t.n);
    if (!rb || !rh) throw new Error('연결된 찬송가를 찾지 못했어요. 월별 찬송가의 연결 번호를 확인해 주세요.');
    return loadSong(rb, rh);
  }
  const files = await getSong(book.id, h.n);
  if (book.format === 'nwc') {
    if (!files.nwc) throw new Error('악보 파일이 없어요.');
    const parsed = parseNWCTXTText(await nwcBinaryToText(files.nwc, { writtenPitch: true }), { treble: PITCHES, bass: BASS_PITCHES });
    const names = (parsed.partNames ?? []).map(n => n || '');
    const score = elementsToScore({
      elements: parsed.elements, tempo: parsed.tempo ?? 100, timeSignature: parsed.timeSignature ?? '4/4',
      stavesCount: parsed.stavesCount, clefs: parsed.clefs, isAnacrusis: false,
      partInfo: names.map(name => ({ name })),
    });
    return { score, lyrics: null, partNames: names };
  }
  if (!files.mid) throw new Error('악보 파일이 없어요.');
  const score = midiToScore(closeSmallGaps(parseMidi(files.mid)), MIDI_GRID);
  const lyrics = h.lyric && files.txt ? files.txt.replace(/\r\n?/g, '\n').trim() : null;
  if (lyrics) autoAlign(score, lyrics);
  const names = score.parts.map(p => (GENERIC_PART_NAME.test((p.name ?? '').trim()) ? '' : p.name ?? ''));
  return { score, lyrics, partNames: !h.set && names.length === 4 && names.every(n => !n) ? SATB : names };
}
