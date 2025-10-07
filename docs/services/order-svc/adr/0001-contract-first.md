# ADR-0001: Contract-First for Order API

- **Status:** Accepted
- **Context:** We need safe, multi-tenant evolution and agent-compatible automation.
- **Decision:** Treat OpenAPI/AsyncAPI as the source of truth; validate requests against OpenAPI; publish events defined in AsyncAPI; register artifacts in Apicurio.
- **Consequences:**
  - Changes begin with contract updates and compatibility checks.
  - Code scaffolding, validators, and tests derive from contracts.
  - Agents consult KG and change-map before edits.

---

## Change Plan: Split Order Table (2025-10-06)

### Context
Legacy schema used a single `orders` table with embedded JSONB for line items. This created challenges:
- Difficult to query individual line items
- No referential integrity for order-item relationships
- Complex aggregations across line items
- Poor indexing for SKU/product searches

### Decision
Normalize into two tables:
1. **order_header**: order-level fields (order_id PK, customer_id, status, currency, total_amount, dates)
2. **order_item**: line-level fields (order_item_id PK, order_id FK, line_no, sku, product_id, qty, unit_price, line_amount)

### Implementation
- **Migration**: `apps/services/order-svc/migrations/001_split_order_tables.sql`
  - Creates new tables with proper constraints (FK, CHECK, indexes)
  - Backfills from legacy `orders`/`order_items` if they exist
  - Creates compatibility views for gradual migration
- **Code**: `apps/services/order-svc/src/index.js`
  - POST /orders → inserts into order_header + order_item
  - GET /orders/:orderId → joins header + items
  - GET /orders/recent → queries order_header
- **Tests**: `apps/services/order-svc/src/index.test.js`

### Consequences
**Pros:**
- Proper normalization enables efficient querying
- FK constraints ensure data integrity
- Computed column (line_amount) eliminates calculation errors
- Better indexing for analytics and reports

**Cons:**
- Requires migration coordination
- Two-table writes (mitigated by transactions)
- Slightly more complex queries for joined data

### Migration/Rollout
1. Run migration: `psql $PG_URL -f apps/services/order-svc/migrations/001_split_order_tables.sql`
2. Compatibility views allow gradual transition
3. Update code to use new table names
4. Deploy with rolling restart
5. Monitor logs for errors
6. After stabilization, drop compatibility views

### Rollback
```sql
DROP VIEW IF EXISTS order_items;
DROP VIEW IF EXISTS orders;
DROP TABLE IF EXISTS order_item CASCADE;
DROP TABLE IF EXISTS order_header CASCADE;
-- Restore from backup or re-enable legacy tables
```

### Trade-offs
- **Chose normalization over denormalization** for data integrity and query flexibility
- **Chose computed columns** for line_amount to guarantee consistency
- **Chose compatibility views** for zero-downtime migration
