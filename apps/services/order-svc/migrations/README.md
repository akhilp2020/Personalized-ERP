# Order Service Database Migrations

## Overview
This directory contains SQL migrations for the order-svc database schema.

## Migrations

### 001_split_order_tables.sql
**Purpose**: Normalize order schema into `order_header` and `order_item` tables

**What it does:**
- Creates `order_header` table (order-level data)
- Creates `order_item` table (line-level data) with FK to order_header
- Adds proper indexes (tenant_id, customer_id, created_at, sku)
- Adds constraints (FK, CHECK for qty > 0, unit_price >= 0)
- Adds computed column `line_amount = qty * unit_price`
- Backfills data from legacy `orders`/`order_items` tables (if they exist)
- Creates compatibility views for gradual migration

**How to apply:**
```bash
# Port-forward to postgres
kubectl port-forward -n dev svc/pg 5432:5432 &

# Set connection string
export PG_URL="postgres://postgres:postgres@localhost:5432/postgres"

# Apply migration
psql $PG_URL -f apps/services/order-svc/migrations/001_split_order_tables.sql

# Verify
psql $PG_URL -c "\d order_header"
psql $PG_URL -c "\d order_item"
```

**Rollback:**
```sql
BEGIN;
DROP VIEW IF EXISTS order_items;
DROP VIEW IF EXISTS orders;
DROP TABLE IF EXISTS order_item CASCADE;
DROP TABLE IF EXISTS order_header CASCADE;
COMMIT;
```

## Best Practices
1. Always run migrations in a transaction (they use BEGIN/COMMIT)
2. Test on dev environment first
3. Back up production data before applying
4. Monitor application logs after deployment
5. Keep rollback scripts ready
