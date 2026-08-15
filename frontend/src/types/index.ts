export interface DependencyEdge {
  sourceService: string;
  targetService: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  confidence: number;
  lastObservedAt: string | null;
}

export interface GraphNode {
  id: string;
}

export interface DependencyGraphResponse {
  nodes: GraphNode[];
  edges: DependencyEdge[];
}

export interface RootCauseCandidate {
  service: string;
  score: number;
  rank: number;
  affectedDownstreamServices: string[];
  reason: string;
}

export interface ServiceEventRecord {
  eventId: string;
  timestamp: string;
  sourceService: string;
  targetService: string;
  operation: string;
  status: string;
  durationMs: number;
  receivedAt: string;
}

export type ServiceMetrics = Record<string, number>;

/** true = up, false = down, undefined = not yet scraped/reported. */
export interface ServiceHealthMap {
  [service: string]: boolean | undefined;
}

export type ServiceStatus = "UP" | "DOWN" | "DEGRADED" | "UNKNOWN";

export type UserRole = "VIEWER" | "OPERATOR" | "ADMIN";

export interface AuthUser {
  username: string;
  role: UserRole;
}
