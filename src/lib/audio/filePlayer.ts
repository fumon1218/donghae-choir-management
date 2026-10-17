// A thin wrapper around one <audio> element: load a Blob, play/pause/seek, change the speed.
// (Taken from the sheet-music app's 「나의 하모니」 player.)

export class FilePlayer {
  private a: HTMLAudioElement;
  private url: string | null = null;
  playing = false;
  blocked = false;
  speed = 1;
  onEnd: (() => void) | null = null;

  constructor() {
    this.a = new Audio();
    this.a.preload = 'auto';
    // 속도를 바꿔도 음높이가 변하지 않게
    (this.a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    this.a.addEventListener('ended', () => { this.playing = false; this.onEnd?.(); });
  }

  /** resolves to the length in seconds */
  async load(blob: Blob): Promise<number> {
    this.stop();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    const a = this.a;
    a.src = this.url;
    await new Promise<void>((res, rej) => {
      const ok = () => { a.removeEventListener('error', bad); res(); };
      const bad = () => { a.removeEventListener('loadedmetadata', ok); rej(new Error('이 음원은 이 기기에서 재생할 수 없는 형식이에요.')); };
      a.addEventListener('loadedmetadata', ok, { once: true });
      a.addEventListener('error', bad, { once: true });
    });
    return this.total;
  }

  get total() { return Number.isFinite(this.a.duration) ? this.a.duration : 0; }
  get position() { return this.a.currentTime; }

  async play(from?: number): Promise<void> {
    const a = this.a;
    if (from !== undefined) a.currentTime = from >= this.total - 0.05 ? 0 : from;
    else if (a.ended) a.currentTime = 0;
    a.playbackRate = this.speed;
    try { await a.play(); this.playing = true; this.blocked = false; }
    catch { this.playing = false; this.blocked = true; }
  }

  pause() { this.a.pause(); this.playing = false; }
  stop() { this.a.pause(); try { this.a.currentTime = 0; } catch { /* nothing loaded */ } this.playing = false; }
  seek(s: number) { this.a.currentTime = Math.max(0, Math.min(this.total, s)); }
  setSpeed(v: number) { this.speed = v; this.a.playbackRate = v; }
  dispose() { this.stop(); this.a.removeAttribute('src'); if (this.url) URL.revokeObjectURL(this.url); this.url = null; }
}
