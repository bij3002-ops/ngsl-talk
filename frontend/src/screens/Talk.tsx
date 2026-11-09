import { useState } from "react";
import { Link } from "react-router-dom";
import { LEVEL_KO, type Level } from "../api";
import { Notice } from "../components/ui";
import { useStore } from "../store";

const FILTERS: (Level | "all")[] = ["all", "beginner", "intermediate", "advanced"];

export default function Talk() {
  const { scenarios, meta } = useStore();
  const [filter, setFilter] = useState<Level | "all">("all");
  const shown = scenarios.filter((s) => filter === "all" || s.level === filter);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>AI 튜터와 회화</h1>
        <p className="muted">상황을 고르면 Gemini 튜터가 역할을 맡아 실시간 음성으로 대화합니다.</p>
      </header>

      {meta && !meta.live.configured && (
        <Notice tone="warn">
          음성 대화를 하려면 <code>backend/.env</code>에 <code>GEMINI_API_KEY</code>를 넣고 서버를 다시 시작하세요.
        </Notice>
      )}

      <div className="segmented" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f === "all" ? "전체" : LEVEL_KO[f]}
          </button>
        ))}
      </div>

      <div className="grid">
        {shown.map((s) => (
          <Link key={s.id} to={`/talk/${s.id}`} className="card scenario">
            <span className="emoji">{s.emoji}</span>
            <b>{s.titleKo}</b>
            <small className="muted">{s.title}</small>
            <span className={`badge ${s.level}`}>{LEVEL_KO[s.level]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
