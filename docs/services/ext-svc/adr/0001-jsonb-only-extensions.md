# ADR-0001: JSONB-Only Extension Model

- **Status:** Accepted
- **Date:** 2025-10-07
- **Context:** Need safe, backward-compatible way to extend microservices for tenant-specific requirements without schema changes
- **Decision:** Use JSONB-only storage model for all extensions

---

## Context

Multi-tenant SaaS platforms often need tenant-specific customizations:
- Custom fields for business objects (orders, customers, products)
- Tenant-specific validation rules
- Industry-specific data requirements
- Feature flags for gradual rollout

Traditional approaches have significant drawbacks:
1. **Schema changes**: Risky, requires migrations, potential downtime
2. **Separate tables**: Complex joins, performance impact
3. **Key-value stores**: No schema validation, difficult to query
4. **JSON columns without validation**: Data integrity issues

## Decision

### JSONB-Only Extension Model

All extensions stored in `extensions jsonb NOT NULL DEFAULT '{}'` column with:
1. **GIN indexes** for efficient querying
2. **JSON Schema validation** before persistence
3. **Feature flags** for tenant-scoping
4. **Contract guards** for backward compatibility

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Extension Service (ext-svc)                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Contract     │  │ Storage      │  │ Code         │    │
│  │ Guard        │  │ Guard        │  │ Generator    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │ Test         │  │ Extension Draft Model            │  │
│  │ Runner       │  │ (draft → validated → approved)   │  │
│  └──────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Target Service (e.g., order-svc)                            │
├─────────────────────────────────────────────────────────────┤
│  order_header                                               │
│  ├─ order_id (PK)                                           │
│  ├─ customer_id                                             │
│  ├─ total_amount                                            │
│  └─ extensions JSONB ← {priorityHandling: {...}}           │
│                                                             │
│  order_item                                                 │
│  ├─ order_item_id (PK)                                      │
│  ├─ order_id (FK)                                           │
│  ├─ sku                                                     │
│  └─ extensions JSONB ← {customAttributes: {...}}           │
└─────────────────────────────────────────────────────────────┘
```

### Key Constraints

1. **Backward Compatibility**: Extensions must not break existing contracts
2. **Optional Fields Only**: All extension fields must be optional
3. **Tenant-Scoped**: Extensions controlled by feature flags per tenant
4. **JSONB-Only**: No schema modifications to existing tables
5. **Validated**: All extensions validated against JSON Schema

### Validation Flow

```
1. Draft Created
   ↓
2. Contract Guard: Validate against OpenAPI/AsyncAPI
   ↓
3. Storage Guard: Check extensions column exists
   ↓
4. Generate Migration: If needed, create SQL to add column
   ↓
5. Generate Artifacts: AJV/Zod validators, UI, tests, docs
   ↓
6. Test Runner: Execute tagged tests
   ↓
7. Approval: Human review and approval
   ↓
8. Deployment: Apply migration, enable feature flag
```

## Consequences

### Pros

1. **No Schema Changes**: Extensions don't require ALTER TABLE on production tables
2. **Backward Compatible**: Existing code unaffected by new extensions
3. **Tenant-Scoped**: Feature flags enable gradual rollout
4. **Fast Deployment**: No database schema migrations (after initial extensions column)
5. **Flexible**: JSONB supports arbitrary structure
6. **Queryable**: GIN indexes enable efficient JSON queries
7. **Validated**: JSON Schema ensures data integrity
8. **Safe**: Contract guard prevents breaking changes

### Cons

1. **Query Performance**: JSONB queries slower than native columns for high-volume
2. **Type Safety**: Less type safety than native columns (mitigated by validators)
3. **Tooling**: Some DB tools don't visualize JSONB well
4. **Learning Curve**: Developers need to understand JSONB operations
5. **Size Limits**: JSONB has size limits (~255MB per value)

### Mitigations

1. **Performance**: GIN indexes, query optimization, caching
2. **Type Safety**: Runtime validation with AJV/Zod
3. **Tooling**: Custom visualization in UI, documentation
4. **Training**: Extension guide, playbook, examples
5. **Size**: Validation rules limit extension data size

## Alternatives Considered

### 1. Schema Migrations for Each Extension
**Rejected**: High risk, slow, potential downtime, requires DBA approval

### 2. Separate Extension Tables
**Rejected**: Complex joins, performance impact, schema proliferation

### 3. Key-Value Store
**Rejected**: No validation, difficult to query, eventual consistency issues

### 4. Unvalidated JSON Columns
**Rejected**: Data integrity concerns, no contract enforcement

## Implementation Notes

### Initial Setup (Per Service)

```sql
-- Add extensions column to each business table
ALTER TABLE order_header
  ADD COLUMN extensions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX idx_order_header_extensions
  ON order_header USING GIN (extensions);
```

### Extension Usage (Application Code)

```javascript
// Write extension data
await pool.query(`
  INSERT INTO order_header (order_id, customer_id, extensions)
  VALUES ($1, $2, $3)
`, [orderId, customerId, {
  priorityHandling: {
    priorityLevel: 'critical',
    estimatedDelivery: '2025-10-08T10:00:00Z'
  }
}]);

// Query extension data
await pool.query(`
  SELECT order_id, extensions->'priorityHandling' as priority
  FROM order_header
  WHERE extensions->>'priorityHandling' IS NOT NULL
    AND extensions->'priorityHandling'->>'priorityLevel' = 'critical'
`);
```

### Feature Flag Check

```javascript
// Check if extension enabled for tenant
const extensionEnabled = await featureFlags.isEnabled(
  'ext_order_svc_priority_handling',
  tenantId
);

if (extensionEnabled && payload.extensions?.priorityHandling) {
  // Process extension data
}
```

## Success Metrics

1. **Extension Velocity**: Time from draft to deployment < 1 day
2. **Safety**: Zero production incidents from extensions
3. **Adoption**: > 80% of tenant-specific requirements via extensions
4. **Performance**: p95 query latency < 100ms for JSONB queries
5. **Coverage**: All major services support extensions

## References

- PostgreSQL JSONB Documentation: https://www.postgresql.org/docs/current/datatype-json.html
- JSON Schema Specification: https://json-schema.org/
- Extension Guide: `docs/services/order-svc/extension-guide.yaml`
- Codex Playbook: `docs/codex-playbook.md` (Extension Service Playbook section)
