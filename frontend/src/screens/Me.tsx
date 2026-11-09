import { api, LEVEL_KO, type Level } from "../api";
import { useAsync, useStore } from "../store";

export default function Me() {
  const { meta, settings, updateSettings } = useStore();
  const { data: p } = useAsync(() => api.progress(), []);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>나의 학습</h1>
      </header>

      <section className="stats">
        <div>
          <b>🔥 {p?.streak ?? 0}</b>
          <small>연속 학습일</small>
        </div>
        <div>
          <b>{p?.totalMinutes ?? 0}분</b>
          <small>누적 대화</small>
        </div>
        <div>
          <b>{p?.wordsUsed ?? 0}</b>
          <small>말해 본 단어</small>
        </div>
      </section>

      <section className="card form">
        <h2>학습 설정</h2>
        <label>
          난이도
          <select className="input" value={settings.level} onChange={(e) => updateSettings({ level: e.target.value as Level })}>
            {(Object.keys(LEVEL_KO) as Level[]).map((l) => (
              <option key={l} value={l}>
                {LEVEL_KO[l]}
              </option>
            ))}
          </select>
        </label>
        <label>
          튜터 목소리
          <select className="input" value={settings.voice} onChange={(e) => updateSettings({ voice: e.target.value })}>
            {(meta?.live.voices ?? [settings.voice]).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          하루 목표
          <select className="input" value={settings.dailyGoalMin} onChange={(e) => updateSettings({ dailyGoalMin: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m}분
              </option>
            ))}
          </select>
        </label>
        <label>
          세션당 목표 단어
          <select className="input" value={settings.targetCount} onChange={(e) => updateSettings({ targetCount: Number(e.target.value) })}>
            {[4, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>연결 상태</h2>
        <ul className="list kv">
          <li>
            <span>Gemini Live</span>
            <b className={meta?.live.configured ? "ok" : "bad"}>{meta?.live.configured ? "연결 가능" : "API 키 없음"}</b>
          </li>
          <li>
            <span>모델</span>
            <code>{meta?.live.model ?? "-"}</code>
          </li>
          <li>
            <span>단어 목록</span>
            <span>{meta ? (meta.source === "official" ? `공식 NGSL (${meta.totalWords})` : `샘플 (${meta.totalWords})`) : "-"}</span>
          </li>
        </ul>
        <p className="muted small">
          NGSL: Browne, C., Culligan, B. &amp; Phillips, J. New General Service List, CC BY-SA 4.0.
        </p>
      </section>
    </div>
  );
}
