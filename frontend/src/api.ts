import type { LiveConnectConfig } from "@google/genai";

export type Level = "beginner" | "intermediate" | "advanced";

export interface Meta {
  source: "official" | "sample";
  totalWords: number;
  bands: { band: number; from: number; to: number }[];
  live: { configured: boolean; model: string; voices: string[] };
}

export interface Scenario {
  id: string;
  emoji: string;
  title: string;
  titleKo: string;
  level: Level;
  goalKo: string;
}

export interface WordRow {
  rank: number;
  lemma: string;
  band: number;
  usedCount: number;
  exposures: number;
  mastery: number;
}

export interface Line {
  role: "user" | "tutor";
  text: string;
}

export interface SessionSummary {
  id: number;
  scenarioId: string;
  day: string;
  createdAt: string;
  durationSec: number;
  targets: string[];
  usedTargets: string[];
  ngslUsed: string[];
}

export interface SessionDetail extends SessionSummary {
  transcript: Line[];
}

export interface Progress {
  streak: number;
  activeToday: boolean;
  todayMinutes: number;
  totalSessions: number;
  totalMinutes: number;
  wordsUsed: number;
  bandStats: { band: number; from: number; to: number; used: number; total: number }[];
  recent: SessionSummary[];
}

export interface LiveToken {
  token: string;
  expireTime: string;
  model: string;
  config: LiveConnectConfig;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch("/api" + path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `요청 실패 (${res.status})`);
  return data as T;
}

/** 학습자 기기 기준의 오늘 날짜(YYYY-MM-DD) */
export function localDay(d = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const api = {
  meta: () => request<Meta>("/meta"),
  scenarios: () => request<Scenario[]>("/scenarios"),
  words: (band: number, q = "") => request<WordRow[]>(`/words?band=${band}&q=${encodeURIComponent(q)}`),
  targets: (band: number, count = 6) => request<string[]>(`/words/targets?band=${band}&count=${count}`),
  progress: () => request<Progress>(`/progress?today=${localDay()}`),
  session: (id: number) => request<SessionDetail>(`/sessions/${id}`),
  liveToken: (body: { scenarioId: string; targetWords: string[]; level: Level; voice: string }) =>
    request<LiveToken>("/live/token", { method: "POST", body: JSON.stringify(body) }),
  saveSession: (body: { scenarioId: string; day: string; durationSec: number; targetWords: string[]; transcript: Line[] }) =>
    request<{ id: number }>("/sessions", { method: "POST", body: JSON.stringify(body) }),
};

export const LEVEL_KO: Record<Level, string> = { beginner: "초급", intermediate: "중급", advanced: "고급" };
