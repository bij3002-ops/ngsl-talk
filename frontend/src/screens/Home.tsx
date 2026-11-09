import { Link, useNavigate } from "react-router-dom";
import { api, LEVEL_KO, localDay } from "../api";
import { Bar, Chip, Ring, formatDuration } from "../components/ui";
import { useAsync, useStore } from "../store";

export default function Home() {
  const { scenarios, settings, meta } = useStore();
  const navigate = useNavigate();
  const progress = useAsync(() => api.progress(), []);
  const targets = useAsync(() => api.targets(settings.band, settings.targetCount), [settings.band, settings.targetCount]);

  // 오늘의 미션: 내 레벨의 상황 중 날짜별로 하나씩 돌아가며 추천합니다.
  const pool = scenarios.filter((s) => s.level === settings.level);
  const list = pool.length ? pool : scenarios;
  const dayIndex = Math.floor(new Date(localDay()).getTime() / 86400000);
  const mission = list.length ? list[dayIndex % list.length] : undefined;

  const p = progress.data;
  const goal = settings.dailyGoalMin;
  const byId = new Map(scenarios.map((s) => [s.id, s]));

  return (
    <div className="stack">
      <header className="topbar">
        <div className="brand">
          <span className="logo">N</span> NGSL Talk
        </div>
        <div className="row gap-s">
          <span className={`pill streak ${p?.activeToday ? "lit" : ""}`} title="연속 학습일">
            🔥 {p?.streak ?? 0}
          </span>
          <span className="pill" title="말해 본 NGSL 단어 수">
            📚 {p?.wordsUsed ?? 0}
          </span>
        </div>
      </header>

      <section className="card goal">
        <Ring value={(p?.todayMinutes ?? 0) / goal} size={88}>
          <b>{p?.todayMinutes ?? 0}</b>
          <small>/{goal}분</small>
        </Ring>
        <div>
          <h2>오늘의 목표</h2>
          <p className="muted">
            {p?.activeToday ? "좋아요! 오늘도 연속 학습을 이어 가고 있어요." : "하루 한 번 말하기로 연속 학습을 이어 가세요."}
          </p>
        </div>
      </section>

      {mission && (
        <section className="card mission">
          <div className="eyebrow">오늘의 미션 · {LEVEL_KO[mission.level]}</div>
          <div className="mission-head">
            <span className="emoji">{mission.emoji}</span>
            <div>
              <h2>{mission.titleKo}</h2>
              <p className="muted">{mission.title}</p>
            </div>
          </div>
          <p>{mission.goalKo}</p>
          <div className="eyebrow">이번에 써 볼 단어 (Band {settings.band})</div>
          <div className="chips">
            {targets.data?.map((w) => <Chip key={w}>{w}</Chip>) ?? <span className="muted">불러오는 중…</span>}
          </div>
          <button
            className="btn primary block"
            disabled={!targets.data}
            onClick={() => navigate(`/talk/${mission.id}`, { state: { targets: targets.data } })}
          >
            🎙️ 말하기 시작
          </button>
        </section>
      )}

      <section className="card">
        <div className="row between">
          <h2>단어 밴드 진행도</h2>
          <Link to="/words" className="link">
            전체 보기
          </Link>
        </div>
        <ol className="path">
          {(p?.bandStats ?? meta?.bands.map((b) => ({ ...b, used: 0, total: b.to - b.from + 1 })) ?? []).map((b) => (
            <li key={b.band} className={b.band === settings.band ? "current" : ""}>
              <span className="node">{b.band}</span>
              <div className="grow">
                <div className="row between">
                  <b>Band {b.band}</b>
                  <small className="muted">
                    {b.from}–{b.to}위 · {b.used}/{b.total}
                  </small>
                </div>
                <Bar value={b.used / Math.max(1, b.total)} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!!p?.recent.length && (
        <section className="card">
          <h2>최근 대화</h2>
          <ul className="list">
            {p.recent.map((s) => (
              <li key={s.id}>
                <Link to={`/result/${s.id}`} className="row between">
                  <span>
                    {byId.get(s.scenarioId)?.emoji} {byId.get(s.scenarioId)?.titleKo ?? s.scenarioId}
                  </span>
                  <small className="muted">
                    {formatDuration(s.durationSec)} · 목표 {s.usedTargets.length}/{s.targets.length}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
