import type { PetInteraction, PetState } from '../../../src/contracts/index.ts';
export class SoftAudio {
  private context?: AudioContext;
  private gain?: GainNode;
  private timer?: ReturnType<typeof setTimeout>;
  private notes: OscillatorNode[] = [];
  private playing = false;
  private volume = 0.3;
  constructor(private interaction: (e: PetInteraction) => Promise<void>) {}
  async play(state: PetState): Promise<void> {
    if (!state.audio.enabled || state.activity === 'quiet' || state.quietReasons.length || this.playing) return;
    this.context = new AudioContext(); await this.context.resume();
    this.gain = this.context.createGain(); this.volume = state.audio.volume; this.gain.gain.value = this.volume * 0.12; this.gain.connect(this.context.destination);
    this.playing = true; this.sequence(); await this.interaction({ kind: 'audio_play' });
  }
  private sequence(): void {
    if (!this.context || !this.gain || !this.playing) return;
    const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
    const start = this.context.currentTime;
    melody.forEach((frequency, i) => {
      const oscillator = this.context!.createOscillator(), envelope = this.context!.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      const at = start + i * 0.75;
      envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(0.22, at + 0.1); envelope.gain.exponentialRampToValueAtTime(0.001, at + 1.3);
      oscillator.connect(envelope); envelope.connect(this.gain!); oscillator.start(at); oscillator.stop(at + 1.4);
      this.notes.push(oscillator); oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.notes = this.notes.filter(n => n !== oscillator); };
    });
    this.timer = setTimeout(() => this.sequence(), 6000);
  }
  async pause(): Promise<void> {
    if (!this.playing) return;
    this.playing = false; clearTimeout(this.timer);
    for (const node of this.notes) { try { node.stop(); } catch { /* Already-ended oscillators are harmless. */ } }
    this.notes = []; await this.context?.close(); this.context = undefined;
    await this.interaction({ kind: 'audio_pause' });
  }
  sync(state: PetState): void {
    if (state.activity === 'quiet' || state.quietReasons.length || !state.audio.enabled || (!state.audio.playing && this.playing)) void this.pause();
    this.volume = state.audio.volume; if (this.gain) this.gain.gain.value = this.volume * 0.12;
  }
  mute(): void { if (this.gain) this.gain.gain.value = 0; }
  isPlaying(): boolean { return this.playing; }
}
