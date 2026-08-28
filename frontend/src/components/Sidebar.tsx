import { NavLink, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  Download,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  LogOut,
  Network,
  Search,
  Server,
  type LucideIcon,
} from "lucide-react";
import type { ServiceHealthMap } from "../types";
import { getCurrentUser, logout } from "../services/auth";
import { getServiceHealth, MONITORED_SERVICES } from "../services/api";
import { useFetchState } from "../hooks/useFetchState";
import { usePolling } from "../hooks/usePolling";
import { deriveSystemPulse } from "../lib/status";

const POLL_INTERVAL_MS = 7000;

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Static, honest one-liner about what this page shows - not a live number. */
  meta: string;
}

interface NavSection {
  heading: string | null;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  { heading: null, items: [{ to: "/", label: "Overview", icon: LayoutDashboard, end: true, meta: "Live system snapshot" }] },
  {
    heading: "Monitor",
    items: [
      { to: "/services", label: "Services", icon: Server, meta: `${MONITORED_SERVICES.length} monitored services` },
      { to: "/topology", label: "Topology", icon: Network, meta: "Live dependency graph" },
      { to: "/metrics", label: "Metrics", icon: LineChart, meta: "CPU · memory · latency" },
      { to: "/events", label: "Events", icon: Activity, meta: "Live request/response log" },
    ],
  },
  {
    heading: "Investigate",
    items: [{ to: "/incidents", label: "Incident Center", icon: AlertTriangle, meta: "Automated root-cause detection" }],
  },
  { heading: "Reports", items: [{ to: "/reports", label: "Report Center", icon: FileText, meta: "CSV & PDF exports" }] },
  {
    heading: "System",
    items: [{ to: "/system/health", label: "System Health", icon: HeartPulse, meta: "Prometheus & uptime checks" }],
  },
];

interface Props {
  onSearch: () => void;
  onNotifications: () => void;
  onExport: () => void;
  unreadCount: number;
}

export default function Sidebar({ onSearch, onNotifications, onExport, unreadCount }: Props) {
  // Self-contained: the sidebar's pulse dot needs live health, independent of
  // whatever the current page is already fetching for its own display.
  const health = useFetchState<ServiceHealthMap>();
  usePolling(() => health.run(getServiceHealth()), POLL_INTERVAL_MS);
  const systemPulse = deriveSystemPulse(health.data, MONITORED_SERVICES);

  const user = getCurrentUser();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const pulseLabel =
    systemPulse === "ok" ? "System status · connected" : systemPulse === "warn" ? "System status · degraded" : "System status · checking";
  // "warn" from deriveSystemPulse means a service is confirmed down (worse
  // than merely unknown), so it maps to the inverted "bad" dot; "unknown"
  // (status not yet observed) maps to the muted "warn" dot. Intentional, not a typo.
  const pulseDotClass = systemPulse === "ok" ? "ok" : systemPulse === "warn" ? "bad" : "warn";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark" />
        <span className="sidebar-brand-text">
          <span className="sidebar-brand-name">CloudMicroserviceOps</span>
          <span className="sidebar-brand-tag">Observability Platform</span>
        </span>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section, i) => (
          <div className="sidebar-section" key={section.heading ?? `section-${i}`}>
            {section.heading && <div className="sidebar-section-heading">{section.heading}</div>}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              >
                <item.icon size={15} className="sidebar-link-icon" />
                <span className="sidebar-link-text">
                  <span className="sidebar-link-label">{item.label}</span>
                  <span className="sidebar-link-meta">{item.meta}</span>
                </span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-utility-row">
          <button type="button" className="sidebar-utility-btn" title="Search (⌘K)" onClick={onSearch}>
            <Search size={14} />
          </button>
          <button type="button" className="sidebar-utility-btn" title="Export current view" onClick={onExport}>
            <Download size={14} />
          </button>
          <button type="button" className="sidebar-utility-btn" title="Notifications" onClick={onNotifications}>
            <Bell size={14} />
            {unreadCount > 0 && <span className="badge-count mono">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>
        </div>
        <div className="system-pulse">
          <span className={`system-pulse-dot ${pulseDotClass}`} />
          <span>{pulseLabel}</span>
        </div>
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.username}</span>
              <span className="sidebar-user-role">{user.role}</span>
            </div>
            <button type="button" className="logout-button" onClick={handleLogout} title="Log out">
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
