import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getNotifications, getRootCauses, LIVE_WINDOW_MINUTES } from "../services/api";
import { usePolling } from "../hooks/usePolling";
import { useIncidentState } from "../hooks/useIncidentState";
import type { NotificationRecord, RootCauseCandidate } from "../types";

const POLL_INTERVAL_MS = 8000;
const READ_STORAGE_KEY = "cmo.notifications.read";
const CLEARED_STORAGE_KEY = "cmo.notifications.cleared";

function loadIdSet(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable (private mode, quota) - read/unread state
    // simply won't persist across reloads; not fatal.
  }
}

interface NotificationsContextValue {
  notifications: NotificationRecord[];
  unreadCount: number;
  isRead: (id: string) => boolean;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [serverNotifications, setServerNotifications] = useState<NotificationRecord[]>([]);
  const [rootCauses, setRootCauses] = useState<RootCauseCandidate[] | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadIdSet(READ_STORAGE_KEY));
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => loadIdSet(CLEARED_STORAGE_KEY));

  usePolling(() => {
    getNotifications(LIVE_WINDOW_MINUTES).then(setServerNotifications).catch(() => {});
    getRootCauses(LIVE_WINDOW_MINUTES).then(setRootCauses).catch(() => {});
  }, POLL_INTERVAL_MS);

  // Recovery is an inherently stateful transition (incident present, then
  // absent) that a stateless backend cannot honestly report - so it is
  // derived client-side by reusing the same hook that already drives the
  // Overview/Incidents "recovered" banner, not reinvented here.
  const incidentState = useIncidentState(rootCauses);

  const recoveryNotification: NotificationRecord | null = useMemo(() => {
    if (incidentState.status !== "recovered" || !incidentState.lastIncident || !incidentState.recoveredAt) {
      return null;
    }
    return {
      id: `recovery-${incidentState.lastIncident.service}-${incidentState.recoveredAt}`,
      type: "RECOVERY",
      service: incidentState.lastIncident.service,
      message: `${incidentState.lastIncident.service} recovered - no active root cause detected`,
      timestamp: new Date(incidentState.recoveredAt).toISOString(),
      severity: "INFO",
    };
  }, [incidentState]);

  const notifications = useMemo(() => {
    const all = recoveryNotification ? [recoveryNotification, ...serverNotifications] : serverNotifications;
    return all
      .filter((n) => !clearedIds.has(n.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [serverNotifications, recoveryNotification, clearedIds]);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveIdSet(READ_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveIdSet(READ_STORAGE_KEY, next);
      return next;
    });
  }, [notifications]);

  const clearAll = useCallback(() => {
    setClearedIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveIdSet(CLEARED_STORAGE_KEY, next);
      return next;
    });
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  useEffect(() => {
    // Cleared/read id sets only ever grow; cap them so long-running sessions
    // don't accumulate unbounded localStorage entries for events that have
    // long since rolled out of the live window.
    const MAX_TRACKED = 500;
    if (readIds.size > MAX_TRACKED) {
      const trimmed = new Set([...readIds].slice(-MAX_TRACKED));
      setReadIds(trimmed);
      saveIdSet(READ_STORAGE_KEY, trimmed);
    }
    if (clearedIds.size > MAX_TRACKED) {
      const trimmed = new Set([...clearedIds].slice(-MAX_TRACKED));
      setClearedIds(trimmed);
      saveIdSet(CLEARED_STORAGE_KEY, trimmed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readIds.size, clearedIds.size]);

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    isRead,
    markAsRead,
    markAllRead,
    clearAll,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
