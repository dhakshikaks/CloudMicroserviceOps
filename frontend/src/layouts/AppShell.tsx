import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Bell, Download, Search } from "lucide-react";
import Sidebar from "../components/Sidebar";
import CommandPalette from "../components/CommandPalette";
import NotificationDrawer from "../components/NotificationDrawer";
import { NotificationsProvider, useNotifications } from "../context/NotificationsContext";
import { useTimeWindow } from "../context/TimeWindowContext";
import { TIME_WINDOWS } from "../services/api";

function AppShellInner() {
  const { timeWindow, setTimeWindow } = useTimeWindow();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

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
      <Sidebar />
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-live" title="Dashboard is polling live data">
            <span className="live-dot" />
            LIVE
          </div>
          <div className="topbar-window">
            <label htmlFor="time-window-select">Chart window</label>
            <select
              id="time-window-select"
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as typeof timeWindow)}
            >
              {TIME_WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div className="topbar-spacer" />
          <button type="button" className="topbar-search" onClick={() => setPaletteOpen(true)}>
            <Search size={14} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <button type="button" className="topbar-icon-btn" title="Export current view" onClick={() => navigate("/reports")}>
            <Download size={15} />
          </button>
          <button type="button" className="topbar-icon-btn" title="Notifications" onClick={() => setNotifOpen(true)}>
            <Bell size={15} />
            {unreadCount > 0 && <span className="badge-count mono">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

export default function AppShell() {
  return (
    <NotificationsProvider>
      <AppShellInner />
    </NotificationsProvider>
  );
}
