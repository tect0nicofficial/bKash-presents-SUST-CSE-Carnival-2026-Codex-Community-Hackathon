# QueueStorm Investigator

An AI / API SupportOps Service for Digital Financial Services, built for the **bKash presents SUST CSE Carnival 2026 — Codex Community Hackathon**.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm run build && pnpm start
```

API runs on `http://localhost:8000`. Swagger UI at `http://localhost:8000/api`.

---

## Live Endpoint (Submission Path A)

The service is deployed in Singapore (ap-southeast-1) and reachable at:

> **http://54.169.214.226/**

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/analyze-ticket` | POST | Analyze a customer complaint (main endpoint) |
| `/health` | GET | Health check — returns `{"status":"ok"}` |
| `/metrics` | GET | Prometheus metrics (http_requests_total, latency) |
| `/api` | GET | Swagger/OpenAPI UI — interactive API docs |

### Monitoring Dashboards

| Service | URL | Credentials |
|---|---|---|
| **Grafana Dashboard** | http://54.169.214.226:3000/d/efqbk31b6s64ga/new-dashboard | `admin` / `admin` |
| **Prometheus** | http://54.169.214.226:9090 | Public (no auth) |
| **Alertmanager** | http://54.169.214.226:9093 | Public (no auth) |

### Deployment Architecture
- **8x API replicas** behind Nginx load balancer (round-robin, keep-alive)
- **Docker Swarm** single-node cluster on AWS EC2 t3.medium
- **Docker image** hosted on AWS ECR (private registry)
- **Prometheus + Grafana + Alertmanager** for observability

No auth, no API key, no login required on API endpoints. Call directly.

---

## Tech Stack

- **Framework**: NestJS (TypeScript) with Express
- **Validation**: class-validator + class-transformer
- **Package Manager**: pnpm
- **Dependency file**: `package.json`
- **Deployment**: Docker, Docker Swarm, AWS ECR
- **Infrastructure**: AWS EC2 (t3.medium, Singapore ap-southeast-1), Nginx reverse proxy
- **Monitoring**: Prometheus + Grafana + Alertmanager
- **API Docs**: Swagger/OpenAPI (via @nestjs/swagger)

## Setup Instructions

### Prerequisites
- Node.js >= 20
- pnpm
- Docker (optional — for container deployment)

### Installation
```bash
git clone <repo-url>
cd <repo>
pnpm install
cp .env.example .env
```

### Running Locally (Path C — Code)
```bash
pnpm run build   # Compile TypeScript → dist/
pnpm start       # Start on http://localhost:8000
```
Or in one step: `pnpm run build && pnpm start`

### Running with Docker (Path B — Container)
```bash
docker build -t queuestorm-investigator .
docker run -p 8000:8000 --env-file .env queuestorm-investigator
```

### Running with Docker Compose (multi-replica + nginx)
```bash
docker compose up --build
```
This starts 5 API replicas behind an Nginx load balancer on port 8000.

### Production Deployment (Docker Swarm)
The live deployment uses Docker Swarm with 8 API replicas, Nginx, Prometheus, Grafana, and Alertmanager. See `docker-stack.yml` (deployed on EC2) or the Swarm section in `resources/` for the stack definition.

---

## Testing Instructions

Run all 38 tests (27 unit + 11 e2e):
```bash
pnpm test          # 27 unit tests
pnpm test:e2e      # 11 e2e tests (10 sample cases + health check)
```

Manually test against the live endpoint:
```bash
curl http://54.169.214.226/health
```

Or run all sample cases:
```bash
bash scripts/test-sample-cases.sh
```

---

## API Documentation

### `POST /analyze-ticket`

**Sample Request:**
```json
{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to a wrong number",
  "language": "en",
  "transaction_history": [
    {
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T10:30:00Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801712345678",
      "status": "completed"
    }
  ]
}
```

**Sample Response:**
```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending 5000 BDT via TXN-9101 to +8801712345678, which they believe was the wrong recipient. Transaction status: completed.",
  "recommended_next_action": "Verify TXN-9101 details with the customer and initiate the wrong-transfer dispute workflow per policy.",
  "customer_reply": "We have noted your concern about transaction TXN-9101. Our dispute team will review the case and contact you through official support channels. Please do not share your PIN or OTP with anyone.",
  "human_review_required": true,
  "confidence": 0.9,
  "reason_codes": ["wrong_transfer", "transaction_match", "review_flagged"]
}
```

See `sample-output.json` for a full sample output from SAMPLE-01.

### `GET /health`
Returns `{"status":"ok"}` with HTTP 200. Used for readiness probes.

### `GET /metrics`
Prometheus-format metrics: `http_requests_total` (counter) and `http_request_duration_seconds` (average latency gauge).

---

## Architecture

```
[ Client ] → POST /analyze-ticket
                ↓
         TicketController (validates DTO)
                ↓
         ReasoningService (orchestrator)
                ↓
         ├─ TransactionMatcher — fuzzy-match complaint to transactions
         ├─ EvidenceAnalyzer — consistency checks, duplicate detection
         ├─ Classifier — keyword-based case_type, severity, department
         ├─ LlmService — template-based text generation (en/bn)
         └─ SafetyGuardrail — credential/refund/injection checks + PII redaction
                ↓
         JSON response
```

---

## Pipeline Design

### 1. Transaction Matching
Score-based fuzzy matching (0–1) checking amount proximity, counterparty similarity, transaction type, and time window (within 7 days). Supports Bengali digits (e.g., ৫০০০ → 5000). Detects duplicate transactions.

### 2. Evidence Analysis
Rule-based consistency: checks if a "claims_failed" complaint matches a failed transaction, detects prior transfers to the same recipient, identifies duplicate/similar complaint patterns from the transaction history.

### 3. Classification
Keyword-based detection with 7 case types (wrong_transfer, failed_transaction, unauthorized_access, refund_request, account_issue, fraud, unknown). Each maps to a severity level and department. Bangla keywords supported.

### 4. Text Generation (LlmService)
Template-based, not LLM-based. Generates agent_summary, recommended_next_action, and customer_reply in English or Bengali depending on the `language` field. No external API calls, no latency, no cost.

### 5. Safety Guardrails
- **No Credentials**: Two-step scan — flags credential words (PIN, OTP, password) but allows negated warnings ("do not share your PIN" is safe)
- **No Unauthorized Actions**: Detects unauthorized refund promises in en/bn, rewrites to policy-compliant text
- **No Third-Party Contact**: Redacts unauthorized phone numbers from responses
- **Prompt Injection Detection**: Pattern-based detection of manipulative instructions ("ignore previous instructions")
- **PII Redaction**: Phone numbers → `+8801XXXXXXX`, amounts → `XXXX taka` in all log output

### Language Support
Handles English (`en`) and Bengali (`bn`). All templates, keywords, and safety rules are bilingual.

---

## Models Used

| Model | Where it runs | Why chosen |
|---|---|---|
| None (pure rule-based) | In-process, no external calls | Zero cost, zero latency, zero hallucination risk. All reasoning, classification, and text generation uses deterministic templates and keyword matching. |

### Cost Reasoning
No LLM API was integrated. The original plan used an OpenCode Zen API endpoint, but it returned "Not Found" and required a non-functional API key. A fully rule-based approach:
- Costs **$0 per request** (no API calls, no token billing)
- Is **10–100x faster** than LLM-based alternatives (sub-100ms response time)
- Guarantees **deterministic output** (same input → same output every time)
- Eliminates **hallucination risk** (no made-up transaction IDs or policy violations)
- Has **no quota limits** (can handle unlimited concurrent requests)

---

## Load Test Results

### Test 1: 100K requests @ 5,000 concurrent (analyze-ticket pipeline)
| Metric | Value |
|---|---|
| Total requests | 100,000 |
| Concurrent connections | 5,000 |
| Duration | 57.9 seconds |
| Throughput | 1,728 req/s |
| Success rate | 99.3% |
| P50 latency | 258 ms |
| P90 latency | 469 ms |
| P99 latency | 873 ms |

### Test 2: 4M requests @ 10,000 concurrent (health endpoint) — Pending
Larger test requires ~2–3 minutes on autocannon with kept-alive connections.

Both tests run on AWS EC2 t3.medium (2 vCPU, 4GB RAM), Docker Swarm (8 API replicas + Nginx).

---

## Assumptions

1. **No real bKash API integration** — transaction history is provided by the caller in the request body, not fetched from an external system.
2. **All amounts in BDT** — matching assumes the same currency throughout.
3. **Complaint timestamps not required** — matching uses the transaction timestamps only; complaint recency is not analyzed.
4. **No customer authentication** — the API is fully open (no auth, no API keys) as required by the problem statement.
5. **Rule-based is sufficient** — the 10 sample cases cover the expected patterns; novel patterns may not be classified correctly.

## Known Limitations

- Keyword-based classification may miss novel complaint patterns not covered by current keyword lists
- Template-based replies are less natural-sounding than LLM-generated text
- Does not handle languages other than English and Bengali
- Prompt injection protection is pattern-based (not semantic) — sophisticated injections may bypass it
- No persistent storage — all processing is stateless per request
- Bengali number matching only covers common numerals (০-৯), not variant scripts

---

## Deliverables Checklist

| Item | Status |
|---|---|
| Live endpoint URL (Path A) | ✅ `http://54.169.214.226/` |
| Docker image (Path B) | ✅ `docker pull 611913894684.dkr.ecr.ap-southeast-1.amazonaws.com/queuestorm-investigator:latest` |
| Code runbook (Path C) | ✅ See Setup Instructions above |
| `package.json` (dependencies) | ✅ Included |
| `sample-output.json` | ✅ Generated from SAMPLE-01 |
| `MODELS` section | ✅ Above |
| `.env.example` | ✅ Included (only `PORT=8000`) |
| Team name and ID | See submission form |
| Architecture walkthrough video | See submission form |
| No real customer data | ✅ No customer data in repo |
| No secrets committed | ✅ `.env` in `.gitignore` |
