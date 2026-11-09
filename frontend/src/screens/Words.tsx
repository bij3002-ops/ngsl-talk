import { useDeferredValue, useState } from "react";
import { api } from "../api";
import { Dots, Notice } from "../components/ui";
import { useAsync, useStore } from "../store";

type Filter = "all" | "spoken" | "new";

export default function Words() {
  const { meta, settings, updateSettings } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const query = useDeferredValue(q.trim());
  const band = settings.band;
  const { data, error } = useAsync(() => api.words(band, query), [band, query]);

  const rows = (data ?? []).filter((w) => (filter === "spoken" ? w.usedCount > 0 : filter === "new" ? w.usedCount === 0 : true));

  return (
    <div className="stack">
      <header className="page-head">
        <h1>NGSL 단어장</h1>
        <p className="muted">빈도순 {meta?.totalWords ?? "…"}개 핵심 단어. 대화에서 직접 말한 횟수만큼 숙련도가 올라갑니다.</p>
      </header>

      {meta?.source === "sample" && (
        <Notice tone="warn">
          지금은 샘플 단어 목록입니다. 공식 NGSL CSV를 받아 <code>npm run import:ngsl -w backend -- 파일경로</code>로 가져오세요.
        </Notice>
      )}

      <div className="segmented scroll" role="tablist" aria-label="밴드 선택">
        {meta?.bands.map((b) => (
          <button key={b.band} className={band === b.band ? "on" : ""} aria-selected={band === b.band} onClick={() => updateSettings({ band: b.band })}>
            Band {b.band}
          </button>
        ))}
      </div>

      <div className="row gap-s">
        <input className="input grow" placeholder="단어 검색 (전체 밴드)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="필터">
          <option value="all">전체</option>
          <option value="spoken">말해 본 단어</option>
          <option value="new">아직 안 쓴 단어</option>
        </select>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <ul className="words">
        {rows.map((w) => (
          <li key={w.lemma}>
            <span className="rank">{w.rank}</span>
            <b className="grow">{w.lemma}</b>
            <small className="muted">{w.usedCount ? `${w.usedCount}회` : ""}</small>
            <Dots value={w.mastery} />
          </li>
        ))}
        {data && !rows.length && <li className="muted">해당하는 단어가 없습니다.</li>}
      </ul>
    </div>
  );
}
