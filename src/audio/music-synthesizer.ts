export type MusicTheme = 'zen' | 'cyber' | 'off';

class MusicSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private masterGain: GainNode | null = null;
  private timerId: number | null = null;
  public theme: MusicTheme = 'zen';
  public volume: number = 0.35;

  // Zen pentatonic chord progressions (frequencies in Hz)
  // Progression: D minor pentatonic chords & melodies
  private readonly zenChords = [
    [146.83, 220.0, 293.66, 349.23], // Dm: D3, A3, D4, F4
    [130.81, 196.0, 261.63, 329.63], // C: C3, G3, C4, E4
    [116.54, 174.61, 233.08, 293.66], // Bb: Bb2, F3, Bb3, D4
    [130.81, 196.0, 261.63, 392.0],  // Csus: C3, G3, C4, G4
  ];

  private readonly cyberChords = [
    [110.0, 164.81, 220.0, 277.18],  // A3, E3, A4, C#4
    [98.0, 146.83, 196.0, 246.94],   // G2, D3, G3, B3
    [87.31, 130.81, 174.61, 220.0],  // F2, C3, F3, A3
    [98.0, 146.83, 196.0, 293.66],   // G2, D3, G3, D4
  ];

  private chordStep = 0;

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.1);
    }
  }

  public start(theme: MusicTheme = 'zen'): void {
    if (this.isPlaying) {
      if (this.theme === theme) return;
      this.stop();
    }
    if (theme === 'off') return;

    this.theme = theme;
    const ctx = this.initCtx();
    if (!ctx) return;

    this.isPlaying = true;
    this.chordStep = 0;
    this.scheduleNextBar();
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public toggle(): void {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start(this.theme === 'off' ? 'zen' : this.theme);
    }
  }

  public get active(): boolean {
    return this.isPlaying;
  }

  private scheduleNextBar(): void {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const barDuration = 4.5; // 4.5 seconds per evolving ambient chord
    const chords = this.theme === 'cyber' ? this.cyberChords : this.zenChords;
    const chord = chords[this.chordStep % chords.length];
    this.chordStep++;

    // Play chord pad
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = this.theme === 'cyber' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.theme === 'cyber' ? 450 : 380, now);
      filter.frequency.linearRampToValueAtTime(this.theme === 'cyber' ? 700 : 500, now + barDuration * 0.5);
      filter.frequency.linearRampToValueAtTime(this.theme === 'cyber' ? 400 : 350, now + barDuration);

      // Smooth slow attack and release
      const noteGain = 0.08 / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(noteGain, now + 1.2);
      gain.gain.setValueAtTime(noteGain, now + barDuration - 1.5);
      gain.gain.linearRampToValueAtTime(0.001, now + barDuration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + barDuration);
    });

    // Ambient bell / harp arpeggio note
    if (Math.random() > 0.2) {
      const bellFreq = chord[Math.floor(Math.random() * chord.length)] * 2;
      const bellDelay = 0.8 + Math.random() * 2.0;

      const bellOsc = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bellOsc.type = 'sine';
      bellOsc.frequency.setValueAtTime(bellFreq, now + bellDelay);

      bellGain.gain.setValueAtTime(0.001, now + bellDelay);
      bellGain.gain.linearRampToValueAtTime(0.06, now + bellDelay + 0.04);
      bellGain.gain.exponentialRampToValueAtTime(0.001, now + bellDelay + 1.8);

      bellOsc.connect(bellGain);
      bellGain.connect(this.masterGain!);

      bellOsc.start(now + bellDelay);
      bellOsc.stop(now + bellDelay + 1.9);
    }

    // Schedule next bar loop
    this.timerId = window.setTimeout(() => {
      this.scheduleNextBar();
    }, (barDuration - 0.2) * 1000);
  }
}

export const bgm = new MusicSynthesizer();
