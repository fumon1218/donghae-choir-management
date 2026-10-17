// Metronome for the player: clicks that follow the song's tempo (or a hand-set tempo for audio files),
// and a count-in before the song starts. Uses its own AudioContext, so it never disturbs the instrument sounds.

export interface Pulse {
  /** seconds (song time) between two clicks */
  period: number;
  /** clicks per measure, for the accent on the first one */
  perBar: number;
  /** song time of a measure start (the end of a pick-up measure, else 0) */
  anchor: number;
}

/** Click grid of a song: one click per beat; 6/8, 9/8, 12/8 click every dotted quarter. */
export function pulseOf(tempo: number, beats: number, beatType: number, pickupSec: number): Pulse {
  const q = 60 / Math.max(20, tempo);
  const compound = beatType === 8 && beats % 3 === 0 && beats >= 6;
  const period = compound ? q * 1.5 : q * (4 / beatType);
  const perBar = compound ? beats / 3 : beats;
  return { period, perBar, anchor: pickupSec };
}

export class Metronome {
  private ctx: AudioContext | null = null;
  volume = 0.7;

  private ac(): AudioContext | null {
    try {
      if (!this.ctx) {
        const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
        const Ctor = C.AudioContext ?? C.webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch { return null; }
  }

  /** Call from a tap so mobile browsers allow sound later. */
  unlock() { this.ac(); }

  /** Seconds on the audio clock, or null when sound is not available. */
  now(): number | null { return this.ac()?.currentTime ?? null; }

  /** One click at audio-clock time `at` (accent = higher, louder). */
  clickAt(at: number, accent: boolean) {
    const c = this.ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1500 : 1000;
    const peak = (accent ? 0.5 : 0.32) * this.volume;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + 0.06);
  }

  /** Plays `bars` measures of clicks, `periodReal` seconds apart; resolves when the last beat has passed. */
  countIn(bars: number, perBar: number, periodReal: number): Promise<void> {
    const c = this.ac();
    if (!c || bars <= 0) return Promise.resolve();
    const t0 = c.currentTime + 0.1;
    const n = bars * perBar;
    for (let i = 0; i < n; i++) this.clickAt(t0 + i * periodReal, i % perBar === 0);
    return new Promise(res => window.setTimeout(res, (0.1 + n * periodReal) * 1000));
  }
}
