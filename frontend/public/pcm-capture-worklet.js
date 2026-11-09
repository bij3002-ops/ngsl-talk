// 마이크 입력(브라우저 기본 샘플레이트)을 16kHz 16-bit PCM으로 변환해 100ms 단위로 메인 스레드에 보냅니다.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.chunk = new Int16Array(1600);
    this.n = 0;
    this.pos = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (; this.pos < ch.length; this.pos += this.ratio) {
      // 구간 평균으로 간단한 저역 통과 효과를 줍니다.
      const start = Math.floor(this.pos);
      const end = Math.min(ch.length, Math.floor(this.pos + this.ratio)) || start + 1;
      let sum = 0;
      for (let i = start; i < end; i++) sum += ch[i];
      const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
      this.chunk[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.n === this.chunk.length) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
        this.chunk = new Int16Array(1600);
        this.n = 0;
      }
    }
    this.pos -= ch.length;
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
