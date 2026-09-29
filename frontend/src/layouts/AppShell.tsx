import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Pause, Play, RefreshCw, Timer } from "lucide-react";
import Sidebar from "../components/Sidebar";
import CommandPalette from "../components/CommandPalette";
import NotificationDrawer from "../components/NotificationDrawer";
import StatusBar from "../components/StatusBar";
import { NotificationsProvider, useNotifications } from "../context/NotificationsContext";
import { useTimeWindow } from "../context/TimeWindowContext";
import { RefreshProvider, useRefresh } from "../context/RefreshContext";
import { MONITORED_SERVICES, TIME_WINDOWS, getServiceHealth } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import type { ServiceHealthMap } from "../types";

const HEALTH_POLL_MS = 7000;

// Route -> the page name shown in the topbar breadcrumb.
// Kept in sync with Sidebar's NAV_SECTIONS by hand (small, stable list).
function pageTitleFor(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/services")) return "Services";
  if (pathname.startsWith("/topology")) return "Topology";
  if (pathname.startsWith("/metrics")) return "Metrics";
  if (pathname.startsWith("/events")) return "Events";
  if (pathname.startsWith("/incidents")) return "Incident Center";
  if (pathname.startsWith("/reports")) return "Report Center";
  if (pathname.startsWith("/system")) return "System Health";
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
    <span className="topbar-chip mono" title="Time since this session started">
      <Timer size={12} />
      {elapsed.toFixed(0)}s
    </span>
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
  const healthTone = !health.data ? "muted" : upCount === MONITORED_SERVICES.length ? "good" : "bad";
  const runTone = paused ? "muted" : health.error ? "bad" : "live";

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
            <nav className="topbar-crumbs" aria-label="Breadcrumb">
              <span className="topbar-crumb-root">Workspace</span>
              <ChevronRight size={13} className="topbar-crumb-sep" />
              <span className="topbar-crumb-current">{pageTitleFor(location.pathname)}</span>
            </nav>
            <div className="topbar-chips">
              <span className={`topbar-chip tone-${healthTone}`} title="Services reporting up">
                <span className="topbar-chip-dot" />
                <span className="mono">
                  {health.data ? upCount : "—"}/{MONITORED_SERVICES.length}
                </span>
                healthy
              </span>
              <span className={`topbar-chip tone-${runTone}`} title="Live update status">
                <span className={`topbar-chip-dot${runTone === "live" ? " is-pulsing" : ""}`} />
                {paused ? "Paused" : health.error ? "Reconnecting" : "Live"}
              </span>
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
        </header>
        <main className="app-main">
          <div className="route-fade" key={pageTitleFor(location.pathname)}>
            <Outlet />
          </div>
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
