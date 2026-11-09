import { useCallback, useState } from "react";
import type { Level } from "./api";

export interface Settings {
  level: Level;
  voice: string;
  dailyGoalMin: number;
  band: number;
  targetCount: number;
}

const DEFAULTS: Settings = { level: "beginner", voice: "Kore", dailyGoalMin: 10, band: 1, targetCount: 6 };
const KEY = "ngsl-talk:settings";

function read(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

/** 기기별 학습 설정. 브라우저 저장소가 막혀 있어도 기본값으로 동작합니다. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(read);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* 저장 실패는 무시 */
      }
      return next;
    });
  }, []);
  return [settings, update] as const;
}
