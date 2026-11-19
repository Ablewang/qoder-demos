type Sound = 'card' | 'sincere' | 'critical' | 'flop' | 'reward' | 'end';
export class AudioPlayer {
  muted = true;
  private context: AudioContext | null = null;
  constructor() {
    try { this.muted = localStorage.getItem('relatives-sound') !== 'on'; } catch { /* Storage can be blocked in embedded browsers. */ }
  }
  async toggle(): Promise<void> {
    this.muted = !this.muted;
    try { localStorage.setItem('relatives-sound', this.muted ? 'off' : 'on'); } catch { /* Playback is independent of storage. */ }
    if (this.muted) { await this.context?.suspend(); return; }
    this.context ??= new AudioContext();
    await this.context.resume();
    this.play('card');
  }
  suspend(): void { void this.context?.suspend(); }
  async resume(): Promise<void> {
    if (this.muted) return;
    this.context ??= new AudioContext();
    await this.context.resume();
  }
  play(sound: Sound): void {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const notes: Record<Sound, number[]> = { card: [520], sincere: [392, 494, 587], critical: [660, 880, 1046], flop: [240, 180], reward: [523, 659], end: [392, 523, 659] };
    const ctx = this.context;
    notes[sound].forEach((hz, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.085;
      oscillator.type = sound === 'flop' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(hz, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
    });
  }
}
