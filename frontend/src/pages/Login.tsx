import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Crosshair, Eye, EyeOff, LineChart, Lock, Moon, Network, Sun, User, Waypoints } from "lucide-react";
import { login } from "../services/auth";
import { useTheme } from "../context/ThemeContext";

// Decorative service map for the showcase panel. Illustrative only - it
// shows the shape of what the product does, not live data.
const MAP_NODE_W = 136;
const MAP_NODE_H = 34;
const MAP_NODES = [
  { id: "backend", x: 8, y: 90, tone: "ok" },
  { id: "user-service", x: 162, y: 14, tone: "ok" },
  { id: "order-service", x: 162, y: 166, tone: "warn" },
  { id: "inventory-service", x: 316, y: 90, tone: "ok" },
  { id: "payment-service", x: 316, y: 166, tone: "bad" },
] as const;
const MAP_EDGES: { from: string; to: string; failing?: boolean }[] = [
  { from: "backend", to: "user-service" },
  { from: "backend", to: "order-service" },
  { from: "order-service", to: "inventory-service" },
  { from: "order-service", to: "payment-service", failing: true },
];

function edgePath(fromId: string, toId: string): string {
  const a = MAP_NODES.find((n) => n.id === fromId)!;
  const b = MAP_NODES.find((n) => n.id === toId)!;
  const x1 = a.x + MAP_NODE_W;
  const y1 = a.y + MAP_NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + MAP_NODE_H / 2;
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
}

function ServiceMap() {
  const rootCause = MAP_NODES.find((n) => n.tone === "bad")!;
  return (
    <svg className="login-map" viewBox="0 0 460 240" role="img" aria-label="Illustration of a service dependency map with a detected root cause">
      {MAP_EDGES.map((e) => {
        const d = edgePath(e.from, e.to);
        return (
          <g key={`${e.from}-${e.to}`}>
            <path d={d} className={`login-map-edge${e.failing ? " is-failing" : ""}`} />
            <circle r={2.6} className={`login-map-packet${e.failing ? " is-failing" : ""}`}>
              <animateMotion dur={e.failing ? "2.4s" : "3.2s"} repeatCount="indefinite" path={d} />
            </circle>
          </g>
        );
      })}
      {MAP_NODES.map((n) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`}>
          {n.tone === "bad" && <rect x={-5} y={-5} width={MAP_NODE_W + 10} height={MAP_NODE_H + 10} rx={11} className="login-map-halo" />}
          <rect width={MAP_NODE_W} height={MAP_NODE_H} rx={8} className={`login-map-node tone-${n.tone}`} />
          <circle cx={15} cy={MAP_NODE_H / 2} r={3.5} className={`login-map-dot tone-${n.tone}`} />
          <text x={26} y={MAP_NODE_H / 2 + 3.5} className="login-map-label">
            {n.id}
          </text>
        </g>
      ))}
      <g transform={`translate(${rootCause.x + MAP_NODE_W / 2},${rootCause.y + MAP_NODE_H + 18})`}>
        <rect x={-40} y={-10} width={80} height={19} rx={9.5} className="login-map-tag" />
        <text y={3.5} textAnchor="middle" className="login-map-tag-text">
          ROOT CAUSE
        </text>
      </g>
    </svg>
  );
}

const FEATURES = [
  { icon: Network, title: "Live dependency topology", body: "Every service-to-service call, drawn from real Kafka events." },
  { icon: Crosshair, title: "Ranked root-cause analysis", body: "Failures scored and traced upstream to the likely origin." },
  { icon: LineChart, title: "Prometheus metrics", body: "Request rate, errors, latency, CPU and memory per service." },
];

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <aside className="login-showcase">
        <div className="login-brand">
          <span className="login-brand-mark">
            <Waypoints size={17} strokeWidth={2.25} />
          </span>
          <div className="login-brand-text">
            <span className="login-brand-name">CloudMicroserviceOps</span>
            <span className="login-brand-tag">Observability &amp; root-cause platform</span>
          </div>
        </div>

        <div className="login-showcase-body">
          <h1 className="login-headline">
            See every service.
            <br />
            <span className="login-headline-accent">Find the root cause.</span>
          </h1>
          <p className="login-lede">
            Monitor service health, inspect the live dependency graph, and review root-cause analysis across your
            microservices - in one place.
          </p>

          <div className="login-map-card">
            <div className="login-map-card-head">
              <span className="login-map-card-title">Service map</span>
              <span className="login-map-card-live">
                <span className="login-map-card-live-dot" />
                Live
              </span>
            </div>
            <ServiceMap />
          </div>

          <ul className="login-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="login-feature-icon">
                  <f.icon size={16} />
                </span>
                <span>
                  <span className="login-feature-title">{f.title}</span>
                  <span className="login-feature-body">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <span className="login-showcase-foot mono">Spring Boot · Kafka · Prometheus · React</span>
      </aside>

      <main className="login-main">
        <button
          type="button"
          className="login-theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <div className="login-panel">
          <div className="login-brand login-brand-compact">
            <span className="login-brand-mark">
              <Waypoints size={17} strokeWidth={2.25} />
            </span>
            <span className="login-brand-name">CloudMicroserviceOps</span>
          </div>

          <div className="login-panel-head">
            <h2>Welcome back</h2>
            <p>Sign in to your operations workspace.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="username">Username</label>
              <div className="login-input">
                <User size={15} className="login-input-icon" />
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoFocus
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-input">
                <Lock size={15} className="login-input-icon" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-input-action"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">
                <AlertCircle size={15} />
                {error}
              </p>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading && <span className="login-spinner" />}
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          <p className="login-foot">
            <Lock size={12} />
            Sessions are secured with signed JWT tokens.
          </p>
        </div>
      </main>
    </div>
  );
}
