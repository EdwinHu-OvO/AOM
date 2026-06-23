import { FormEvent, useState } from "react";
import { Lock, Phone } from "lucide-react";

interface Props {
  onLogin(phone: string, password: string): Promise<void>;
}

export function LoginView({ onLogin }: Props) {
  const [phone, setPhone] = useState("13800001111");
  const [password, setPassword] = useState("demo123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(phone, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-hero">
        <span className="brand-mark">PlateRun</span>
        <h1>Dinner plans, handled before you get hungry.</h1>
        <p>Browse nearby favorites, schedule dinner for later, or get lunch moving now.</p>
      </section>
      <form className="login-panel" onSubmit={submit}>
        <h2>Welcome back</h2>
        <label>
          <span>Phone number</span>
          <div className="field">
            <Phone size={18} />
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
        </label>
        <label>
          <span>Password</span>
          <div className="field">
            <Lock size={18} />
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-action" disabled={busy} type="submit">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
