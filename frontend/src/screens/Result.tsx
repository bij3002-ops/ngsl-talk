import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Chip, Notice, Ring, formatDuration } from "../components/ui";
import { useAsync, usesWord, useStore } from "../store";

function highlight(text: string, words: string[]) {
  return text.split(/(\s+)/).map((tok, i) =>
    words.some((w) => usesWord(tok, w)) ? <mark key={i}>{tok}</mark> : <Fragment key={i}>{tok}</Fragment>,
  );
}

export default function Result() {
  const { id = "" } = useParams();
  const { scenarios } = useStore();
  const { data: s, error } = useAsync(() => api.session(Number(id)), [id]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!s) return <Notice>결과를 불러오는 중…</Notice>;

  const scenario = scenarios.find((x) => x.id === s.scenarioId);
  const coverage = s.targets.length ? s.usedTargets.length / s.targets.length : 0;
  const missed = s.targets.filter((w) => !s.usedTargets.includes(w));
  const userWords = s.transcript.filter((l) => l.role === "user").reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);

  return (
    <div className="stack">
      <header className="result-hero">
        <Ring value={coverage} size={132} stroke={12}>
          <b>{Math.round(coverage * 100)}</b>
          <small>목표 달성</small>
        </Ring>
        <h1>{coverage >= 0.8 ? "훌륭해요! 🎉" : coverage >= 0.5 ? "잘하고 있어요!" : "좋은 시작이에요!"}</h1>
        <p className="muted">
          {scenario?.emoji} {scenario?.titleKo}
        </p>
      </header>

      <section className="stats">
        <div>
          <b>{formatDuration(s.durationSec)}</b>
          <small>대화 시간</small>
        </div>
        <div>
          <b>{userWords}</b>
          <small>내가 말한 단어</small>
        </div>
        <div>
          <b>{s.ngslUsed.length}</b>
          <small>NGSL 표제어</small>
        </div>
      </section>

      <section className="card">
        <h2>목표 단어</h2>
        <div className="chips">
          {s.usedTargets.map((w) => (
            <Chip key={w} state="done">
              ✓ {w}
            </Chip>
          ))}
          {missed.map((w) => (
            <Chip key={w} state="miss">
              {w}
            </Chip>
          ))}
        </div>
        {!!missed.length && <p className="muted small">회색 단어는 다음 대화에서 다시 나옵니다.</p>}
      </section>

      <section className="card">
        <h2>대화 기록</h2>
        <div className="transcript">
          {s.transcript.map((l, i) => (
            <p key={i} className={l.role}>
              <b>{l.role === "user" ? "나" : "튜터"}</b> {l.role === "user" ? highlight(l.text, s.targets) : l.text}
            </p>
          ))}
        </div>
      </section>

      <div className="row gap">
        <Link to="/" className="btn ghost grow">
          홈으로
        </Link>
        <Link to={`/talk/${s.scenarioId}`} state={{ targets: missed.length >= 3 ? missed : undefined }} className="btn primary grow">
          다시 연습
        </Link>
      </div>
    </div>
  );
}
