# Codex Playbook (Two-Phase, Token-Thrifty)

**Always do:**
1) Read small docs first:
   - `docs/services/<svc>/kg.yaml`
   - `docs/services/<svc>/change-map.yaml`
2) Phase 1 — DISCOVER+PLAN
   - Use `rg` to find targets only in paths listed in `likely_files`
   - Show ≤3 short snippets (≤30 lines each) around hits with `sed -n 'A,Bp'`
   - Output a 6–10 line PLAN (files, anchors, minimal diffs)
3) Phase 2 — APPLY+VERIFY
   - Emit *unified diffs* only (no full files)
   - Build/import/rollout with the standard 4 commands
   - Tail last 30 logs; print one-line smoke result. STOP.

**Never** open or print large files, node_modules, dist, or unchanged code.

---

## Order Split Playbook

### Running Migrations
```bash
# 1. Connect to postgres
kubectl port-forward -n dev svc/pg 5432:5432 &
export PG_URL="postgres://postgres:postgres@localhost:5432/postgres"

# 2. Apply migration
psql $PG_URL -f apps/services/order-svc/migrations/001_split_order_tables.sql

# 3. Verify tables
psql $PG_URL -c "\d order_header"
psql $PG_URL -c "\d order_item"
psql $PG_URL -c "SELECT COUNT(*) FROM order_header;"
psql $PG_URL -c "SELECT COUNT(*) FROM order_item;"
```

### Running Tests
```bash
# Unit tests (requires Node 20+)
cd apps/services/order-svc
node --test src/index.test.js

# Integration test via API
curl -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant1" \
  -d '{
    "customerId": "cust-123",
    "currency": "USD",
    "lines": [
      {"sku": "WIDGET-A", "qty": 2, "unitPrice": 25.00},
      {"sku": "WIDGET-B", "qty": 1, "unitPrice": 50.00}
    ]
  }'

# Verify response includes orderId
# Then fetch with items:
curl http://localhost:8080/orders/{orderId}
```

### Deployment Steps
```bash
# 1. Build
make build

# 2. Deploy
make deploy

# 3. Check health
kubectl -n dev get pods -l app=order-svc
kubectl -n dev logs -l app=order-svc --tail=30

# 4. Smoke test
make smoke
```

### Rollback
If migration fails or causes issues:
```sql
BEGIN;
DROP VIEW IF EXISTS order_items;
DROP VIEW IF EXISTS orders;
DROP TABLE IF EXISTS order_item CASCADE;
DROP TABLE IF EXISTS order_header CASCADE;
-- Then restore from backup or re-enable legacy tables
COMMIT;
```
