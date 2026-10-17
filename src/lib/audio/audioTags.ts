// Reads title / artist / album / cover picture from an audio file's tags (ID3v2 for mp3, iTunes-style atoms for m4a).
// Tags are only a convenience: anything unreadable simply falls back to the file name.

export interface AudioTags { title?: string; artist?: string; album?: string; cover?: Blob }

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const syncsafe = (b: Uint8Array, o: number) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];

function decodeText(enc: number, d: Uint8Array): string {
  let s: string;
  try {
    if (enc === 1) {
      const le = !(d[0] === 0xfe && d[1] === 0xff);
      s = new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(d[0] === 0xff || d[0] === 0xfe ? d.subarray(2) : d);
    } else if (enc === 2) s = new TextDecoder('utf-16be').decode(d);
    else if (enc === 3) s = new TextDecoder('utf-8').decode(d);
    else {
      // "ISO-8859-1" tags written by Korean software are really CP949
      try { s = new TextDecoder('euc-kr', { fatal: true }).decode(d); } catch { s = new TextDecoder('latin1').decode(d); }
    }
  } catch { s = ''; }
  return s.replace(/\0+$/g, '').trim();
}

const nul = (d: Uint8Array, from: number, wide: boolean) => {
  for (let i = from; i < d.length - (wide ? 1 : 0); i += wide ? 2 : 1) if (d[i] === 0 && (!wide || d[i + 1] === 0)) return i;
  return d.length;
};

function id3(buf: Uint8Array): AudioTags {
  const out: AudioTags = {};
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return out;
  const ver = buf[3];
  const end = Math.min(buf.length, 10 + syncsafe(buf, 6));
  let p = 10;
  if (buf[5] & 0x40) p += ver === 4 ? syncsafe(buf, 10) : u32(buf, 10) + 4; // extended header
  while (p + (ver === 2 ? 6 : 10) <= end) {
    const idLen = ver === 2 ? 3 : 4;
    const id = String.fromCharCode(...buf.subarray(p, p + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    const size = ver === 2 ? (buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5] : ver === 4 ? syncsafe(buf, p + 4) : u32(buf, p + 4);
    const head = ver === 2 ? 6 : 10;
    const data = buf.subarray(p + head, p + head + size);
    p += head + size;
    if (size <= 0 || data.length === 0) continue;
    const text = () => decodeText(data[0], data.subarray(1));
    if (id === 'TIT2' || id === 'TT2') out.title ||= text();
    else if (id === 'TPE1' || id === 'TP1') out.artist ||= text();
    else if (id === 'TALB' || id === 'TAL') out.album ||= text();
    else if ((id === 'APIC' || id === 'PIC') && !out.cover) {
      const enc = data[0];
      let q = 1;
      let mime = 'image/jpeg';
      if (id === 'PIC') { const f = String.fromCharCode(...data.subarray(1, 4)).toLowerCase(); mime = f === 'png' ? 'image/png' : 'image/jpeg'; q = 4; }
      else { const e = nul(data, 1, false); mime = String.fromCharCode(...data.subarray(1, e)) || 'image/jpeg'; q = e + 1; }
      q += 1; // picture type
      const wide = enc === 1 || enc === 2;
      q = nul(data, q, wide) + (wide ? 2 : 1); // description
      const img = data.subarray(q);
      if (img.length > 100) out.cover = new Blob([img as unknown as BlobPart], { type: mime.startsWith('image/') ? mime : 'image/jpeg' });
    }
  }
  return out;
}

function mp4(moov: Uint8Array): AudioTags {
  const out: AudioTags = {};
  const walk = (s: number, e: number, path: string) => {
    let p = s;
    while (p + 8 <= e) {
      let size = u32(moov, p);
      const type = String.fromCharCode(...moov.subarray(p + 4, p + 8));
      if (size < 8) break;
      if (p + size > e) size = e - p;
      const bodyS = p + 8, bodyE = p + size;
      if (type === 'udta' || type === 'ilst') walk(bodyS, bodyE, path + '/' + type);
      else if (type === 'meta') walk(bodyS + 4, bodyE, path + '/meta');
      else if (path.endsWith('ilst') && (type === '©nam' || type === '©ART' || type === '©alb' || type === 'covr')) {
        // child 'data' atom: 8 header + 4 type/flags + 4 locale + payload
        if (bodyE - bodyS > 16) {
          const payload = moov.subarray(bodyS + 16, bodyE);
          if (type === 'covr') {
            if (!out.cover && payload.length > 100) out.cover = new Blob([payload as unknown as BlobPart], { type: payload[0] === 0x89 ? 'image/png' : 'image/jpeg' });
          } else {
            const t = new TextDecoder('utf-8').decode(payload).trim();
            if (type === '©nam') out.title ||= t; else if (type === '©ART') out.artist ||= t; else out.album ||= t;
          }
        }
      } else if (type === 'moov') walk(bodyS, bodyE, 'moov');
      p += size;
    }
  };
  walk(0, moov.length, '');
  return out;
}

export async function readTags(file: File): Promise<AudioTags> {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
      const size = 10 + syncsafe(head, 6);
      return id3(new Uint8Array(await file.slice(0, Math.min(size, 12 * 1024 * 1024)).arrayBuffer()));
    }
    // MP4 family: walk top-level atoms until 'moov'
    if (String.fromCharCode(...new Uint8Array(await file.slice(4, 8).arrayBuffer())) === 'ftyp') {
      let p = 0;
      while (p + 8 <= file.size) {
        const h = new Uint8Array(await file.slice(p, p + 16).arrayBuffer());
        let size = u32(h, 0);
        const type = String.fromCharCode(...h.subarray(4, 8));
        let hdr = 8;
        if (size === 1) { size = u32(h, 12); hdr = 16; } // 64-bit sizes: low word is enough here
        if (size === 0) size = file.size - p;
        if (size < hdr) break;
        if (type === 'moov') {
          if (size > 24 * 1024 * 1024) break;
          return mp4(new Uint8Array(await file.slice(p + hdr, p + size).arrayBuffer()));
        }
        p += size;
      }
    }
  } catch { /* fall through */ }
  return {};
}
