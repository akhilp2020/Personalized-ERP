-- Migration 002: Add extensions JSONB column to order-svc tables
-- Purpose: Enable safe, tenant-scoped extensions via JSONB storage
-- Safe to run idempotently (uses IF NOT EXISTS checks)

BEGIN;

-- Add extensions column to order_header
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_header'
      AND column_name = 'extensions'
  ) THEN
    ALTER TABLE order_header
      ADD COLUMN extensions JSONB NOT NULL DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added extensions column to order_header';
  END IF;
END $$;

-- Create GIN index for extensions column on order_header
CREATE INDEX IF NOT EXISTS idx_order_header_extensions
  ON order_header USING GIN (extensions);

-- Add extensions column to order_item
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_item'
      AND column_name = 'extensions'
  ) THEN
    ALTER TABLE order_item
      ADD COLUMN extensions JSONB NOT NULL DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added extensions column to order_item';
  END IF;
END $$;

-- Create GIN index for extensions column on order_item
CREATE INDEX IF NOT EXISTS idx_order_item_extensions
  ON order_item USING GIN (extensions);

COMMIT;

-- Rollback script (run separately if needed):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_order_header_extensions;
-- DROP INDEX IF EXISTS idx_order_item_extensions;
-- ALTER TABLE order_header DROP COLUMN IF EXISTS extensions;
-- ALTER TABLE order_item DROP COLUMN IF EXISTS extensions;
-- COMMIT;
