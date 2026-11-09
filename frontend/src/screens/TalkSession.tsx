import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, LEVEL_KO, localDay } from "../api";
import { Chip, Notice, formatDuration } from "../components/ui";
import { MAX_SESSION_SEC, useLiveTalk } from "../live/useLiveTalk";
import { usesWord, useStore } from "../store";

export default function TalkSession() {
  const { scenarioId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { scenarios, settings, meta } = useStore();
  const scenario = scenarios.find((s) => s.id === scenarioId);

  const [targets, setTargets] = useState<string[]>((location.state as { targets?: string[] } | null)?.targets ?? []);
  const [saveError, setSaveError] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const live = useLiveTalk();
  const orb = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);

  const refreshTargets = useCallback(() => {
    api.targets(settings.band, settings.targetCount).then(setTargets, () => {});
  }, [settings.band, settings.targetCount]);

  useEffect(() => {
    if (!targets.length) refreshTargets();
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 아바타(오브)를 음량에 맞춰 움직입니다.
  useEffect(() => {
    if (live.status !== "live") return;
    let raf = 0;
    const tick = () => {
      const { user, tutor, tutorSpeaking } = live.levels();
      const el = orb.current;
      if (el) {
        el.style.setProperty("--amp", String(Math.min(1, (tutorSpeaking ? tutor : user) * 6)));
        el.dataset.speaker = tutorSpeaking ? "tutor" : user > 0.02 ? "user" : "idle";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live.status, live.levels]);

  const finish = useCallback(async () => {
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    const transcript = live.stop();
    if (!transcript.some((l) => l.role === "user")) {
      navigate("/talk");
      return;
    }
    try {
      const { id } = await api.saveSession({ scenarioId, day: localDay(), durationSec, targetWords: targets, transcript });
      navigate(`/result/${id}`, { replace: true });
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }, [live, navigate, scenarioId, targets]);

  // 타이머와 시간 상한
  useEffect(() => {
    if (live.status !== "live") return;
    startedAt.current = Date.now();
    const id = setInterval(() => {
      const sec = Math.round((Date.now() - startedAt.current) / 1000);
      setElapsed(sec);
      if (sec >= MAX_SESSION_SEC) void finish();
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.status]);

  if (!scenario) return <Notice>상황을 불러오는 중입니다…</Notice>;

  const userText = live.lines.filter((l) => l.role === "user").map((l) => l.text).join(" ");
  const used = new Set(targets.filter((w) => usesWord(userText, w)));
  const inSession = live.status === "live" || live.status === "ending";

  if (!inSession) {
    return (
      <div className="stack prep">
        <button className="btn ghost back" onClick={() => navigate(-1)}>
          ← 뒤로
        </button>
        <div className="prep-hero">
          <span className="emoji xl">{scenario.emoji}</span>
          <h1>{scenario.titleKo}</h1>
          <p className="muted">{scenario.title}</p>
        </div>
        <section className="card">
          <div className="eyebrow">미션</div>
          <p>{scenario.goalKo}</p>
          <div className="row between">
            <div className="eyebrow">목표 단어 · Band {settings.band}</div>
            <button className="btn ghost small" onClick={refreshTargets} disabled={live.status === "connecting"}>
              ↻ 바꾸기
            </button>
          </div>
          <div className="chips">
            {targets.map((w) => (
              <Chip key={w}>{w}</Chip>
            ))}
          </div>
          <p className="muted small">
            난이도 {LEVEL_KO[settings.level]} · 목소리 {settings.voice} · 최대 {MAX_SESSION_SEC / 60}분
          </p>
        </section>

        {meta && !meta.live.configured && (
          <Notice tone="warn">
            서버에 <code>GEMINI_API_KEY</code>가 없어 음성 대화를 시작할 수 없습니다.
          </Notice>
        )}
        {live.error && <Notice tone="error">{live.error}</Notice>}

        <button
          className="btn primary block xl"
          disabled={live.status === "connecting" || !targets.length || !meta?.live.configured}
          onClick={() => live.start({ scenarioId, targetWords: targets, level: settings.level, voice: settings.voice })}
        >
          {live.status === "connecting" ? "튜터 연결 중…" : "🎙️ 대화 시작"}
        </button>
        <p className="muted small center">헤드폰을 쓰면 튜터 목소리가 마이크로 다시 들어가지 않아 더 자연스럽습니다.</p>
      </div>
    );
  }

  const shown = showAll ? live.lines : live.lines.slice(-3);

  return (
    <div className="live">
      <header className="live-top">
        <span className="pill">
          {scenario.emoji} {scenario.titleKo}
        </span>
        <span className="pill mono">
          {formatDuration(elapsed)} / {formatDuration(MAX_SESSION_SEC)}
        </span>
      </header>

      <div className="stage">
        <div ref={orb} className="orb" data-speaker="idle">
          <span>AI</span>
        </div>
        <p className="speaker-hint muted">{live.muted ? "마이크가 꺼져 있어요" : "자유롭게 말해 보세요. 튜터의 말을 끊어도 괜찮아요."}</p>
      </div>

      <section className="targets">
        <div className="eyebrow">
          목표 단어 {used.size}/{targets.length}
        </div>
        <div className="chips">
          {targets.map((w) => (
            <Chip key={w} state={used.has(w) ? "done" : undefined}>
              {used.has(w) ? "✓ " : ""}
              {w}
            </Chip>
          ))}
        </div>
      </section>

      <section className={`captions ${showAll ? "all" : ""}`} aria-live="polite">
        {shown.map((l, i) => (
          <p key={i} className={l.role}>
            <b>{l.role === "user" ? "나" : "튜터"}</b> {l.text}
          </p>
        ))}
        {!live.lines.length && <p className="muted">튜터가 곧 인사할 거예요…</p>}
      </section>

      {saveError && <Notice tone="error">기록 저장 실패: {saveError}</Notice>}

      <footer className="controls">
        <button className="btn round" onClick={() => setShowAll((v) => !v)} aria-label="자막 전체 보기">
          {showAll ? "▾" : "▴"}
        </button>
        <button className="btn round end" onClick={finish} disabled={live.status === "ending"} aria-label="대화 끝내기">
          ■
        </button>
        <button className={`btn round ${live.muted ? "off" : ""}`} onClick={() => live.setMuted(!live.muted)} aria-label="마이크 켜기/끄기">
          {live.muted ? "🔇" : "🎙️"}
        </button>
      </footer>
    </div>
  );
}
