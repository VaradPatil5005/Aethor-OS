// Web Audio API Retro Sound Effects & Lo-Fi Synthesizer for AetherOS

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicPlaying: boolean = false;
  private musicVolume: number = 0.4;
  private currentTrack: number = 0;
  private musicInterval: any = null;
  private vinylNode: AudioNode | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.musicPlaying) {
      this.pauseMusic();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Classic 1990s Mac OS Boot Chord
  public playBootChime(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const notes = [261.63, 329.63, 392.00, 523.25]; // C Major chord C4, E4, G4, C5
      const now = ctx.currentTime;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.18, now + (i * 0.04));
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + (i * 0.04));
        osc.stop(now + 2.0);
      });
    } catch (e) {
      console.warn('Audio context init error', e);
    }
  }

  // Crisp retro tactile click
  public playClickSound(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.03);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {}
  }

  // Window minimize/maximize blip
  public playWindowSound(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  // Retro paper crunch / scratch sound
  public playTrashSound(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      // White noise buffer for crunch/scratch
      const bufferSize = ctx.sampleRate * 0.12;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(2.0, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
    } catch (e) {}
  }

  // Retro error alert beep
  public playErrorSound(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(130, now + 0.08);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

    // Peregrine Falcon soaring cry / screech
  public playFalconCry(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(2800, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1900, now + 0.22);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.38);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.42);

      // Follow-up soaring chirp
      setTimeout(() => {
        try {
          const chirpOsc = ctx.createOscillator();
          const chirpGain = ctx.createGain();
          const chirpNow = ctx.currentTime;

          chirpOsc.type = 'triangle';
          chirpOsc.frequency.setValueAtTime(2400, chirpNow);
          chirpOsc.frequency.exponentialRampToValueAtTime(1600, chirpNow + 0.15);

          chirpGain.gain.setValueAtTime(0.12, chirpNow);
          chirpGain.gain.exponentialRampToValueAtTime(0.001, chirpNow + 0.16);

          chirpOsc.connect(chirpGain);
          chirpGain.connect(ctx.destination);

          chirpOsc.start(chirpNow);
          chirpOsc.stop(chirpNow + 0.18);
        } catch (e) {}
      }, 200);
    } catch (e) {}
  }

  // Morphy's playful double bark!
  public playDogBark(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime + offset;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.09);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
      });
    } catch (e) {}
  }

  // Lo-Fi Vinyl Chiptune Music Engine
  public isTrackPlaying(): boolean {
    return this.musicPlaying;
  }

  public getCurrentTrack(): number {
    return this.currentTrack;
  }

  public setTrack(index: number): void {
    this.currentTrack = index;
    if (this.musicPlaying) {
      this.playMusic(index);
    }
  }

  public playMusic(trackIndex?: number): void {
    if (this.isMuted) return;
    if (trackIndex !== undefined) this.currentTrack = trackIndex;
    this.pauseMusic();
    this.musicPlaying = true;

    const ctx = this.getContext();
    // Track 1: Kyoto 1994 (Pentatonic Chill), Track 2: Aether Memory (Lydian Dream)
    const track1Notes = [261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66];
    const track2Notes = [329.63, 369.99, 415.30, 493.88, 554.37, 493.88, 415.30, 369.99];
    const notes = this.currentTrack === 0 ? track1Notes : track2Notes;

    let noteIdx = 0;
    this.musicInterval = setInterval(() => {
      if (!this.musicPlaying || this.isMuted) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const baseFreq = notes[noteIdx % notes.length];
        const octaved = (noteIdx % 4 === 0) ? baseFreq * 0.5 : baseFreq;

        osc.type = noteIdx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(octaved, now);

        gain.gain.setValueAtTime(0.04 * this.musicVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);

        noteIdx++;
      } catch (e) {}
    }, 320);
  }

  public pauseMusic(): void {
    this.musicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  public setVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
  }
}

export const retroAudio = new RetroAudioEngine();
