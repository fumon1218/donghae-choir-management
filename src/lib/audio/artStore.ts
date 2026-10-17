// Album art picked from the device, kept in this browser (IndexedDB). Everything is optional:
// when storage is blocked the player simply shows its default cover.

const DB = 'harmony_art_v1';
const STORE = 'art';

const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  try {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  } catch (e) { reject(e); }
});

const run = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> => {
  try {
    const db = await open();
    return await new Promise<T | undefined>(resolve => {
      const tx = db.transaction(STORE, mode);
      const req = f(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
      tx.oncomplete = () => db.close();
    });
  } catch { return undefined; }
};

export const artKeySong = (book: string, n: number) => `song:${book}:${n}`;
export const artKeyBook = (book: string) => `book:${book}`;

export async function getArt(key: string): Promise<Blob | undefined> {
  const v = await run<Blob>('readonly', s => s.get(key) as IDBRequest<Blob>);
  return v instanceof Blob ? v : undefined;
}
export async function putArt(key: string, blob: Blob): Promise<boolean> {
  const r = await run('readwrite', s => s.put(blob, key));
  return r !== undefined;
}
export async function delArt(key: string): Promise<void> {
  await run('readwrite', s => s.delete(key));
}

/** Shrinks a picked image to at most 640 px (JPEG) so many covers stay small. */
export async function shrinkImage(file: File, max = 640): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('이미지를 읽을 수 없어요.'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(max, side);
    const c = document.createElement('canvas');
    c.width = c.height = out;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('이미지를 처리할 수 없어요.');
    // square crop from the centre
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('이미지를 저장할 수 없어요.'))), 'image/jpeg', 0.86));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Every stored picture (used by the backup file). */
export async function listArt(): Promise<{ key: string; blob: Blob }[]> {
  try {
    const db = await open();
    return await new Promise(resolve => {
      const out: { key: string; blob: Blob }[] = [];
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) { if (c.value instanceof Blob) out.push({ key: String(c.key), blob: c.value }); c.continue(); }
      };
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onerror = () => resolve(out);
      tx.onabort = () => resolve(out);
    });
  } catch { return []; }
}
