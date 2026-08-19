import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Wrench, X } from "lucide-react";
import { useNotifications } from "../context/NotificationsContext";
import type { NotificationRecord, NotificationType } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "unread" | "all" | "incidents" | "warnings" | "recovery" | "system";

const TABS: { id: Tab; label: string }[] = [
  { id: "unread", label: "Unread" },
  { id: "all", label: "All" },
  { id: "incidents", label: "Incidents" },
  { id: "warnings", label: "Warnings" },
  { id: "recovery", label: "Recovery" },
  { id: "system", label: "System" },
];

function matchesTab(n: NotificationRecord, tab: Tab, isRead: (id: string) => boolean): boolean {
  switch (tab) {
    case "unread":
      return !isRead(n.id);
    case "incidents":
      return n.type === "INCIDENT_DETECTED";
    case "warnings":
      return n.type === "FAILURE";
    case "recovery":
      return n.type === "RECOVERY";
    case "system":
      return false;
    case "all":
    default:
      return true;
  }
}

function iconFor(type: NotificationType) {
  if (type === "INCIDENT_DETECTED") return <AlertTriangle size={15} />;
  if (type === "RECOVERY") return <CheckCircle2 size={15} />;
  return <Wrench size={15} />;
}

function relativeTime(iso: string): string {
  const deltaSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.round(deltaSec / 60)}m ago`;
  return `${Math.round(deltaSec / 3600)}h ago`;
}

export default function NotificationDrawer({ isOpen, onClose }: Props) {
  const { notifications, isRead, markAsRead, markAllRead, clearAll } = useNotifications();
  const [tab, setTab] = useState<Tab>("unread");
  const navigate = useNavigate();

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => matchesTab(n, tab, isRead));

  function handleSelect(n: NotificationRecord) {
    markAsRead(n.id);
    if (n.type === "INCIDENT_DETECTED" || n.type === "RECOVERY") {
      navigate("/incidents");
    } else {
      navigate("/events");
    }
    onClose();
  }

  return (
    <>
      <div className="notif-scrim" onClick={onClose} />
      <aside className="notif-drawer">
        <div className="notif-drawer-head">
          <span className="notif-drawer-title">Notifications</span>
          <button type="button" className="notif-drawer-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="notif-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`notif-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="notif-actions">
          <button type="button" className="notif-action-btn" onClick={markAllRead}>
            Mark all read
          </button>
          <button type="button" className="notif-action-btn" onClick={clearAll}>
            Clear
          </button>
        </div>
        <div className="notif-list">
          {filtered.length === 0 && <div className="notif-empty">No notifications in this view.</div>}
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`notif-item${!isRead(n.id) ? " is-unread" : ""}${n.severity === "CRITICAL" ? " type-critical" : ""}`}
              onClick={() => handleSelect(n)}
            >
              <span className="notif-item-icon">{iconFor(n.type)}</span>
              <span className="notif-item-body">
                <span className="notif-item-title mono">{n.service}</span>
                <span className="notif-item-message">{n.message}</span>
                <span className="notif-item-time">{relativeTime(n.timestamp)}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
