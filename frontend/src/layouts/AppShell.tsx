import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Pause, Play, RefreshCw } from "lucide-react";
import Sidebar from "../components/Sidebar";
import CommandPalette from "../components/CommandPalette";
import NotificationDrawer from "../components/NotificationDrawer";
import StatusBar from "../components/StatusBar";
import { NotificationsProvider, useNotifications } from "../context/NotificationsContext";
import { useTimeWindow } from "../context/TimeWindowContext";
import { RefreshProvider, useRefresh } from "../context/RefreshContext";
import { API_BASE_URL, MONITORED_SERVICES, TIME_WINDOWS, getServiceHealth } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import type { ServiceHealthMap } from "../types";

const HEALTH_POLL_MS = 7000;

// Route -> the nav section label it belongs to, for the "PHASE" badge.
// Kept in sync with Sidebar's NAV_SECTIONS by hand (small, stable list).
function phaseLabelFor(pathname: string): string {
  if (pathname === "/") return "OVERVIEW";
  if (pathname.startsWith("/services")) return "SERVICES";
  if (pathname.startsWith("/topology")) return "TOPOLOGY";
  if (pathname.startsWith("/metrics")) return "METRICS";
  if (pathname.startsWith("/events")) return "EVENTS";
  if (pathname.startsWith("/incidents")) return "INCIDENTS";
  if (pathname.startsWith("/reports")) return "REPORTS";
  if (pathname.startsWith("/system")) return "SYSTEM";
  return "—";
}

// Isolated in its own component so the once-a-second tick re-renders just
// this field, not the whole topbar (search, notifications, refresh button, ...).
function ElapsedField() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="topbar-field">
      <span className="topbar-field-label">Elapsed</span>
      <span className="topbar-field-value-pill mono">{elapsed.toFixed(1)}s</span>
    </div>
  );
}

function AppShellInner() {
  const { timeWindow, setTimeWindow } = useTimeWindow();
  const { requestRefresh } = useRefresh();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Self-contained, same pattern as Sidebar's own pulse poll: the topbar's
  // live status/count badges need health data independent of whatever the
  // current page is already fetching for its own display. Respects the
  // "Pause" toggle - a real stop of this poll, not just a visual state.
  const health = useFetchState<ServiceHealthMap>();
  usePolling(() => {
    if (!paused) health.run(getServiceHealth());
  }, HEALTH_POLL_MS);
  const upCount = health.data ? MONITORED_SERVICES.filter((s) => health.data![s] !== false).length : 0;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar
        onSearch={() => setPaletteOpen(true)}
        onExport={() => navigate("/reports")}
        onNotifications={() => setNotifOpen(true)}
        unreadCount={unreadCount}
      />
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-main">
            <div className="window-traffic-lights" aria-hidden>
              <span className="traffic-light red" />
              <span className="traffic-light yellow" />
              <span className="traffic-light green" />
            </div>
            <div className="topbar-brand">
              <span className="topbar-brand-mark">CM</span>
              <span className="topbar-brand-text">
                <span className="topbar-brand-name">CloudMicroserviceOps</span>
                <span className="topbar-brand-tag">Observability Platform</span>
              </span>
            </div>
            <div className="topbar-context">
              <span className="topbar-context-label">Monitoring</span>
              <span className="topbar-context-value mono">
                {upCount}/{MONITORED_SERVICES.length} services
              </span>
            </div>
            <div className="topbar-fields">
              <div className="topbar-field">
                <span className="topbar-field-label">Run</span>
                <span className={`topbar-field-value-pill mono${paused ? "" : health.error ? " tone-down" : " tone-live"}`}>
                  {paused ? "paused" : health.error ? "reconnecting" : "live"}
                </span>
              </div>
              <div className="topbar-field">
                <span className="topbar-field-label">Phase</span>
                <span className="topbar-field-value-pill mono">{phaseLabelFor(location.pathname)}</span>
              </div>
              <ElapsedField />
            </div>
            <div className="topbar-spacer" />
            <button
              type="button"
              className="btn-outline-icon"
              title={paused ? "Resume live updates" : "Pause live updates"}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
              {paused ? "Resume" : "Pause"}
            </button>
            <div className="segmented-control" role="tablist" aria-label="Chart window">
              {TIME_WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  role="tab"
                  aria-selected={timeWindow === w}
                  className={`segmented-control-item${timeWindow === w ? " active" : ""}`}
                  onClick={() => setTimeWindow(w)}
                >
                  {w}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary-accent"
              title="Refresh all live data now"
              onClick={() => {
                requestRefresh();
                if (!paused) health.run(getServiceHealth());
              }}
            >
              <RefreshCw size={13} />
              Refresh now
            </button>
          </div>
          <div className="topbar-subline">CloudMicroserviceOps · {API_BASE_URL}</div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
        <StatusBar />
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

export default function AppShell() {
  return (
    <RefreshProvider>
      <NotificationsProvider>
        <AppShellInner />
      </NotificationsProvider>
    </RefreshProvider>
  );
}
