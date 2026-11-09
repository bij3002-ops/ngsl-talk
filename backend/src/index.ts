import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db, mastery, progressMap } from "./db.ts";
import { LIVE_MODEL, createLiveToken, liveConfig, liveConfigured } from "./gemini.ts";
import { bands, isTargetable, lemmasIn, source, wordByLemma, words } from "./ngsl.ts";
import { buildSystemInstruction, scenarios, type Level } from "./scenarios.ts";

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir", "Leda"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const app = new Hono().basePath("/api");

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const bad = (msg: string) => new HTTPException(400, { message: msg });

app.get("/meta", (c) =>
  c.json({
    source,
    totalWords: words.length,
    bands,
    live: { configured: liveConfigured, model: LIVE_MODEL, voices: VOICES },
  }),
);

app.get("/scenarios", (c) => c.json(scenarios));

app.get("/words", (c) => {
  const band = Number(c.req.query("band") ?? 1);
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const progress = progressMap();
  const list = words
    .filter((w) => (q ? w.lemma.includes(q) : w.band === band))
    .map((w) => {
      const p = progress.get(w.lemma);
      return { ...w, usedCount: p?.used_count ?? 0, exposures: p?.exposures ?? 0, mastery: mastery(p) };
    });
  return c.json(list);
});

/** 이번 세션의 목표 단어: 해당 밴드에서 숙련도가 낮은 단어를 우선으로 무작위 선택합니다. */
app.get("/words/targets", (c) => {
  const band = Number(c.req.query("band") ?? 1);
  const count = Math.min(12, Math.max(3, Number(c.req.query("count") ?? 6)));
  const progress = progressMap();
  const pool = words
    .filter((w) => w.band === band && isTargetable(w.lemma))
    .map((w) => ({ lemma: w.lemma, m: mastery(progress.get(w.lemma)), r: Math.random() }))
    .sort((a, b) => a.m - b.m || a.r - b.r);
  return c.json(pool.slice(0, count).map((w) => w.lemma));
});

app.post("/live/token", async (c) => {
  if (!liveConfigured) throw new HTTPException(503, { message: "서버에 GEMINI_API_KEY가 설정되지 않았습니다. backend/.env를 확인하세요." });
  const body = await c.req.json<{ scenarioId?: string; targetWords?: string[]; level?: Level; voice?: string }>();
  const scenario = scenarios.find((s) => s.id === body.scenarioId);
  if (!scenario) throw bad("Unknown scenarioId");
  const level = LEVELS.includes(body.level as Level) ? (body.level as Level) : scenario.level;
  const voice = VOICES.includes(body.voice ?? "") ? body.voice! : VOICES[0];
  const targetWords = (body.targetWords ?? []).filter((w) => wordByLemma.has(w)).slice(0, 12);

  const config = liveConfig(buildSystemInstruction(scenario, level, targetWords), voice);
  const { token, expireTime } = await createLiveToken(config);
  // 클라이언트는 토큰에 잠긴 것과 같은 model/config로 연결합니다.
  return c.json({ token, expireTime, model: LIVE_MODEL, config });
});

interface SessionBody {
  scenarioId: string;
  day: string;
  durationSec: number;
  targetWords: string[];
  transcript: { role: "user" | "tutor"; text: string }[];
}

app.post("/sessions", async (c) => {
  const b = await c.req.json<SessionBody>();
  if (!scenarios.some((s) => s.id === b.scenarioId)) throw bad("Unknown scenarioId");
  if (!DAY_RE.test(b.day)) throw bad("day must be YYYY-MM-DD");
  if (!Array.isArray(b.transcript) || !Array.isArray(b.targetWords)) throw bad("transcript and targetWords are required");

  const targets = b.targetWords.filter((w) => wordByLemma.has(w));
  const userText = b.transcript.filter((t) => t.role === "user").map((t) => t.text).join(" ");
  const used = lemmasIn(userText);
  const usedTargets = targets.filter((w) => used.has(w));
  const durationSec = Math.max(0, Math.round(Number(b.durationSec) || 0));

  const upsertUsed = db.prepare(`
    INSERT INTO word_progress (lemma, used_count, last_used) VALUES (?, 1, ?)
    ON CONFLICT(lemma) DO UPDATE SET used_count = used_count + 1, last_used = excluded.last_used`);
  const upsertExposure = db.prepare(`
    INSERT INTO word_progress (lemma, exposures) VALUES (?, 1)
    ON CONFLICT(lemma) DO UPDATE SET exposures = exposures + 1`);

  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    for (const lemma of used) upsertUsed.run(lemma, now);
    for (const lemma of targets) upsertExposure.run(lemma);
    const res = db
      .prepare(
        `INSERT INTO sessions (scenario_id, day, created_at, duration_sec, targets, used_targets, ngsl_used, transcript)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(b.scenarioId, b.day, now, durationSec, JSON.stringify(targets), JSON.stringify(usedTargets), JSON.stringify([...used]), JSON.stringify(b.transcript));
    db.exec("COMMIT");
    return c.json({ id: Number(res.lastInsertRowid) }, 201);
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
});

interface SessionRow {
  id: number;
  scenario_id: string;
  day: string;
  created_at: string;
  duration_sec: number;
  targets: string;
  used_targets: string;
  ngsl_used: string;
  transcript: string;
}

const toSession = (r: SessionRow) => ({
  id: r.id,
  scenarioId: r.scenario_id,
  day: r.day,
  createdAt: r.created_at,
  durationSec: r.duration_sec,
  targets: JSON.parse(r.targets) as string[],
  usedTargets: JSON.parse(r.used_targets) as string[],
  ngslUsed: JSON.parse(r.ngsl_used) as string[],
  transcript: JSON.parse(r.transcript) as SessionBody["transcript"],
});

app.get("/sessions/:id", (c) => {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(Number(c.req.param("id"))) as SessionRow | undefined;
  if (!row) throw new HTTPException(404, { message: "Session not found" });
  return c.json(toSession(row));
});

function shiftDay(day: string, delta: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

app.get("/progress", (c) => {
  const today = c.req.query("today") ?? new Date().toISOString().slice(0, 10);
  if (!DAY_RE.test(today)) throw bad("today must be YYYY-MM-DD");

  const days = new Set((db.prepare("SELECT DISTINCT day FROM sessions").all() as { day: string }[]).map((r) => r.day));
  // 오늘 아직 학습하지 않았다면 어제부터 연속 일수를 셉니다.
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }

  const totals = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(duration_sec), 0) AS sec FROM sessions").get() as { n: number; sec: number };
  const todaySec = (db.prepare("SELECT COALESCE(SUM(duration_sec), 0) AS sec FROM sessions WHERE day = ?").get(today) as { sec: number }).sec;
  const progress = progressMap();
  const bandStats = bands.map((b) => {
    const inBand = words.filter((w) => w.band === b.band);
    return { ...b, used: inBand.filter((w) => (progress.get(w.lemma)?.used_count ?? 0) > 0).length, total: inBand.length };
  });
  const recent = (db.prepare("SELECT * FROM sessions ORDER BY id DESC LIMIT 5").all() as unknown as SessionRow[]).map(toSession);

  return c.json({
    streak,
    activeToday: days.has(today),
    todayMinutes: Math.round(todaySec / 60),
    totalSessions: totals.n,
    totalMinutes: Math.round(totals.sec / 60),
    wordsUsed: [...progress.values()].filter((p) => p.used_count > 0).length,
    bandStats,
    recent: recent.map(({ transcript: _t, ...s }) => s),
  });
});

const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${port}/api (words: ${source}, live: ${liveConfigured ? LIVE_MODEL : "not configured"})`);
});
