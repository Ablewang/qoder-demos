import { parseBuffer } from 'music-metadata';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 300;
const allowed = new Set(['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'application/octet-stream']);

// A real RIFF/WAVE PCM data chunk, not a declared MIME or attacker-supplied duration.
function pcmWave(buffer: Buffer): number {
  if (buffer.length < 44 || buffer.readUInt32LE(4) + 8 !== buffer.length) throw new ApiError(400, 'WAV 文件不完整');
  let format: { rate: number; channels: number; bits: number; align: number } | undefined;
  let dataBytes = 0;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const tag = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > buffer.length) throw new ApiError(400, 'WAV 数据被截断');
    if (tag === 'fmt ') {
      if (size < 16) throw new ApiError(400, 'WAV 格式无效');
      const codec = buffer.readUInt16LE(start);
      const channels = buffer.readUInt16LE(start + 2);
      const rate = buffer.readUInt32LE(start + 4);
      const byteRate = buffer.readUInt32LE(start + 8);
      const align = buffer.readUInt16LE(start + 12);
      const bits = buffer.readUInt16LE(start + 14);
      if (codec !== 1 || ![8, 16, 24, 32].includes(bits) || channels < 1 || channels > 8 || rate < 8000 || rate > 192000 || align !== channels * bits / 8 || byteRate !== rate * align) throw new ApiError(400, '仅支持有效的 PCM WAV');
      format = { rate, channels, bits, align };
    } else if (tag === 'data') {
      dataBytes += size;
    }
    offset = start + size + (size % 2);
  }
  if (!format || !dataBytes || dataBytes % format.align || offset !== buffer.length) throw new ApiError(400, 'WAV 没有有效音频数据');
  return dataBytes / (format.rate * format.align);
}

export async function inspectAudio(buffer: Buffer, declared: string): Promise<{ mime: string; duration: number; extension: string }> {
  if (!allowed.has(declared)) throw new ApiError(400, '不支持此音频类型');
  if (!buffer.length) throw new ApiError(400, '音频不能为空');
  if (buffer.length > MAX_AUDIO_BYTES) throw new ApiError(413, '音频最多 20 MiB');
  let mime: string;
  let extension: string;
  let pcmDuration: number | undefined;
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    mime = 'audio/wav'; extension = 'wav'; pcmDuration = pcmWave(buffer);
  } else if (buffer.toString('ascii', 0, 4) === 'OggS') {
    mime = 'audio/ogg'; extension = 'ogg';
  } else if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    mime = 'audio/mp4'; extension = 'm4a';
  } else if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0x1a45dfa3) {
    mime = 'audio/webm'; extension = 'webm';
  } else if (buffer.toString('ascii', 0, 3) === 'ID3' || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0)) {
    mime = 'audio/mpeg'; extension = 'mp3';
  } else throw new ApiError(400, '文件不是支持的真实音频');
  if (declared !== 'application/octet-stream' && declared !== mime) throw new ApiError(400, '音频实际格式与类型不符');
  try {
    const metadata = await parseBuffer(buffer, { mimeType: mime, size: buffer.length }, { duration: true, skipCovers: true });
    const format = metadata.format;
    const duration = format.duration;
    if (!format.codec || !format.sampleRate || !format.numberOfChannels || format.hasAudio === false || format.hasVideo === true || format.trackInfo.some(track => !!track.video) || !duration || !Number.isFinite(duration) || duration <= 0) throw new ApiError(400, '音频没有有效声音或时长');
    // MPEG sniffing must not accept AAC ADTS disguised as MP3; EBML must be WebM, not arbitrary Matroska.
    if (mime === 'audio/mpeg' && !/^MPEG/.test(format.container ?? '')) throw new ApiError(400, '不是 MPEG 音频');
    if (mime === 'audio/webm' && !/webm/i.test(format.container ?? '')) throw new ApiError(400, '不是 WebM 音频');
    if (pcmDuration !== undefined && Math.abs(duration - pcmDuration) > 0.01) throw new ApiError(400, 'WAV 时长不一致');
    if (duration > MAX_AUDIO_SECONDS) throw new ApiError(413, '音频最多 5 分钟');
    return { mime, duration, extension };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, '无法解析此音频');
  }
}
