import { NavLink, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  LogOut,
  Network,
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
}

interface NavSection {
  heading: string | null;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  { heading: null, items: [{ to: "/", label: "Overview", icon: LayoutDashboard, end: true }] },
  {
    heading: "Monitor",
    items: [
      { to: "/services", label: "Services", icon: Server },
      { to: "/topology", label: "Topology", icon: Network },
      { to: "/metrics", label: "Metrics", icon: LineChart },
      { to: "/events", label: "Events", icon: Activity },
    ],
  },
  { heading: "Investigate", items: [{ to: "/incidents", label: "Incident Center", icon: AlertTriangle }] },
  { heading: "Reports", items: [{ to: "/reports", label: "Report Center", icon: FileText }] },
  { heading: "System", items: [{ to: "/system/health", label: "System Health", icon: HeartPulse }] },
];

export default function Sidebar() {
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
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
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
