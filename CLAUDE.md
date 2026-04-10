# Log Monitor — Project Plan

## Overview
A self-hostable log monitoring application that reads logs from a database, provides rich filtering/visualization, and uses Claude AI to summarize and explain errors.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SPA dashboard, fast HMR |
| Tables | TanStack Table + Virtual | Handles 100k+ rows without lag |
| Charts | Recharts | React-native, small bundle |
| State | Zustand + TanStack Query | Filters local, server state cached |
| Styling | Tailwind CSS + shadcn/ui | Dense data UIs fast |
| Backend | Node.js + Fastify | 2-3x faster than Express, typed |
| ORM | Prisma | SQLite (dev) → PostgreSQL (prod) in one env var |
| AI | @anthropic-ai/sdk + Claude 3.5 Sonnet | Best reasoning-to-cost ratio for log analysis |

---

## Architecture

```
Browser (React SPA)
  Dashboard | Log Table | AI Panel | Charts
       │ REST + WebSocket
Fastify API (Node.js)
  /api/logs  /api/stats  /api/ai  WS:/live
       │
  Prisma ORM → PostgreSQL / SQLite
       │
  Anthropic API (for AI summaries)
```

---

## Database Schema

```prisma
model LogEntry {
  id          String    @id @default(cuid())
  timestamp   DateTime  @default(now()) @db.Timestamptz
  level       LogLevel
  service     String
  message     String
  metadata    Json?
  traceId     String?
  spanId      String?
  host        String?
  environment String    @default("production")
  createdAt   DateTime  @default(now())

  @@index([timestamp])
  @@index([level])
  @@index([service])
  @@index([level, timestamp])
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
  FATAL
}

model AISummary {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  prompt    String
  response  String
  logCount  Int
  fromTime  DateTime
  toTime    DateTime
  services  String[]
  model     String
}
```

---

## Folder Structure

```
Log Monitor/
├── apps/
│   ├── web/                    # React frontend (Vite)
│   │   └── src/
│   │       ├── components/     # layout/, logs/, filters/, charts/, ai/, dashboard/
│   │       ├── hooks/          # useLogs, useLogStream, useAISummary, useFilters
│   │       ├── stores/         # filterStore, uiStore (Zustand)
│   │       └── pages/          # DashboardPage, LogsPage, AIPage, SettingsPage
│   └── api/                    # Fastify backend
│       ├── src/
│       │   ├── routes/         # logs, stats, ai, ingest, ws
│       │   ├── services/       # log, stats, ai, ingest
│       │   ├── lib/            # prisma.ts, anthropic.ts
│       │   ├── jobs/           # retention.job.ts, summarize.job.ts
│       │   ├── middleware/     # auth, error, rateLimit
│       │   └── schemas/        # Zod schemas
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
├── packages/
│   └── shared/                 # Shared TypeScript types
├── docker/                     # docker-compose + Dockerfiles
├── scripts/                    # seed.ts
└── package.json                # npm workspaces root
```

---

## Key Features

### Phase 1 — MVP (COMPLETE)
- [x] npm workspace + TypeScript monorepo setup
- [x] Prisma schema + SQLite dev database
- [x] Seed script with 10,000 realistic fake log entries
- [x] Fastify API: GET /api/logs (paginated, filtered by level/service/date/search)
- [x] Fastify API: GET /api/stats/summary (counts by level)
- [x] React frontend: LogTable with FilterBar
- [x] LogDetailDrawer for stack traces and metadata
- [x] Color-coded LogLevelBadge
- [x] StatsBar showing counts by level
- [x] AppShell layout with Sidebar

### Phase 2 — Charts + Real-time (COMPLETE)
- [x] GET /api/stats/timeline (time-bucket aggregation)
- [x] LogVolumeChart and ErrorRateChart (Recharts)
- [x] DashboardPage with stats + charts
- [x] TanStack Virtual for LogTable (100k+ rows)
- [x] WebSocket live tail (Fastify + @fastify/websocket)
- [x] POST /api/ingest with API key auth
- [x] ServiceFilter (dynamic from DB)
- [x] Full-text search on message column

### Phase 3 — AI Integration
- [ ] ai.service.ts: log sampling + prompt construction + streaming
- [ ] POST /api/ai/summarize (SSE streaming response)
- [ ] POST /api/ai/group-errors (semantic error clustering)
- [ ] AISummaryPanel with streaming UI (token-by-token)
- [ ] Rate limiting on AI routes
- [ ] AISummary history saved to DB

### Phase 4 — Production Hardening
- [ ] Migrate to PostgreSQL + proper compound indexes
- [ ] Docker Compose (postgres + api + web + nginx)
- [ ] Log retention cron job
- [ ] SettingsPage
- [ ] Export to CSV/JSON
- [ ] ServiceErrorHeatmap + LevelDistributionChart

---

## AI Summarization Design

**Flow:**
```
User clicks "Summarize with AI"
  → Backend fetches up to 200 recent ERROR logs for the filter
  → Smart sampling if >200 (most recent + peak-error period + most unique)
  → Constructs prompt with log data + SRE system prompt
  → Streams Claude response via SSE
  → Frontend renders tokens as they arrive
  → Summary saved to AISummary table
```

**System Prompt:**
> "You are a senior SRE analyzing application logs. You receive structured log data and must:
> (1) summarize the errors in plain English,
> (2) identify the most likely root cause,
> (3) group similar errors into named categories,
> (4) suggest concrete next debugging steps.
> Be concise. Use markdown. Only reference what is in the logs."

**Output Format:**
1. **Summary** — 2-3 sentences of what went wrong
2. **Root Cause** — most likely cause
3. **Error Groups** — distinct error patterns with counts
4. **Next Steps** — 3-5 actionable debugging steps

**Rate Limiting:** 10 AI requests/minute per IP, max 3 concurrent Anthropic calls.

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:admin@123@server:5432/logmonitor"
# Dev: DATABASE_URL="file:./dev.db"

# Anthropic
ANTHROPIC_API_KEY="sk-ant-..."
CLAUDE_MODEL="claude-3-5-sonnet-20241022"
AI_MAX_LOGS_PER_SUMMARY=200

# Server
PORT=3001
API_KEY_SECRET="change-me-in-production"

# Log Retention
LOG_RETENTION_DAYS=30

# Frontend (Vite)
VITE_API_URL="http://localhost:3001"
VITE_WS_URL="ws://localhost:3001"
```

---

## Critical Files
- `apps/api/prisma/schema.prisma` — foundation, all types derive from this
- `apps/api/src/services/ai.service.ts` — log sampling, prompt construction, streaming
- `apps/api/src/routes/logs.routes.ts` — core query with cursor pagination + compound indexes
- `apps/web/src/components/logs/LogTable.tsx` — primary UI, TanStack Virtual for performance
- `apps/web/src/components/ai/AISummaryPanel.tsx` — AI feature end-to-end
