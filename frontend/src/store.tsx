import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Meta, type Scenario } from "./api";
import { useSettings, type Settings } from "./settings";

interface Store {
  meta?: Meta;
  scenarios: Scenario[];
  loadError?: string;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta>();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadError, setLoadError] = useState<string>();
  const [settings, updateSettings] = useSettings();

  useEffect(() => {
    Promise.all([api.meta(), api.scenarios()])
      .then(([m, s]) => {
        setMeta(m);
        setScenarios(s);
      })
      .catch(() => setLoadError("서버에 연결할 수 없습니다. 백엔드(npm run dev)가 실행 중인지 확인하세요."));
  }, []);

  return <Ctx.Provider value={{ meta, scenarios, loadError, settings, updateSettings }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}

/** 간단한 비동기 로더 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (e: Error) => alive && setState({ error: e.message, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** 활용형까지 고려해 발화에 표제어가 쓰였는지 대략 판단합니다. (최종 집계는 서버가 합니다) */
export function usesWord(text: string, lemma: string): boolean {
  const stem = lemma.replace(/e$/, "").replace(/y$/, "");
  const re = new RegExp(`\\b(${lemma}|${stem}(?:e|y|i)?)(s|es|d|ed|ing|er|est|ies|ied)?\\b`, "i");
  return re.test(text);
}
