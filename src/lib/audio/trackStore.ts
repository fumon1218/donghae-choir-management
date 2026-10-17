// "내 음원": audio files picked from the device, kept inside this browser (IndexedDB).
// Nothing is uploaded anywhere.

import { readTags } from './audioTags';
import { artKeySong, delArt, putArt, shrinkImage } from './artStore';

export interface TrackMeta { n: number; title: string; artist: string; album: string; name: string; size: number; type: string; added: number; /** true = only a link to the original file on the device (nothing copied) */ linked?: boolean }

const DB = 'harmony_tracks_v1';
let dbp: Promise<IDBDatabase> | null = null;
const open = (): Promise<IDBDatabase> => {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      try {
        const r = indexedDB.open(DB, 2);
        r.onupgradeneeded = () => {
          const names = r.result.objectStoreNames;
          if (!names.contains('meta')) r.result.createObjectStore('meta', { keyPath: 'n' });
          if (!names.contains('blobs')) r.result.createObjectStore('blobs');
          if (!names.contains('handles')) r.result.createObjectStore('handles');
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      } catch (e) { reject(e); }
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
};

const tx = async <T,>(stores: string[], mode: IDBTransactionMode, f: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> => {
  const db = await open();
  return new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const req = f(t);
    t.oncomplete = () => resolve(req ? (req as IDBRequest<T>).result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('저장 공간이 부족해요.'));
  });
};

export async function listTracks(): Promise<TrackMeta[]> {
  try {
    const all = (await tx<TrackMeta[]>(['meta'], 'readonly', t => t.objectStore('meta').getAll() as IDBRequest<TrackMeta[]>)) ?? [];
    return all.sort((a, b) => a.added - b.added || a.n - b.n);
  } catch { return []; }
}

interface FsPerm { queryPermission?: (o: { mode: 'read' }) => Promise<string>; requestPermission?: (o: { mode: 'read' }) => Promise<string> }
type FileHandle = FsPerm & { kind: 'file'; name: string; getFile: () => Promise<File> };
type DirHandle = FsPerm & { kind: 'directory'; name: string; values: () => AsyncIterable<FileHandle | DirHandle> };
type FsWin = { showOpenFilePicker?: (o: unknown) => Promise<FileHandle[]>; showDirectoryPicker?: (o?: unknown) => Promise<DirHandle> };
const fsw = (): FsWin => window as unknown as FsWin;

/** Whether this browser can link original files instead of copying them (desktop Chrome/Edge, some Android). */
export const canLink = () => typeof window !== 'undefined' && typeof fsw().showOpenFilePicker === 'function';
export const canLinkFolder = () => typeof window !== 'undefined' && typeof fsw().showDirectoryPicker === 'function';

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|wma)$/i;

export async function getTrackBlob(n: number): Promise<Blob | undefined> {
  let meta: TrackMeta | undefined;
  try { meta = await tx<TrackMeta>(['meta'], 'readonly', t => t.objectStore('meta').get(n) as IDBRequest<TrackMeta>); } catch { meta = undefined; }
  if (meta?.linked) {
    let h: FileHandle | undefined;
    try { h = await tx<FileHandle>(['handles'], 'readonly', t => t.objectStore('handles').get(n) as IDBRequest<FileHandle>); } catch { h = undefined; }
    if (!h) throw new Error('연결 정보를 찾을 수 없어요. 다시 연결해 주세요.');
    try {
      if (h.queryPermission && (await h.queryPermission({ mode: 'read' })) !== 'granted') {
        if (!h.requestPermission || (await h.requestPermission({ mode: 'read' })) !== 'granted') throw new Error('perm');
      }
    } catch { throw new Error('원본 파일을 읽을 권한이 필요해요. 다시 재생하면서 허용해 주세요.'); }
    try { return await h.getFile(); } catch { throw new Error('원본 파일을 열 수 없어요. 옮기거나 지웠을 수 있어요.'); }
  }
  try {
    const b = await tx<Blob>(['blobs'], 'readonly', t => t.objectStore('blobs').get(n) as IDBRequest<Blob>);
    return b instanceof Blob ? b : undefined;
  } catch { return undefined; }
}

const baseName = (s: string) => s.replace(/\.[^.]+$/, '').trim();

/** Stores one file. Returns the new entry, `'dup'` when the same file is already there. */
export async function addTrack(file: File, existing: TrackMeta[], handle?: FileHandle): Promise<TrackMeta | 'dup'> {
  if (existing.some(t => t.name === file.name && t.size === file.size)) return 'dup';
  const tags = await readTags(file);
  const n = Math.max(Date.now(), ...existing.map(t => t.n + 1));
  const meta: TrackMeta = {
    n,
    title: tags.title || baseName(file.name) || '이름 없는 음원',
    artist: tags.artist || '',
    album: tags.album || '',
    name: file.name,
    size: file.size,
    type: file.type || 'audio/mpeg',
    added: Date.now(),
    ...(handle ? { linked: true } : {}),
  };
  await tx(['meta', 'blobs', 'handles'], 'readwrite', t => {
    t.objectStore('meta').put(meta);
    if (handle) t.objectStore('handles').put(handle, n);
    else t.objectStore('blobs').put(file, n);
  });
  if (tags.cover) {
    try { await putArt(artKeySong('mine', n), await shrinkImage(new File([tags.cover], 'cover', { type: tags.cover.type }))); } catch { /* cover is optional */ }
  }
  return meta;
}

export async function removeTrack(n: number): Promise<void> {
  try {
    await tx(['meta', 'blobs', 'handles'], 'readwrite', t => {
      t.objectStore('meta').delete(n);
      t.objectStore('blobs').delete(n);
      t.objectStore('handles').delete(n);
    });
    await delArt(artKeySong('mine', n));
  } catch { /* ignore */ }
}

export const requestPersist = () => { try { void navigator.storage?.persist?.(); } catch { /* ignore */ } };

/** Opens the system picker and returns links to the chosen audio files (user cancel → empty). */
export async function pickLinkFiles(): Promise<{ file: File; handle: FileHandle }[]> {
  const w = fsw();
  if (!w.showOpenFilePicker) return [];
  try {
    const hs = await w.showOpenFilePicker({ multiple: true, types: [{ description: '음원', accept: { 'audio/*': ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac'] } }] });
    return Promise.all(hs.map(async handle => ({ file: await handle.getFile(), handle })));
  } catch { return []; }
}

/** Same for a whole folder (sub-folders included). */
export async function pickLinkFolder(): Promise<{ file: File; handle: FileHandle }[]> {
  const w = fsw();
  if (!w.showDirectoryPicker) return [];
  let dir: DirHandle;
  try { dir = await w.showDirectoryPicker({ mode: 'read' }); } catch { return []; }
  const out: { file: File; handle: FileHandle }[] = [];
  const walk = async (d: DirHandle, depth: number) => {
    for await (const e of d.values()) {
      if (e.kind === 'directory') { if (depth < 6) await walk(e, depth + 1); }
      else if (AUDIO_EXT.test(e.name)) { try { out.push({ file: await e.getFile(), handle: e }); } catch { /* skip unreadable */ } }
    }
  };
  await walk(dir, 0);
  return out.sort((a, b) => a.file.name.localeCompare(b.file.name, 'ko'));
}
