import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Level, type Line } from "../api";
import { MicCapture, PcmPlayer, toBase64 } from "./audio";

export type LiveStatus = "idle" | "connecting" | "live" | "ending" | "error";

/** 토큰 하나로 열 수 있는 세션 길이를 고려한 MVP 상한(10분). 이후는 세션 재개로 확장합니다. */
export const MAX_SESSION_SEC = 600;

interface StartOptions {
  scenarioId: string;
  targetWords: string[];
  level: Level;
  voice: string;
}

/**
 * Gemini Live 음성 대화 세션.
 * 서버에서 받은 임시 토큰으로 브라우저가 Live API에 직접 WebSocket 연결을 엽니다.
 */
export function useLiveTalk() {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string>();
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMutedState] = useState(false);

  const session = useRef<Session | null>(null);
  const mic = useRef<MicCapture | null>(null);
  const player = useRef<PcmPlayer | null>(null);
  const linesRef = useRef<Line[]>([]);
  const turnOpen = useRef<{ user: boolean; tutor: boolean }>({ user: false, tutor: false });
  const closingByUser = useRef(false);

  const appendText = useCallback((role: Line["role"], text: string) => {
    const prev = linesRef.current;
    const last = prev.at(-1);
    const next =
      last && last.role === role && turnOpen.current[role]
        ? [...prev.slice(0, -1), { role, text: last.text + text }]
        : [...prev, { role, text }];
    turnOpen.current[role] = true;
    linesRef.current = next;
    setLines(next);
  }, []);

  const onMessage = useCallback(
    (msg: LiveServerMessage) => {
      const sc = msg.serverContent;
      if (!sc) return;
      for (const part of sc.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) player.current?.enqueue(part.inlineData.data);
      }
      if (sc.inputTranscription?.text) {
        turnOpen.current.tutor = false;
        appendText("user", sc.inputTranscription.text);
      }
      if (sc.outputTranscription?.text) {
        turnOpen.current.user = false;
        appendText("tutor", sc.outputTranscription.text);
      }
      if (sc.interrupted) player.current?.interrupt();
      if (sc.turnComplete) turnOpen.current = { user: false, tutor: false };
    },
    [appendText],
  );

  const teardown = useCallback(() => {
    mic.current?.stop();
    player.current?.close();
    session.current?.close();
    mic.current = player.current = session.current = null;
  }, []);

  const start = useCallback(
    async (opts: StartOptions) => {
      setStatus("connecting");
      setError(undefined);
      linesRef.current = [];
      setLines([]);
      closingByUser.current = false;
      try {
        // 오디오 재생은 사용자 클릭 직후에 만들어야 자동재생 정책에 막히지 않습니다.
        player.current = new PcmPlayer();
        await player.current.resume();
        const { token, model, config } = await api.liveToken(opts);

        const ai = new GoogleGenAI({ apiKey: token });
        session.current = await ai.live.connect({
          model,
          config,
          callbacks: {
            onmessage: onMessage,
            onerror: (e) => {
              setError(e.message || "연결 오류가 발생했습니다.");
              setStatus("error");
            },
            onclose: (e) => {
              if (closingByUser.current) return;
              setError(e.reason ? `연결이 종료되었습니다: ${e.reason}` : "연결이 종료되었습니다.");
              setStatus("error");
              teardown();
            },
          },
        });

        mic.current = new MicCapture();
        await mic.current.start((pcm) =>
          session.current?.sendRealtimeInput({ audio: { data: toBase64(pcm), mimeType: "audio/pcm;rate=16000" } }),
        );
        // 튜터가 먼저 인사하며 상황을 열도록 신호를 보냅니다.
        session.current.sendRealtimeInput({ text: "(The learner is ready. Start the role-play now.)" });
        setStatus("live");
      } catch (e) {
        teardown();
        const err = e as Error;
        setError(err.name === "NotAllowedError" ? "마이크 권한이 필요합니다. 브라우저 주소창에서 마이크를 허용해 주세요." : err.message);
        setStatus("error");
      }
    },
    [onMessage, teardown],
  );

  /** 세션을 끝내고 대화 기록을 돌려줍니다. */
  const stop = useCallback(() => {
    closingByUser.current = true;
    setStatus("ending");
    teardown();
    return linesRef.current.map((l) => ({ ...l, text: l.text.trim() })).filter((l) => l.text);
  }, [teardown]);

  const setMuted = useCallback((m: boolean) => {
    if (mic.current) mic.current.muted = m;
    setMutedState(m);
  }, []);

  /** 아바타 애니메이션용 실시간 음량 (렌더링 없이 ref로 읽음) */
  const levels = useCallback(
    () => ({ user: mic.current?.level ?? 0, tutor: player.current?.level ?? 0, tutorSpeaking: player.current?.playing ?? false }),
    [],
  );

  useEffect(() => () => {
    closingByUser.current = true;
    teardown();
  }, [teardown]);

  return { status, error, lines, muted, setMuted, start, stop, levels };
}
