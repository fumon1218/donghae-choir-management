// 찬송가·은혜찬송가·합주곡 자료는 Firestore에 있습니다 (로그인한 사용자만 읽기, 대장·지휘자만 쓰기).
//   hymn_meta/collections        { json }  책 목록
//   hymn_meta/index_<책 id>       { json }  책별 곡 목록
//   hymn_songs/<책 id>_<번호>      { mid?, nwc?, txt?, p1..pN? }  곡 파일 (mid·nwc·pN 은 Bytes)
// 저장소(공개)에는 자료 파일을 두지 않습니다.

import { Bytes, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface HymnEntry {
  n: number;
  title: string;
  section: string;
  /** which `_N.mid` single-part files exist */
  parts: number[];
  lyric: boolean;
  /** ensemble line-up, e.g. AATT (합주곡 only) */
  set?: string;
}

export interface HymnBook {
  id: string;
  name: string;
  /** file name prefix (default `m`) */
  prefix?: string;
  /** `nwc`: each song is one binary NoteWorthy file instead of MIDI; `audio`: the user's own tracks */
  format?: 'nwc' | 'audio';
}

export interface SongFiles {
  mid?: Uint8Array;
  nwc?: Uint8Array;
  txt?: string;
  /** single-part MIDI files by part number */
  parts: Record<number, Uint8Array>;
}

export const songDocId = (bookId: string, n: number) => `${bookId}_${n}`;

// ---- small cache so that opening the player again does not read the same documents again ----
const LS = 'hymn_cache_v1:';
const readLS = <T,>(key: string): T | null => {
  try { const v = localStorage.getItem(LS + key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
};
const writeLS = (key: string, value: unknown) => {
  try { localStorage.setItem(LS + key, JSON.stringify(value)); } catch { /* cache is optional */ }
};

let booksP: Promise<HymnBook[]> | null = null;
const indexP = new Map<string, Promise<HymnEntry[]>>();
const songP = new Map<string, Promise<SongFiles>>();

/** Clears what was read so far (after the conductor uploaded new files). */
export function resetHymnCache() {
  booksP = null; indexP.clear(); songP.clear();
  try { Object.keys(localStorage).filter(k => k.startsWith(LS)).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
}

const readJson = async <T,>(path: [string, string]): Promise<T | null> => {
  const snap = await getDoc(doc(db, path[0], path[1]));
  if (!snap.exists()) return null;
  const json = snap.get('json');
  return typeof json === 'string' ? (JSON.parse(json) as T) : null;
};

export function getBooks(): Promise<HymnBook[]> {
  if (!booksP) {
    booksP = (async () => {
      const cached = readLS<HymnBook[]>('books');
      if (cached) return cached;
      const v = await readJson<HymnBook[]>(['hymn_meta', 'collections']);
      if (!v) throw new Error('찬송가 자료가 아직 올라와 있지 않아요. 지휘자님께 자료 올리기를 요청해 주세요.');
      writeLS('books', v);
      return v;
    })();
    booksP.catch(() => { booksP = null; });
  }
  return booksP;
}

export function getIndex(bookId: string): Promise<HymnEntry[]> {
  let p = indexP.get(bookId);
  if (!p) {
    p = (async () => {
      const cached = readLS<HymnEntry[]>(`index_${bookId}`);
      if (cached) return cached;
      const v = await readJson<HymnEntry[]>(['hymn_meta', `index_${bookId}`]);
      if (!v) throw new Error('곡 목록을 찾지 못했어요.');
      writeLS(`index_${bookId}`, v);
      return v;
    })();
    indexP.set(bookId, p);
    p.catch(() => indexP.delete(bookId));
  }
  return p;
}

export function getSong(bookId: string, n: number): Promise<SongFiles> {
  const id = songDocId(bookId, n);
  let p = songP.get(id);
  if (!p) {
    p = (async () => {
      const snap = await getDoc(doc(db, 'hymn_songs', id));
      if (!snap.exists()) throw new Error('악보 파일을 불러오지 못했어요 (자료에 없는 곡이에요).');
      const bytes = (f: string): Uint8Array | undefined => {
        const v = snap.get(f);
        return v instanceof Bytes ? v.toUint8Array() : undefined;
      };
      const parts: Record<number, Uint8Array> = {};
      const data = snap.data() ?? {};
      for (const k of Object.keys(data)) {
        const m = /^p(\d+)$/.exec(k);
        const b = m ? bytes(k) : undefined;
        if (m && b) parts[Number(m[1])] = b;
      }
      const txt = snap.get('txt');
      return { mid: bytes('mid'), nwc: bytes('nwc'), txt: typeof txt === 'string' ? txt : undefined, parts };
    })();
    songP.set(id, p);
    p.catch(() => songP.delete(id));
  }
  return p;
}

// ---------------------------------------------------------------------------
// Upload (conductor): turns the files of the sheet-music app's `public/hymns` folder into documents.
// ---------------------------------------------------------------------------

export interface UploadFile { path: string; size: number; read: () => Promise<ArrayBuffer> }

export interface UploadPlan {
  books: HymnBook[];
  indexes: Record<string, string>;
  /** one entry per song document */
  songs: { id: string; bookId: string; n: number; files: { field: string; kind: 'bytes' | 'text'; file: UploadFile }[] }[];
  warnings: string[];
}

/** Firestore holds 1 MiB per document; stay well below it. */
export const MAX_DOC_BYTES = 900 * 1024;

/**
 * Groups the picked files (anything under a `hymns` folder, or the folder's own contents) into documents.
 * Pure function: no network, so it can be checked before anything is written.
 */
export async function planUpload(files: UploadFile[]): Promise<UploadPlan> {
  const rel = (p: string) => {
    const parts = p.split('/').filter(Boolean);
    const i = parts.lastIndexOf('hymns');
    return i >= 0 ? parts.slice(i + 1) : parts.slice(1); // picked "hymns" itself → first segment is its name
  };
  const byPath = new Map<string, UploadFile>();
  files.forEach(f => byPath.set(rel(f.path).join('/'), f));
  const warnings: string[] = [];
  const text = async (f?: UploadFile) => (f ? new TextDecoder('utf-8').decode(await f.read()) : null);

  const colText = await text(byPath.get('collections.json'));
  if (!colText) throw new Error('hymns 폴더의 collections.json을 찾지 못했어요. 악보 앱의 public/hymns 폴더를 골라 주세요.');
  const books: HymnBook[] = JSON.parse(colText);

  const indexes: Record<string, string> = {};
  const songs: UploadPlan['songs'] = [];
  for (const b of books) {
    const idx = await text(byPath.get(`${b.id}/index.json`));
    if (!idx) { warnings.push(`${b.name}: index.json이 없어 건너뜁니다.`); continue; }
    indexes[b.id] = idx;
    const entries: HymnEntry[] = JSON.parse(idx);
    const prefix = b.prefix ?? 'm';
    for (const e of entries) {
      const base = `${b.id}/${prefix}${String(e.n).padStart(3, '0')}`;
      const fl: UploadPlan['songs'][number]['files'] = [];
      const add = (field: string, kind: 'bytes' | 'text', path: string) => {
        const f = byPath.get(path);
        if (f) fl.push({ field, kind, file: f });
      };
      if (b.format === 'nwc') add('nwc', 'bytes', `${base}.nwc`);
      else {
        add('mid', 'bytes', `${base}.mid`);
        e.parts?.forEach(pn => add(`p${pn}`, 'bytes', `${base}_${pn}.mid`));
        if (e.lyric) add('txt', 'text', `${base}.txt`);
      }
      if (!fl.length) { warnings.push(`${b.name} ${e.n}번 ${e.title}: 파일이 없어 건너뜁니다.`); continue; }
      const total = fl.reduce((a, x) => a + x.file.size, 0);
      if (total > MAX_DOC_BYTES) { warnings.push(`${b.name} ${e.n}번 ${e.title}: 파일이 너무 커서(${Math.round(total / 1024)}KB) 건너뜁니다.`); continue; }
      songs.push({ id: songDocId(b.id, e.n), bookId: b.id, n: e.n, files: fl });
    }
  }
  return { books, indexes, songs, warnings };
}

/** Writes the plan. `onProgress(done, total)` is called after every song. */
export async function runUpload(plan: UploadPlan, onProgress: (done: number, total: number) => void, signal?: { cancelled: boolean }): Promise<{ written: number; failed: string[] }> {
  await setDoc(doc(db, 'hymn_meta', 'collections'), { json: JSON.stringify(plan.books) });
  for (const [id, json] of Object.entries(plan.indexes)) await setDoc(doc(db, 'hymn_meta', `index_${id}`), { json });
  const failed: string[] = [];
  let done = 0;
  const total = plan.songs.length;
  const queue = [...plan.songs];
  const worker = async () => {
    for (;;) {
      if (signal?.cancelled) return;
      const s = queue.shift();
      if (!s) return;
      try {
        const data: Record<string, Bytes | string> = {};
        for (const f of s.files) {
          const buf = await f.file.read();
          data[f.field] = f.kind === 'text' ? new TextDecoder('utf-8').decode(buf) : Bytes.fromUint8Array(new Uint8Array(buf));
        }
        await setDoc(doc(db, 'hymn_songs', s.id), data);
      } catch (e) {
        failed.push(`${s.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
      done++;
      onProgress(done, total);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  resetHymnCache();
  return { written: done - failed.length, failed };
}
