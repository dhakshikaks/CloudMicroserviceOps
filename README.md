# CloudMicroserviceOps

**Self-Tuning Multi-Cloud Root-Cause Prediction and Autonomous Remediation Platform for Distributed Microservices**

## Problem being solved

In a distributed microservices system, a single failing service often causes
cascading symptoms across many other services, making it hard to find the
actual root cause during an incident. Static, hand-maintained dependency maps
drift out of date quickly. This project builds a platform that:

1. Observes real runtime communication between services (via Kafka events),
2. Infers the live service dependency graph from that observation instead of
   a hard-coded map,
3. Uses that graph to rank the most likely root cause when multiple services
   report failures at once.

## Architecture

```
Browser
  │
  ▼
frontend (React)
  │  REST
  ▼
backend ◄──────────── Kafka (cloudops.*) ──────────┐
  │                                                 │
  │ owns: dependency graph, confidence scoring,     │
  │ root-cause analysis, event ingestion            │
  ▼                                                 │
Postgres                          user-service  order-service  payment-service  inventory-service
```

- **backend/** — a single Spring Boot application: consumes runtime events
  from Kafka, persists a normalized event log, infers the service dependency
  graph, and (once implemented) scores confidence and ranks root causes.
  Package layout: `controller`, `service`, `model`, `repository`, `kafka`,
  `graph` (dependency graph + confidence scoring), `rca` (root-cause
  analysis), `config`.
- **microservices/** — four independent Spring Boot services
  (`user-service`, `order-service`, `payment-service`, `inventory-service`)
  that exist to create a realistic distributed environment for the backend
  to observe. No API gateway or notification service at this stage.
- **frontend/** — React + TypeScript dashboard (Vite).
- **Data**: single PostgreSQL database, shared by all services.
- **Observability**: Spring Boot Actuator + Micrometer on every service,
  scraped by Prometheus, visualized in Grafana.

Module boundaries for algorithms not yet implemented:

| Responsibility | Interface | Package |
|---|---|---|
| Confidence scoring | `ConfidenceScorer` | `backend/.../graph` |
| Graph inference | `DependencyGraphService.rebuildGraph()` | `backend/.../graph` |
| Dependency graph analysis | `GraphAnalyzer` | `backend/.../rca` |
| Root-cause ranking | `RootCauseRanker` | `backend/.../rca` |

## Technologies

| Layer | Technology |
|---|---|
| Services | Java 21, Spring Boot 3.3, Maven |
| Messaging | Apache Kafka |
| Database | PostgreSQL 16 |
| Metrics | Prometheus, Micrometer |
| Dashboards | Grafana |
| Frontend | React 18, TypeScript, Vite |
| Runtime | Docker, Docker Compose |

## Repository structure

```
CloudMicroserviceOps/
├── backend/                   # Single Spring Boot app: events, graph, RCA
│   └── src/
├── microservices/              # Independent business services
│   ├── user-service/
│   ├── order-service/
│   ├── payment-service/
│   └── inventory-service/
├── frontend/                   # React monitoring dashboard
├── infrastructure/
│   ├── prometheus/
│   └── grafana/
├── docker-compose.yml
├── pom.xml                     # Maven parent/aggregator
├── .env.example
└── README.md
```

Each module under `backend/` and `microservices/` is an independently
buildable Maven module (`mvn -pl <module> package`), aggregated by the root
`pom.xml`.

## Running locally

```bash
cp .env.example .env       # adjust credentials as needed
docker compose up --build
```

| Component | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |
| Dependency graph (raw) | http://localhost:8080/api/dependency-graph/edges |

Or build the Java modules directly with Maven (`mvn -DskipTests package`)
against a locally running Postgres/Kafka.

### Exercising the call chain

```bash
# create a user
curl -s -X POST localhost:8081/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com"}'
# -> {"id":1,...}

# place an order as that user: user -> order -> payment -> inventory
curl -s -X POST localhost:8081/api/users/1/orders \
  -H 'Content-Type: application/json' \
  -d '{"itemId":"item-1","quantity":2}'

# check the events the backend consumed off Kafka and stored in Postgres
curl -s localhost:8080/api/events/recent
```

Each hop above publishes a `ServiceCallEvent` to the `microservice-events`
Kafka topic; `/api/events/recent` should show 3 events per order placed
(user→order, order→payment, payment→inventory).

## Current implementation status

This is an early architecture scaffold, not a feature-complete platform.
What exists today:

- ✅ 5 Spring Boot modules (backend + 4 business services) build and start,
  each with Actuator health/metrics/Prometheus endpoints wired.
- ✅ Minimal REST APIs for creating/getting users, orders, payments, and
  inventory reservations, each backed by its own Postgres table.
- ✅ Live REST call chain: `user-service` (`POST /api/users/{id}/orders`) →
  `order-service` → `payment-service` → `inventory-service`.
- ✅ Every inter-service call publishes a `ServiceCallEvent` (eventId,
  timestamp, sourceService, targetService, operation, status, durationMs)
  to the Kafka topic `microservice-events`.
- ✅ `backend` consumes `microservice-events` and persists each event
  (`GET /api/events/recent` to inspect what's landed).
- ✅ `backend` dependency graph data model (`DependencyEdge`) and read API
  (`GET /api/dependency-graph/edges`); module interfaces defined for
  confidence scoring and graph inference (not yet implemented).
- ✅ `backend` root-cause data model and module interfaces for graph
  analysis and ranking (not yet implemented).
- ✅ React + TypeScript dashboard shell with a live backend health check.
- ✅ Docker Compose stack: Postgres, Kafka (KRaft), Prometheus, Grafana,
  backend, 4 business services, frontend.
- ❌ Confidence scoring, graph inference, and root-cause ranking algorithms —
  interfaces only.
- ❌ Incident management — not yet implemented.
- ❌ Authentication / role-based access control — not yet implemented.
- ❌ Failure simulation tooling — not yet implemented.
- ❌ Cloud (AWS) deployment and CI/CD — future phase.

## Roadmap

**In scope for this MVP (remaining work):**
- Confidence-scoring and dependency-graph-inference implementation (consume
  the `service_events` log now being populated)
- Root-cause ranking and incident management implementation
- Failure simulation harness
- Authentication and role-based access control
- Dependency graph + root-cause visualization in the React dashboard

**Explicitly out of scope for now (future/industrial phases):**
- Kubernetes orchestration
- Multi-cloud deployment/orchestration
- Autonomous remediation
- Advanced ML / predictive failure propagation
- LLM agents
- Self-learning feedback loops
- AWS deployment, CI/CD
