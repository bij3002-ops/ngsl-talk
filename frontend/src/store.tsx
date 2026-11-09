import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Meta, type Scenario } from "./api";
import { useSettings, type Settings } from "./settings";

/** checking: 확인 중, needed: 로그인 필요, ok: 사용 가능 */
export type AuthState = "checking" | "needed" | "ok";

interface Store {
  meta?: Meta;
  scenarios: Scenario[];
  loadError?: string;
  auth: AuthState;
  authRequired: boolean;
  onLoggedIn: () => void;
  onLoggedOut: () => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta>();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadError, setLoadError] = useState<string>();
  const [auth, setAuth] = useState<AuthState>("checking");
  const [authRequired, setAuthRequired] = useState(false);
  const [settings, updateSettings] = useSettings();

  useEffect(() => {
    api.authStatus().then(
      (s) => {
        setAuthRequired(s.required);
        setAuth(s.loggedIn ? "ok" : "needed");
      },
      () => {
        setLoadError("서버에 연결할 수 없습니다. 백엔드(npm run dev)가 실행 중인지 확인하세요.");
        setAuth("ok");
      },
    );
    const onExpired = () => setAuth("needed");
    window.addEventListener("auth-required", onExpired);
    return () => window.removeEventListener("auth-required", onExpired);
  }, []);

  useEffect(() => {
    if (auth !== "ok" || loadError) return;
    Promise.all([api.meta(), api.scenarios()])
      .then(([m, s]) => {
        setMeta(m);
        setScenarios(s);
      })
      .catch(() => setLoadError("서버에 연결할 수 없습니다. 백엔드(npm run dev)가 실행 중인지 확인하세요."));
  }, [auth, loadError]);

  const value: Store = {
    meta,
    scenarios,
    loadError,
    auth,
    authRequired,
    onLoggedIn: () => setAuth("ok"),
    onLoggedOut: () => setAuth("needed"),
    settings,
    updateSettings,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
