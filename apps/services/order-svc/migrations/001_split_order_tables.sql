-- Migration 001: Split order table into order_header and order_item
-- Purpose: Normalize order schema with proper header/items separation
-- Safe to run idempotently (uses IF NOT EXISTS)

BEGIN;

-- 1) Create order_header table (renamed from orders, enhanced structure)
CREATE TABLE IF NOT EXISTS order_header (
    order_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NEW',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_header_tenant_id ON order_header(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_header_customer_id ON order_header(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_header_created_at ON order_header(created_at DESC);

-- 2) Create order_item table (enhanced with proper constraints)
CREATE TABLE IF NOT EXISTS order_item (
    order_item_id SERIAL PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    line_no INTEGER NOT NULL,
    sku TEXT NOT NULL,
    product_id VARCHAR(64),
    qty NUMERIC(15,4) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    line_amount NUMERIC(15,2) GENERATED ALWAYS AS (qty * unit_price) STORED,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_order_item_header FOREIGN KEY (order_id) REFERENCES order_header(order_id) ON DELETE CASCADE,
    CONSTRAINT chk_qty_positive CHECK (qty > 0),
    CONSTRAINT chk_unit_price_nonneg CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_item_order_id ON order_item(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_tenant_id ON order_item(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_item_sku ON order_item(sku);

-- 3) Backfill: Migrate existing "orders" table data to order_header (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        -- Copy order headers
        INSERT INTO order_header (order_id, tenant_id, customer_id, status, currency, total_amount, payload, created_at)
        SELECT
            order_id,
            tenant_id,
            customer_id,
            status,
            currency,
            total_amount,
            payload,
            COALESCE(created_at, NOW())
        FROM orders
        ON CONFLICT (order_id) DO NOTHING;

        RAISE NOTICE 'Backfilled % rows into order_header', (SELECT COUNT(*) FROM order_header);
    END IF;
END $$;

-- 4) Backfill: Migrate existing "order_items" table data to order_item (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items') THEN
        INSERT INTO order_item (order_id, tenant_id, line_no, sku, product_id, qty, unit_price, payload)
        SELECT
            order_id,
            tenant_id,
            line_no,
            sku,
            NULL as product_id,  -- legacy had no product_id
            qty,
            unit_price,
            payload
        FROM order_items
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Backfilled % rows into order_item', (SELECT COUNT(*) FROM order_item);
    END IF;
END $$;

-- 5) Rename legacy tables if they exist (for backward compatibility)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE orders RENAME TO orders_legacy;
        RAISE NOTICE 'Renamed orders to orders_legacy';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE order_items RENAME TO order_items_legacy;
        RAISE NOTICE 'Renamed order_items to order_items_legacy';
    END IF;
END $$;

-- 6) Create views for backward compatibility (optional - can be dropped later)
CREATE OR REPLACE VIEW orders AS
SELECT
    order_id,
    tenant_id,
    customer_id,
    status,
    currency,
    total_amount,
    payload,
    created_at
FROM order_header;

CREATE OR REPLACE VIEW order_items AS
SELECT
    order_id,
    tenant_id,
    line_no,
    sku,
    qty,
    unit_price,
    payload
FROM order_item;

COMMIT;

-- Rollback script (run separately if needed):
-- BEGIN;
-- DROP VIEW IF EXISTS order_items;
-- DROP VIEW IF EXISTS orders;
-- DROP TABLE IF EXISTS order_item CASCADE;
-- DROP TABLE IF EXISTS order_header CASCADE;
-- COMMIT;
