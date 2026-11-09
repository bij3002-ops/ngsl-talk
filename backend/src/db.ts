import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Postgres 하나로 동작합니다.
 * - DATABASE_URL이 있으면: 그 Postgres(예: Supabase)에 연결합니다. 배포 환경에서는 반드시 설정합니다.
 * - 없으면: 로컬 개발용으로 내장 Postgres(PGlite)를 backend/data/pglite 폴더에 띄웁니다.
 * 같은 SQL을 양쪽에서 그대로 씁니다.
 *
 * MVP는 단일 사용자 기준입니다. 여러 사용자를 받으려면 user_id 컬럼을 추가하세요.
 */
export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

interface Db {
  kind: "postgres" | "pglite";
  query: Query;
  tx<T>(fn: (q: Query) => Promise<T>): Promise<T>;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    // Supabase 풀러(transaction 모드)는 prepared statement를 지원하지 않으므로 끕니다.
    const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, ssl: local ? false : "require" });
    const wrap =
      (s: typeof sql): Query =>
      async (text, params = []) =>
        [...(await s.unsafe(text, params as never[]))] as never;
    return {
      kind: "postgres",
      query: wrap(sql),
      tx: (fn) => sql.begin((t) => fn(wrap(t as unknown as typeof sql))) as never,
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? fileURLToPath(new URL("../data/pglite", import.meta.url));
  mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  return {
    kind: "pglite",
    query: async (text, params) => (await pg.query(text, params)).rows as never,
    tx: (fn) => pg.transaction((t) => fn(async (text, params) => (await t.query(text, params)).rows as never)),
  };
}

export const db = await connect();

await db.query(`
  CREATE TABLE IF NOT EXISTS word_progress (
    lemma       TEXT PRIMARY KEY,
    used_count  INTEGER NOT NULL DEFAULT 0,  -- 학습자가 직접 말한 횟수
    exposures   INTEGER NOT NULL DEFAULT 0,  -- 목표 단어로 제시된 횟수
    last_used   TEXT
  )`);
await db.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scenario_id   TEXT NOT NULL,
    day           TEXT NOT NULL,              -- YYYY-MM-DD (학습자 현지 날짜)
    created_at    TEXT NOT NULL,
    duration_sec  INTEGER NOT NULL,
    targets       JSONB NOT NULL,             -- string[]
    used_targets  JSONB NOT NULL,             -- string[]
    ngsl_used     JSONB NOT NULL,             -- string[]
    transcript    JSONB NOT NULL              -- {role,text}[]
  )`);

export interface Progress {
  used_count: number;
  exposures: number;
}

export async function progressMap(): Promise<Map<string, Progress>> {
  const rows = await db.query<{ lemma: string } & Progress>("SELECT lemma, used_count, exposures FROM word_progress");
  return new Map(rows.map((r) => [r.lemma, r]));
}

/** 사용 횟수 기반의 0~5 숙련도. 제시만 되고 말하지 못한 단어는 0입니다. */
export function mastery(p: Progress | undefined): number {
  return Math.min(5, p?.used_count ?? 0);
}
