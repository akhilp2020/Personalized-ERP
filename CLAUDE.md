- # 🧠 PROJECT_CONTEXT.md  
**Purpose:**  
This file gives any LLM (ChatGPT, Codex CLI, or other AI assistants) the full context needed to understand, extend, or debug the project efficiently without consuming excessive tokens.  
Paste this file into a new chat before starting work or link to it in your prompt.

---

## 1. Overview

**Project Name:** Personalized ERP Demo  
**Type:** Multi-service demo platform showing order creation, streaming, and persistence with AI-friendly architecture.

**Primary Goals:**
- Demonstrate an **end-to-end order flow** (Order UI → Order Service → Kafka → Postgres → Apicurio → OTel).
- Enable rapid modification or extension of services using **LLM-guided automation** (Codex / ChatGPT).
- Maintain explainability and traceability via **per-service knowledge packs** and a **centralized documentation graph**.

---

## 2. Current Architecture

| Component | Description | Tech Stack |
|------------|--------------|-------------|
| **Order UI** | Simple HTML/JS frontend for creating and viewing orders | Python HTTP server (`python3 -m http.server`) |
| **Order Service (`order-svc`)** | Node.js Express app handling `/orders` (POST) and `/orders/recent` (GET) | Node.js + KafkaJS + PostgreSQL |
| **Database** | Persists order headers and items | PostgreSQL (`pg` driver) |
| **Kafka** | Publishes `sales.order.created.v1` messages | KafkaJS |
| **Apicurio Registry** | Stores OpenAPI/AsyncAPI contracts | Quarkus (HTTP:8080) |
| **OpenTelemetry Collector** | Collects and exports tracing and metrics | OTel Collector Deployment |
| **Kubernetes Environment** | Local k3d cluster (`dev` namespace) orchestrating all components | k3d + kubectl |
| **Codex CLI / ChatGPT** | Used to plan, implement, and update code changes | OpenAI Codex CLI or ChatGPT |

---

## 3. Functional Flow

1. **Order Creation (UI → API)**  
   - User submits order form on `/index.html`.  
   - `order-svc` receives POST `/orders`, validates JSON body, persists to Postgres table `orders`, and publishes `sales.order.created.v1` to Kafka.  
   - Returns a generated `orderId` in response.

2. **Order Retrieval**  
   - UI calls `/orders/recent` to show last 20 orders.  
   - Data fetched directly from Postgres.

3. **Monitoring**  
   - Logs streamed via `otel-collector` → Jaeger UI.  
   - API contracts visible in **Apicurio Registry** (`localhost:8080`).

---

## 4. Deployment Summary

| Service | Command | Notes |
|----------|----------|-------|
| **Order Service** | `kubectl -n dev get pods -l app=order-svc` | REST API |
| **Postgres** | `kubectl -n dev exec deploy/pg -- psql -U postgres -d postgres` | `orders` table auto-created |
| **Kafka** | Use service DNS (not localhost) | Prevent ECONNREFUSED |
| **Apicurio** | `kubectl -n dev port-forward svc/apicurio 8080:8080` | http://localhost:8080 |
| **UI** | `python3 -m http.server 8000` from `apps/demos/order-ui` | http://localhost:8000 |

---

## 5. AI Workflow Rules

**Two-Phase Process**

**Phase 1 — DISCOVER + PLAN**
- Read only:
  - `docs/services/<svc>/kg.yaml`
  - `docs/services/<svc>/change-map.yaml`
- Use ripgrep to find ≤3 snippets (≤30 lines each).
- Print a short plan (files, anchors, diffs).

**Phase 2 — APPLY + VERIFY**
- Emit *unified diffs only*.
- Build → import image → rollout → smoke test.
- Tail last 30 logs and summarize.

Example:
```bash
docker build -t order-svc:dev apps/services/order-svc
k3d image import order-svc:dev -c dev
kubectl -n dev rollout restart deploy/order-svc
kubectl -n dev rollout status deploy/order-svc --timeout=180s
curl -s http://localhost:8088/orders/recent | jq '.[0]'
```

---

## 6. Demo Flow

1. Open http://localhost:8000 → Create order  
2. Verify via:  
   - **Logs**: `kubectl -n dev logs deploy/order-svc --tail=10`  
   - **DB**: `kubectl -n dev exec deploy/pg -- psql -U postgres -d postgres -c "select * from orders;"`  
   - **Apicurio UI**: show contract  
   - **Jaeger UI**: trace order flow  
   - **Kafka UI**: show published message

---

## 7. Adding New Services

```bash
make svc-docs-new SVC=inventory-svc
# Edit docs/services/inventory-svc/kg.yaml + change-map.yaml
make docs-validate
```

---

✅ **Use this file as the single context file for new LLM sessions.**