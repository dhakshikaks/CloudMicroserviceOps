import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Search } from "lucide-react";
import Sidebar from "../components/Sidebar";
import CommandPalette from "../components/CommandPalette";
import { useTimeWindow } from "../context/TimeWindowContext";
import { TIME_WINDOWS } from "../services/api";

export default function AppShell() {
  const { timeWindow, setTimeWindow } = useTimeWindow();
  const [paletteOpen, setPaletteOpen] = useState(false);

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
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
