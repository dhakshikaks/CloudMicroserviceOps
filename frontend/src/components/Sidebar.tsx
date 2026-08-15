import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../services/auth";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "services", label: "Services" },
  { id: "dependency-graph", label: "Dependency Graph" },
  { id: "incidents", label: "Incidents / Root Cause" },
  { id: "events", label: "Events" },
];

interface Props {
  systemPulse: "ok" | "warn" | "unknown";
}

export default function Sidebar({ systemPulse }: Props) {
  const [active, setActive] = useState("overview");
  const user = getCurrentUser();
  const navigate = useNavigate();

  function handleNavClick(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const pulseLabel =
    systemPulse === "ok" ? "All systems operational" : systemPulse === "warn" ? "Degraded" : "Checking status";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark" />
        <span className="sidebar-brand-text">
          <span className="sidebar-brand-name">CloudMicroserviceOps</span>
          <span className="sidebar-brand-tag">Observability</span>
        </span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-link${active === item.id ? " active" : ""}`}
            onClick={() => handleNavClick(item.id)}
          >
            <span className="sidebar-link-dot" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="system-pulse">
          <span className={`system-pulse-dot ${systemPulse === "ok" ? "ok" : systemPulse === "warn" ? "bad" : "warn"}`} />
          <span>{pulseLabel}</span>
        </div>
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.username}</span>
              <span className="sidebar-user-role">{user.role}</span>
            </div>
            <button type="button" className="logout-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
