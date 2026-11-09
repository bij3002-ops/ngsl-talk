import { useState, type FormEvent } from "react";
import { api } from "../api";
import { Notice } from "../components/ui";
import { useStore } from "../store";

export default function Login() {
  const { onLoggedIn } = useStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api.login(password);
      onLoggedIn();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="stack login" onSubmit={submit}>
      <div className="prep-hero">
        <span className="logo big">N</span>
        <h1>NGSL Talk</h1>
        <p className="muted">접속 비밀번호를 입력하세요.</p>
      </div>
      <input
        className="input"
        type="password"
        autoComplete="current-password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn primary block" disabled={busy || !password}>
        {busy ? "확인 중…" : "들어가기"}
      </button>
    </form>
  );
}
