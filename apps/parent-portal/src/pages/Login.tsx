import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("raj.kumar@example.com");
  const [password, setPassword] = useState("Parent@123");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg p-6">
        <h1 className="text-xl font-bold text-center">Parent Login</h1>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Password" required />
          <button type="submit" className="w-full rounded-lg bg-blue-600 text-white py-2 font-medium">Sign in</button>
        </form>
        <p className="mt-3 text-xs text-slate-500 text-center">Demo: raj.kumar@example.com / Parent@123</p>
      </div>
    </div>
  );
}
