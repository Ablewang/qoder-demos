class VoicePCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(8000);
    this.position = 0;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
    this.active = true;
    this.port.onmessage = (event) => {
      if (event.data === 'stop') {
        this.flush();
        this.active = false;
        this.port.postMessage({ stopped: true });
      }
    };
  }
  flush() {
    if (!this.position) return;
    const chunk = this.buffer.slice(0, this.position);
    this.port.postMessage({ pcm: chunk.buffer }, [chunk.buffer]);
    this.position = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!this.active || !input) return true;
    for (const sample of input) {
      this.sum += sample;
      this.count += 1;
      this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        const value = Math.max(-1, Math.min(1, this.sum / this.count));
        this.buffer[this.position++] = Math.round(value * (value < 0 ? 32768 : 32767));
        this.sum = 0;
        this.count = 0;
        if (this.position === this.buffer.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('voice-pcm', VoicePCM);
