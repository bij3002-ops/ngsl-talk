import { lazy, Suspense } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Notice } from "./components/ui";
import Home from "./screens/Home";
import Login from "./screens/Login";
import Me from "./screens/Me";
import Result from "./screens/Result";
import Talk from "./screens/Talk";
import Words from "./screens/Words";
import { useStore } from "./store";

// Gemini SDK가 큰 편이라 음성 대화 화면은 필요할 때 불러옵니다.
const TalkSession = lazy(() => import("./screens/TalkSession"));

const TABS = [
  { to: "/", label: "홈", icon: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { to: "/talk", label: "회화", icon: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm-7 9a7 7 0 0 0 14 0M12 19v3" },
  { to: "/words", label: "단어", icon: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zm0 0v16M8 7h6" },
  { to: "/me", label: "나", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" },
];

export default function App() {
  const { loadError, auth } = useStore();
  const { pathname } = useLocation();
  const immersive = /^\/(talk\/|result\/)/.test(pathname);

  if (auth !== "ok") {
    return (
      <div className="app immersive">
        <main className="screen">{auth === "needed" ? <Login /> : null}</main>
      </div>
    );
  }

  return (
    <div className={`app ${immersive ? "immersive" : ""}`}>
      <main className="screen">
        {loadError && <Notice tone="error">{loadError}</Notice>}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/talk" element={<Talk />} />
          <Route
            path="/talk/:scenarioId"
            element={
              <Suspense fallback={<Notice>불러오는 중…</Notice>}>
                <TalkSession />
              </Suspense>
            }
          />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/words" element={<Words />} />
          <Route path="/me" element={<Me />} />
        </Routes>
      </main>
      {!immersive && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === "/"} className="tab">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d={t.icon} />
              </svg>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
