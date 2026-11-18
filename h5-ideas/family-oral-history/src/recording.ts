export function wavBlob(chunks: Int16Array[]): Blob {
  const samples = chunks.reduce((count, chunk) => count + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data');
  view.setUint32(40, samples * 2, true);
  let position = 44;
  for (const chunk of chunks) for (const sample of chunk) { view.setInt16(position, sample, true); position += 2; }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function recordingSupported() {
  return window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && !!window.AudioContext && !!window.AudioWorkletNode;
}

export function microphoneMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '还没开始录：麦克风没有获准使用。可请家人检查浏览器与系统权限，或改用文字、合法录音文件。';
    if (error.name === 'NotFoundError') return '还没开始录：没有找到麦克风。可以打字，或让家人导入已获同意的录音。';
    if (error.name === 'NotReadableError') return '麦克风正在被其他程序使用。请结束通话后再试；这次还没录下来。';
  }
  return '这台浏览器还没能开始录音。请改用文字或合法文件，不必反复尝试。';
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private stopped: (() => void) | null = null;
  private ending = false;
  private visibility = () => { if (document.hidden && !this.ending) this.onInterrupted('页面去了后台，录音已停为草稿，还没有发给家人。'); };
  constructor(private onChunk: (pcm: Int16Array) => void, private onInterrupted: (message: string) => void) {}
  async start() {
    if (!recordingSupported()) throw new Error('unsupported');
    try {
      this.context = new AudioContext();
      const resumed = this.context.resume();
      void resumed.catch(() => undefined);
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      await this.context.audioWorklet.addModule(`${import.meta.env.BASE_URL}pcm-worklet.js`);
      await resumed;
      if (this.context.state !== 'running') throw new Error('audio-not-running');
      this.node = new AudioWorkletNode(this.context, 'voice-pcm', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      this.node.port.onmessage = (event: MessageEvent<{ pcm?: ArrayBuffer; stopped?: boolean }>) => {
        if (event.data.pcm) this.onChunk(new Int16Array(event.data.pcm));
        if (event.data.stopped) this.stopped?.();
      };
      const source = this.context.createMediaStreamSource(this.stream);
      const mute = this.context.createGain(); mute.gain.value = 0;
      source.connect(this.node).connect(mute).connect(this.context.destination);
      this.stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (!this.ending) this.onInterrupted('麦克风被中断了，先保留已收到的片段，没有自动发送。');
      }, { once: true }));
      document.addEventListener('visibilitychange', this.visibility);
    } catch (error) {
      await this.dispose();
      throw error;
    }
  }
  async stop() {
    if (this.ending) return;
    this.ending = true;
    if (this.node) await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 1200);
      this.stopped = () => { clearTimeout(timeout); resolve(); };
      this.node!.port.postMessage('stop');
    });
    await this.dispose();
  }
  async dispose() {
    this.ending = true;
    document.removeEventListener('visibilitychange', this.visibility);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.node?.disconnect();
    this.stream = null; this.node = null;
    await this.context?.close().catch(() => undefined);
    this.context = null;
  }
}

export async function inspectAudio(blob: Blob): Promise<number> {
  if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error('请选择不超过20MB的非空录音文件。');
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (!Number.isFinite(audio.duration) || audio.duration < 0.1 || audio.duration > 300.05) throw new Error('一段请在0.1秒到5分钟之间，可以分段讲。');
    return audio.duration;
  } catch (error) {
    if (error instanceof Error && error.message.includes('一段')) throw error;
    throw new Error('这段音频当前浏览器读不出来。请换成WAV或MP3；不能仅凭文件扩展名保证可播放。');
  } finally { await context.close(); }
}
