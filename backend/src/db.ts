import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// MVP는 단일 사용자 기준입니다. 로그인을 붙일 때 user_id 컬럼을 추가하세요.
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL("../data/app.db", import.meta.url));
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS word_progress (
    lemma       TEXT PRIMARY KEY,
    used_count  INTEGER NOT NULL DEFAULT 0,  -- 학습자가 직접 말한 횟수
    exposures   INTEGER NOT NULL DEFAULT 0,  -- 목표 단어로 제시된 횟수
    last_used   TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id   TEXT NOT NULL,
    day           TEXT NOT NULL,              -- YYYY-MM-DD (학습자 현지 날짜)
    created_at    TEXT NOT NULL,
    duration_sec  INTEGER NOT NULL,
    targets       TEXT NOT NULL,              -- JSON string[]
    used_targets  TEXT NOT NULL,              -- JSON string[]
    ngsl_used     TEXT NOT NULL,              -- JSON string[]
    transcript    TEXT NOT NULL               -- JSON {role,text}[]
  );
`);

export interface Progress {
  used_count: number;
  exposures: number;
}

export function progressMap(): Map<string, Progress> {
  const rows = db.prepare("SELECT lemma, used_count, exposures FROM word_progress").all() as unknown as ({
    lemma: string;
  } & Progress)[];
  return new Map(rows.map((r) => [r.lemma, r]));
}

/** 사용 횟수 기반의 0~5 숙련도. 제시만 되고 말하지 못한 단어는 0입니다. */
export function mastery(p: Progress | undefined): number {
  return Math.min(5, p?.used_count ?? 0);
}
