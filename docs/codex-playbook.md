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

---

## Extension Service Playbook

The Extension Service (`ext-svc`) enables safe, backward-compatible extensions to existing microservices via JSONB storage.

### Prerequisites
1. Target service has `extensions jsonb` column in business tables
2. Extension Service running on port 8090
3. Contracts (OpenAPI/AsyncAPI) available in `contracts/` directory

### Extension Workflow: Q&A → Validate → Propose → Test → Approve

#### Step 1: Create Extension Draft (Q&A)
```bash
# Start interactive Q&A
curl http://localhost:8090/extensions/qa/draft-id

# Create draft with schema
curl -X POST http://localhost:8090/extensions/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant1",
    "targetService": "order-svc",
    "extensionName": "priority-handling",
    "description": "Add priority levels for premium customers",
    "schema": {
      "type": "object",
      "properties": {
        "priorityLevel": {
          "type": "string",
          "enum": ["standard", "high", "critical"],
          "description": "Order priority for fulfillment"
        },
        "estimatedDelivery": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "createdBy": "admin@tenant1.com"
  }'
```

#### Step 2: Validate Extension
```bash
# Validate contract compatibility + generate migrations
DRAFT_ID="ext-123456789"
curl -X POST http://localhost:8090/extensions/drafts/$DRAFT_ID/validate

# Response includes:
# - validationResults: { contract: {...}, storage: {...} }
# - impactReport: human-readable impact summary
# - migrations: SQL files if tables need extensions column
```

**What Validation Checks:**
- ✅ Backward compatibility (no breaking changes)
- ✅ Only optional fields (required=false)
- ✅ No conflicts with existing schema
- ✅ Storage readiness (extensions column exists)
- ✅ Contract guard (OpenAPI/AsyncAPI rules)

**If Validation Fails:**
- Review `violations` in response
- Fix schema (remove required fields, avoid conflicts)
- Re-validate

#### Step 3: Generate Artifacts (Propose)
```bash
# Generate code artifacts
curl -X POST http://localhost:8090/extensions/drafts/$DRAFT_ID/generate

# Generated artifacts:
# - ajvValidator: AJV validation schema (Node.js)
# - zodValidator: Zod TypeScript schema
# - uiFragment: React Hook Form component
# - test: Tagged test suite (@extension:priority-handling)
# - kgUpdate: Updated knowledge graph
# - changeMapUpdate: Updated change map
```

#### Step 4: Run Tests
```bash
# Run extension-specific tests
curl -X POST http://localhost:8090/extensions/drafts/$DRAFT_ID/test

# Tests validate:
# - Extension data accepted by service
# - Validation rules enforced
# - Storage in extensions JSONB column
# - Feature flag behavior
# - No regressions in existing functionality
```

**If Tests Fail:**
- Review test logs in response
- Fix validation rules or test data
- Re-test

#### Step 5: Approve Extension
```bash
# Approve for deployment (requires passing tests)
curl -X POST http://localhost:8090/extensions/drafts/$DRAFT_ID/approve \
  -H "Content-Type: application/json" \
  -d '{"approvedBy": "manager@tenant1.com"}'
```

#### Step 6: Deploy Extension
```bash
# 1. Apply migration (if generated)
psql $PG_URL -f apps/services/order-svc/migrations/002_add_extensions_column.sql

# 2. Mark as deployed
curl -X POST http://localhost:8090/extensions/drafts/$DRAFT_ID/deploy

# 3. Enable feature flag for tenant
# TODO: Set feature flag ext_order_svc_priority_handling=true for tenant1

# 4. Test with real request
curl -X POST http://localhost:8088/orders \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant1" \
  -d '{
    "customerId": "premium-customer",
    "currency": "USD",
    "lines": [{"sku": "WIDGET-A", "qty": 1, "unitPrice": 50}],
    "extensions": {
      "priorityHandling": {
        "priorityLevel": "critical",
        "estimatedDelivery": "2025-10-08T10:00:00Z"
      }
    }
  }'
```

#### Step 7: Rollback (if needed)
```bash
# Rollback extension
curl -X POST http://localhost:8090/extensions/drafts/$DRAFT_ID/rollback

# Manual steps:
# 1. Disable feature flag for tenant
# 2. Remove extension data (optional):
#    UPDATE order_header SET extensions = extensions - 'priorityHandling';
# 3. Revert code changes if any
```

### Extension Best Practices

**Schema Design:**
- Use optional fields only (no `required` array)
- Provide clear descriptions and examples
- Use enums for constrained values
- Keep schemas flat (avoid deep nesting)
- Use semantic field names (camelCase)

**Testing:**
- Tag tests with `@extension:{name}`
- Test valid and invalid data
- Verify JSONB storage
- Test feature flag behavior
- Ensure no regressions

**Deployment:**
- Apply migrations in off-peak hours
- Enable feature flags gradually (per tenant)
- Monitor logs for validation errors
- Keep rollback plan ready

### Troubleshooting

**Extension rejected during validation:**
- Check `violations` in validation response
- Ensure all fields are optional
- Remove conflicts with existing schema
- Re-validate after fixes

**Tests failing:**
- Review test logs in response
- Verify test data matches schema
- Check feature flag configuration
- Ensure extensions column exists

**Data not persisting:**
- Verify extensions column exists (run migration)
- Check JSONB format is valid
- Verify feature flag enabled for tenant

**Contract break detected:**
- Review impact report
- Remove breaking changes
- Ensure backward compatibility

### Extension Service Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/extensions/drafts` | POST | Create extension draft |
| `/extensions/drafts` | GET | List all drafts |
| `/extensions/drafts/:id` | GET | Get specific draft |
| `/extensions/drafts/:id/validate` | POST | Validate contract & storage |
| `/extensions/drafts/:id/generate` | POST | Generate code artifacts |
| `/extensions/drafts/:id/test` | POST | Run tagged tests |
| `/extensions/drafts/:id/approve` | POST | Approve for deployment |
| `/extensions/drafts/:id/deploy` | POST | Mark as deployed |
| `/extensions/drafts/:id/rollback` | POST | Rollback extension |
| `/extensions/qa/:draftId` | GET | Interactive Q&A |

For detailed examples, see `docs/services/order-svc/extension-guide.yaml`
