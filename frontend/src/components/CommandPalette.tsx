import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  Network,
  Server,
  type LucideIcon,
} from "lucide-react";
import { getRootCauses, MONITORED_SERVICES } from "../services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  group: "Navigation" | "Service" | "Incident";
  icon: LucideIcon;
  to: string;
}

const NAV_ITEMS: PaletteItem[] = [
  { id: "nav-overview", label: "Overview", group: "Navigation", icon: LayoutDashboard, to: "/" },
  { id: "nav-services", label: "Services", group: "Navigation", icon: Server, to: "/services" },
  { id: "nav-topology", label: "Topology", group: "Navigation", icon: Network, to: "/topology" },
  { id: "nav-metrics", label: "Metrics", group: "Navigation", icon: LineChart, to: "/metrics" },
  { id: "nav-events", label: "Events", group: "Navigation", icon: Activity, to: "/events" },
  { id: "nav-incidents", label: "Incidents / Root Cause", group: "Navigation", icon: AlertTriangle, to: "/incidents" },
  { id: "nav-health", label: "System Health", group: "Navigation", icon: HeartPulse, to: "/system/health" },
];

export default function CommandPalette({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeIncidentService, setActiveIncidentService] = useState<string | null>(null);
  const navigate = useNavigate();

  // Cheap one-shot check on open (not a continuous poll) - only real data,
  // no fabricated "search results".
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActiveIndex(0);
    getRootCauses()
      .then((candidates) => setActiveIncidentService(candidates.length > 0 ? candidates[0].service : null))
      .catch(() => setActiveIncidentService(null));
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const serviceItems: PaletteItem[] = MONITORED_SERVICES.map((name) => ({
      id: `service-${name}`,
      label: name,
      group: "Service",
      icon: Server,
      to: `/services/${name}`,
    }));
    const incidentItem: PaletteItem[] = activeIncidentService
      ? [
          {
            id: "incident-active",
            label: `Jump to active incident (${activeIncidentService})`,
            group: "Incident",
            icon: AlertTriangle,
            to: "/incidents",
          },
        ]
      : [];
    return [...incidentItem, ...NAV_ITEMS, ...serviceItems];
  }, [activeIncidentService]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          navigate(item.to);
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, activeIndex, navigate, onClose]);

  if (!isOpen) return null;

  let renderIndex = -1;

  return (
    <div className="command-palette-scrim" onClick={onClose}>
      <div className="command-palette" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="command-palette-input"
          placeholder="Search services, topology, incidents, events..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="command-palette-list">
          {filtered.length === 0 && <div className="command-palette-empty">No matches.</div>}
          {(["Incident", "Navigation", "Service"] as const).map((group) => {
            const groupItems = filtered.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div className="command-palette-group" key={group}>
                <div className="command-palette-group-label">{group}</div>
                {groupItems.map((item) => {
                  renderIndex += 1;
                  const isActive = renderIndex === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`command-palette-item${isActive ? " active" : ""}`}
                      onMouseEnter={() => setActiveIndex(renderIndex)}
                      onClick={() => {
                        navigate(item.to);
                        onClose();
                      }}
                    >
                      <item.icon size={14} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
