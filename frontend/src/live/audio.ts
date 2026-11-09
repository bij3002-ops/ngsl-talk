/** base64 <-> 바이트 변환 */
export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Int16Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function rms(pcm: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += (pcm[i] / 32768) ** 2;
  return Math.sqrt(sum / Math.max(1, pcm.length));
}

/** 마이크 → 16kHz PCM 청크(100ms) */
export class MicCapture {
  level = 0;
  muted = false;
  private ctx?: AudioContext;
  private stream?: MediaStream;

  async start(onChunk: (pcm: ArrayBuffer) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule("/pcm-capture-worklet.js");
    const node = new AudioWorkletNode(this.ctx, "pcm-capture");
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      const pcm = new Int16Array(e.data);
      this.level = this.muted ? 0 : rms(pcm);
      if (!this.muted) onChunk(e.data);
    };
    this.ctx.createMediaStreamSource(this.stream).connect(node);
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.level = 0;
  }
}

/** 24kHz PCM 응답을 끊김 없이 이어서 재생합니다. */
export class PcmPlayer {
  private ctx = new AudioContext();
  private analyser = this.ctx.createAnalyser();
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private levelBuf = new Float32Array(256);

  constructor() {
    this.analyser.fftSize = 512;
    this.analyser.connect(this.ctx.destination);
  }

  get playing() {
    return this.sources.size > 0;
  }

  get level() {
    if (!this.playing) return 0;
    this.analyser.getFloatTimeDomainData(this.levelBuf);
    let sum = 0;
    for (const v of this.levelBuf) sum += v * v;
    return Math.sqrt(sum / this.levelBuf.length);
  }

  resume() {
    return this.ctx.resume();
  }

  enqueue(b64: string) {
    const pcm = fromBase64(b64);
    const buffer = this.ctx.createBuffer(1, pcm.length, 24000);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.analyser);
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    src.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** 사용자가 말을 끊으면(barge-in) 남은 재생을 즉시 멈춥니다. */
  interrupt() {
    this.sources.forEach((s) => s.stop());
    this.sources.clear();
    this.nextTime = 0;
  }

  close() {
    this.interrupt();
    void this.ctx.close();
  }
}
