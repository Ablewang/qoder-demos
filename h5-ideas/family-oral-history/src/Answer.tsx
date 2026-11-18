import { useEffect, useRef, useState } from 'preact/hooks';
import { api, json, type Notice } from './api';
import { ActionBar } from './ActionBar';
import { deleteDraft, listDrafts, readChunks, saveChunk, saveDraft, type Draft } from './drafts';
import { inspectAudio, microphoneMessage, recordingSupported, VoiceRecorder, wavBlob } from './recording';
import type { Ask, Snapshot, Story } from './shared';

type Phase = 'idle' | 'requesting' | 'recording' | 'stopping' | 'sending';
let leavingRecording: Promise<void> = Promise.resolve();
export function waitForRecordingSave() { return leavingRecording; }
export function Answer({ snapshot, ask, onSent, notice, onStateChange }: { snapshot: Snapshot; ask: Ask | null; onSent: () => Promise<void>; notice: Notice; onStateChange: (state: 'ready' | 'recording' | 'draft') => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(true);
  const [restoring, setRestoring] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<'audio' | 'text'>('audio');
  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [sharingConsent, setSharingConsent] = useState(false);
  useEffect(() => { setSharingConsent(false); }, [draft?.id]);
  const recorder = useRef<VoiceRecorder | null>(null);
  const chunks = useRef<Int16Array[]>([]);
  const saves = useRef<Promise<void>[]>([]);
  const pendingSaves = useRef(0);
  const saveFailed = useRef(false);
  const activeDraft = useRef<Draft | null>(null);
  const activePhase = useRef<Phase>('idle');
  const mounted = useRef(true);
  function changePhase(next: Phase) {
    activePhase.current = next;
    if (mounted.current) setPhase(next);
  }
  const answerState = phase === 'recording' || phase === 'stopping' ? 'recording' : draft ? 'draft' : 'ready';
  useEffect(() => { onStateChange(answerState); }, [answerState, onStateChange]);

  useEffect(() => {
    mounted.current = true;
    void leavingRecording.then(() => listDrafts(snapshot.member.id, snapshot.family.id)).then(async (items) => {
      if (!items.length || !mounted.current) return;
      let restored = items[0];
      const result = await api<{ story: Story | null }>(`/submissions/${restored.id}`).catch(() => null);
      if (!mounted.current) return;
      if (result?.story) {
        await deleteDraft(restored.id);
        if (mounted.current) notice('上次发送已成功，已清理这份本机草稿。', 'status');
        return;
      }
      if (restored.mode === 'recording') {
        const pcm = await readChunks(restored.id);
        restored = { ...restored, mode: 'audio', blob: wavBlob(pcm), duration: pcm.reduce((n, c) => n + c.length, 0) / 16000, mime: 'audio/wav' };
        await saveDraft(restored);
      }
      if (!mounted.current || activeDraft.current) return;
      activeDraft.current = restored; setDraft(restored);
      if (restored.mode === 'text') { setMode('text'); setText(restored.text || ''); }
    }).catch((error: Error) => { if (mounted.current) { setSaved(false); notice(error.message); } }).finally(() => { if (mounted.current) setRestoring(false); });
    return () => {
      mounted.current = false;
      if (activePhase.current === 'recording') leavingRecording = stop();
      else if (activePhase.current !== 'stopping') void recorder.current?.dispose();
    };
  }, [snapshot.member.id, snapshot.family.id]);
  useEffect(() => {
    setPreviewReady(false);
    if (!draft?.blob) { setPreview(''); return; }
    const url = URL.createObjectURL(draft.blob); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft?.blob]);
  useEffect(() => {
    if (phase !== 'recording') return;
    const start = performance.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((performance.now() - start) / 1000); setSeconds(elapsed);
      if (elapsed >= 300) void stop('到5分钟了，先保存这一段草稿，未自动发送。');
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (activeDraft.current || activePhase.current === 'requesting') { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, []);

  function fresh(mode: Draft['mode']): Draft {
    return { id: crypto.randomUUID(), memberId: snapshot.member.id, familyId: snapshot.family.id, askId: ask?.id || null, question: ask?.text || '想起的一段往事', mode, createdAt: Date.now() };
  }
  function trackSave(operation: Promise<void>, message: string) {
    pendingSaves.current++;
    if (mounted.current) setSaved(false);
    const job = operation.catch(() => { saveFailed.current = true; if (mounted.current) notice(message); }).finally(() => {
      pendingSaves.current--;
      if (mounted.current) setSaved(pendingSaves.current === 0 && !saveFailed.current);
    });
    saves.current.push(job); return job;
  }
  function persist(next: Draft) { return trackSave(saveDraft(next), '本机草稿保存失败，请先别关页面，可以自行备份。'); }
  async function begin() {
    if (activeDraft.current || restoring || activePhase.current !== 'idle') return;
    notice(''); changePhase('requesting');
    const next = fresh('recording'); chunks.current = []; saves.current = []; saveFailed.current = false;
    activeDraft.current = next; void persist(next);
    const capture = new VoiceRecorder((pcm) => {
      const index = chunks.current.length; chunks.current.push(pcm);
      void trackSave(saveChunk(next.id, index, pcm), '部分录音片段没能暂存，请先别关页面。');
    }, (message) => { void stop(message); });
    recorder.current = capture;
    try {
      await capture.start();
      if (!mounted.current) { await capture.dispose(); return; }
      setDraft(next); setSeconds(0); changePhase('recording');
    } catch (error) {
      await deleteDraft(next.id).catch(() => undefined);
      activeDraft.current = null; recorder.current = null; changePhase('idle');
      if (mounted.current) { setDraft(null); notice(microphoneMessage(error)); }
    }
  }
  function stop(message?: string): Promise<void> {
    if (activePhase.current !== 'recording') return leavingRecording;
    changePhase('stopping');
    const completion = (async () => {
      await recorder.current?.stop(); recorder.current = null;
      await Promise.all(saves.current);
      const current = activeDraft.current;
      if (!current) { changePhase('idle'); return; }
      const next: Draft = { ...current, mode: 'audio', blob: wavBlob(chunks.current), mime: 'audio/wav', duration: chunks.current.reduce((n, pcm) => n + pcm.length, 0) / 16000 };
      activeDraft.current = next; await persist(next);
      if (mounted.current) {
        setDraft(next); changePhase('idle');
        if (message) notice(message);
      }
    })();
    leavingRecording = completion; return completion;
  }
  async function discard() {
    if (!draft || activePhase.current !== 'idle' || !confirm(draft.attempted ? '放弃这份本机草稿？这不会撤回服务端可能已经收到的故事，请先刷新核对。' : '放弃这份尚未发送的本机草稿？')) return;
    try { await deleteDraft(draft.id); }
    catch (error) { notice((error as Error).message); return; }
    activeDraft.current = null; setDraft(null); setText(''); setSeconds(0); setSaved(true);
  }
  async function importFile(file: File | undefined) {
    if (!file || restoring || activePhase.current !== 'idle' || activeDraft.current) return;
    notice(''); changePhase('requesting');
    try {
      const duration = await inspectAudio(file);
      const extensions: Record<string, string> = { wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', ogg: 'audio/ogg', webm: 'audio/webm' };
      const mime = extensions[file.name.split('.').pop()?.toLowerCase() || ''];
      if (!mime) throw new Error('请选择WAV、MP3、M4A、MP4、OGG或WebM音频；不接受聊天语音的自动提取。');
      const next: Draft = { ...fresh('audio'), blob: new Blob([file], { type: mime }), mime, duration };
      activeDraft.current = next; await persist(next);
      if (mounted.current) setDraft(next);
    } catch (error) { if (mounted.current) notice((error as Error).message); }
    finally { changePhase('idle'); }
  }
  function changeText(value: string) {
    if (restoring || activePhase.current !== 'idle') return;
    setText(value);
    const next: Draft = { ...(activeDraft.current || fresh('text')), mode: 'text', text: value };
    activeDraft.current = next; setDraft(next); void persist(next);
  }
  async function send() {
    if (!draft || restoring || activePhase.current !== 'idle') return;
    if (draft.mode === 'text' && !draft.text?.trim()) { notice('先写一点想说的话，还没有发送。'); return; }
    if (draft.mode !== 'text' && (!draft.blob || (draft.duration || 0) < 0.1)) { notice('这份草稿还没有可发送的录音，请重新录或写一点文字。'); return; }
    if (draft.mode !== 'text' && !previewReady) { notice('这段草稿还没准备好试听，请先等音频就绪；播不了的文件不会发送。'); return; }
    if (!sharingConsent) { notice('请先确认讲述人同意保存，并分享给已加入的家人。'); return; }
    notice(''); changePhase('sending');
    const attempted = { ...draft, attempted: true };
    activeDraft.current = attempted; setDraft(attempted);
    try {
      await Promise.all(saves.current);
      try { await saveDraft(attempted); }
      catch {
        saveFailed.current = true; setSaved(false); activeDraft.current = draft; setDraft(draft);
        throw new Error('本机没能保存提交编号，为避免重复还没有发往服务端。请先备份草稿，别关页面。');
      }
      if (draft.mode === 'text') await json<Story>('/stories/text', { askId: draft.askId, submissionId: draft.id, consent: true, text: draft.text });
      else await api<Story>('/stories/audio', { method: 'POST', headers: { 'Content-Type': draft.mime || 'audio/wav', 'X-Ask-Id': draft.askId || '', 'X-Submission-Id': draft.id, 'X-Consent': 'true' }, body: draft.blob });
      await deleteDraft(draft.id).catch(() => { if (mounted.current) notice('服务器已收到，但本机草稿暂时没清理好；下次进入会核对。'); });
      activeDraft.current = null;
      if (mounted.current) {
        setDraft(null); setText(''); setSeconds(0);
        notice('已送到家人的故事目录。', 'status');
        await onSent().catch(() => notice('已保存成功，但页面刷新没有完成，请点击“刷新家里消息”检查。不要再次提交新内容。'));
      }
    } catch (error) {
      if (mounted.current) notice(`${(error as Error).message} 这份草稿仍保留，重新发送会使用同一个提交编号。`);
    } finally { changePhase('idle'); }
  }
  const ready = phase === 'idle' && !restoring;
  const recording = phase === 'recording' || phase === 'stopping';
  const draftAvailable = !!draft && !recording;
  return <section class="answer-box">
    <ol class="answer-stages" aria-label="讲述步骤"><li class={!draftAvailable ? 'current' : 'complete'}><span>{draftAvailable ? '✓' : '1'}</span>{mode === 'text' ? '写下' : '录下'}</li><li class={draftAvailable && phase !== 'sending' ? 'current' : ''}><span>2</span>{mode === 'text' ? '核对' : '试听'}</li><li class={phase === 'sending' ? 'current' : ''}><span>3</span>发送</li></ol>
    {snapshot.member.role === 'organizer' && <p class="proxy-note">知情当面代录 · 先征得{snapshot.family.storytellerName}同意，不代替对方编故事。</p>}
    {draft && draft.askId !== (ask?.id || null) && <div class="note draft-question"><strong>恢复的是另一道题的草稿</strong><p>{draft.question}</p><span>仍留在原问题下，不会改挂到眼前这道题。</span></div>}
    {restoring && <p class="helper" role="status">正在核对本机草稿，请稍等。</p>}
    {!draft && phase === 'idle' && <div class="segmented" aria-label="讲述方式"><button aria-pressed={mode === 'audio'} disabled={restoring} class={mode === 'audio' ? 'selected' : ''} onClick={() => setMode('audio')}>说一段</button><button aria-pressed={mode === 'text'} disabled={restoring} class={mode === 'text' ? 'selected' : ''} onClick={() => setMode('text')}>写一点</button></div>}
    {mode === 'audio' && !draft && <>
      <p class="helper recording-permission">开始后，浏览器会询问麦克风权限。录音先留在本机，停下后再试听。</p>
      {phase === 'requesting' && <p role="status" class="waiting-state">正在准备录音，请留在此页…</p>}
      <details class="import-option"><summary>已有获同意的录音？导入文件</summary><label class="file-button">导入已获同意的录音<input aria-label="导入录音文件" type="file" accept=".wav,.mp3,.m4a,.mp4,.ogg,.webm" disabled={!ready} onChange={(event) => { const input = event.currentTarget; void importFile(input.files?.[0]); input.value = ''; }} /></label><p class="helper">每段最长5分钟，不超过20MB；不提取微信聊天语音。</p></details>
      {recordingSupported() ? <ActionBar><p class="action-hint">先留本机草稿 · 不会自动发送</p><button class="record-button" aria-label={phase === 'requesting' ? '正在申请麦克风…' : '我愿意，开始说'} disabled={!ready} onClick={() => void begin()}><span aria-hidden="true">●</span><strong>{phase === 'requesting' ? '正在申请麦克风…' : '我愿意，开始说'}</strong></button></ActionBar> : <p role="status" class="note">当前环境不能录音：需要支持录音的浏览器及HTTPS或本机地址。仍可以写文字或导入合法录音。</p>}
    </>}
    {recording && <><div class="recording-state"><div><p><span class="recording-dot" aria-hidden="true" />{phase === 'stopping' ? '正在保存片段' : '正在录音'}</p><span>只在此浏览器暂存</span></div><strong aria-live="off">{clock(seconds)}</strong></div><p class="helper recording-boundary">切到后台或麦克风中断，会停止并保留草稿；不会发送。</p><ActionBar><p class="action-hint">停止后先试听，不会自动发送</p><button class="primary full" disabled={phase === 'stopping'} onClick={() => void stop()}>{phase === 'stopping' ? '正在留好片段…' : '说完了，先试听'}</button></ActionBar></>}
    {mode === 'text' && (!draft || draft.mode === 'text') && <label class="text-draft">想说的话<textarea aria-label="想说的话" maxLength={4000} rows={6} placeholder="写下你自己的话，不会自动改写。" value={text} disabled={!ready || !!draft?.attempted} onInput={(event) => changeText(event.currentTarget.value)} /></label>}
    {draftAvailable && <>
      {draft.mode === 'audio' && <div class="draft-preview"><div class="draft-receipt"><div><p><span class="recording-dot" aria-hidden="true" />录音已停止</p><span>草稿，还没有发给家人</span></div><strong>{clock(draft.duration || 0)}</strong></div><h3>先听一听这段草稿</h3>{preview && <VoicePlayer key={preview} eager src={preview} label="草稿试听" title="先听一遍" duration={draft.duration || 0} onReady={() => setPreviewReady(true)} onError={() => { setPreviewReady(false); notice('草稿暂时播不了，请别发送未经确认的文件，可以换成文字或WAV。'); }} />}<div class="draft-actions"><button class="quiet" disabled={!ready} onClick={() => void discard()}>放弃这次草稿</button><a href={preview} download={`然后呢-本机草稿.${({ 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm' } as Record<string, string>)[draft.mime || 'audio/wav'] || 'audio'}`}>另存草稿 ↓</a></div></div>}
      {draft.mode === 'text' && <button class="quiet" disabled={!ready} onClick={() => void discard()}>放弃这次草稿</button>}
      {draft.attempted && <p class="note">上次发送待核对；重试沿用同一提交编号，不另建故事。</p>}
      <p class="helper draft-storage">{saved ? '草稿已暂存本机。清除浏览器缓存仍可能丢失。' : '草稿尚未完全暂存，请先别关页面。'}</p>
      <ActionBar><div class="send-scope">仅这个家族已加入的家人可听</div><label class="check share-consent"><input aria-label="同意保存并在家族内分享" type="checkbox" checked={sharingConsent} disabled={!ready} onChange={(event) => setSharingConsent(event.currentTarget.checked)} /><span>{phrases(snapshot.member.role === 'organizer' ? ['已征得', snapshot.family.storytellerName, '同意，', '保存并在', '家族内分享。'] : ['我同意保存', `这段${draft.mode === 'text' ? '文字' : '原声'}，`, '并在家族内分享。'])}</span></label><button class="primary full send-button" disabled={!ready || !sharingConsent || (draft.mode !== 'text' && (!previewReady || (draft.duration || 0) < 0.1))} onClick={() => void send()}>{phrases(phase === 'sending' ? ['正在发送，', '请稍等…'] : ['确认发送', '给家人'])}<span class="send-arrow" aria-hidden="true">→</span></button><p class="send-foot">已下载的副本不能收回。</p></ActionBar>
    </>}
    {mode === 'text' && !draft && <ActionBar><p class="action-hint">先写下自己的话，确认后才给家人。</p><button class="primary full" disabled={!ready} onClick={() => notice('先写一点想说的话，还没有发送。')}>{phrases(['确认发送', '给家人'])}</button></ActionBar>}
  </section>;
}

// Chinese text otherwise breaks between any two characters, leaving a lone last character at large text sizes.
function phrases(parts: string[]) {
  return <span class="phrased">{parts.flatMap((part, index) => index ? [<wbr key={index} />, part] : [part])}</span>;
}
function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function VoicePlayer({ src, label, title, duration = 0, eager = false, onReady, onError }: { src: string; label: string; title: string; duration?: number; eager?: boolean; onReady?: () => void; onError: () => void }) {
  const media = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(duration);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setTime(0); setPlaying(false); setLength(duration); setFailed(false);
    return () => { media.current?.pause(); };
  }, [src]);
  async function toggle() {
    const audio = media.current!;
    if (!audio.paused) { audio.pause(); return; }
    try {
      if (failed) { setFailed(false); audio.load(); }
      await audio.play();
    } catch { setFailed(true); onError(); }
  }
  return <div class={`voice-player${failed ? ' voice-failed' : ''}`}><audio class="voice-media" ref={media} aria-label={label} preload={eager ? 'auto' : 'none'} src={src} onCanPlay={() => { setFailed(false); onReady?.(); }} onLoadedMetadata={() => { if (Number.isFinite(media.current!.duration)) setLength(media.current!.duration); }} onPlay={() => { document.querySelectorAll('audio').forEach((audio) => { if (audio !== media.current) audio.pause(); }); setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={() => setTime(media.current!.currentTime)} onError={() => { setPlaying(false); setFailed(true); onError(); }} /><button class="play-button" aria-label={`${playing ? '暂停' : failed ? '重试播放' : '播放'}${title}`} onClick={() => void toggle()}><span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span></button><div class="voice-position"><div class="voice-caption"><span>{failed ? '暂时无法播放' : title}</span><span class="voice-time">{clock(time)} / {clock(length)}</span></div><input aria-label={`${label}播放位置`} type="range" min={0} max={Math.max(length, .1)} step="0.01" disabled={!length || failed} value={time} style={{ '--progress': `${length ? time / length * 100 : 0}%` }} onInput={(event) => { media.current!.currentTime = Number(event.currentTarget.value); setTime(Number(event.currentTarget.value)); }} /></div></div>;
}
