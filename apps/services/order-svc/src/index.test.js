// Basic integration tests for order service
// Run with: node --test src/index.test.js (requires Node 20+)

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Pool } = require('pg');

const PG_URL = process.env.PG_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const pool = new Pool({ connectionString: PG_URL });

describe('Order Service Schema Tests', () => {
  before(async () => {
    // Apply migration
    const fs = require('fs');
    const path = require('path');
    const migration = fs.readFileSync(
      path.join(__dirname, '../migrations/001_split_order_tables.sql'),
      'utf8'
    );
    await pool.query(migration);
  });

  after(async () => {
    await pool.end();
  });

  test('should create order_header and order_item tables', async () => {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('order_header', 'order_item')
    `);
    assert.strictEqual(result.rows.length, 2, 'Both tables should exist');
  });

  test('should insert order with multiple items', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderId = 'test-order-' + Date.now();
      await client.query(
        `INSERT INTO order_header(tenant_id, order_id, customer_id, status, currency, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['tenant1', orderId, 'cust-001', 'NEW', 'USD', 150.00]
      );

      await client.query(
        `INSERT INTO order_item(tenant_id, order_id, line_no, sku, qty, unit_price)
         VALUES
         ($1, $2, 1, 'SKU-A', 2, 50.00),
         ($1, $2, 2, 'SKU-B', 1, 50.00)`,
        ['tenant1', orderId]
      );

      await client.query('COMMIT');

      const itemsResult = await pool.query(
        'SELECT COUNT(*) as count FROM order_item WHERE order_id = $1',
        [orderId]
      );
      assert.strictEqual(Number(itemsResult.rows[0].count), 2, 'Should have 2 items');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  test('should enforce FK constraint (cascade delete)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderId = 'test-fk-' + Date.now();
      await client.query(
        `INSERT INTO order_header(tenant_id, order_id, customer_id, status, currency, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['tenant1', orderId, 'cust-002', 'NEW', 'USD', 100.00]
      );

      await client.query(
        `INSERT INTO order_item(tenant_id, order_id, line_no, sku, qty, unit_price)
         VALUES ($1, $2, 1, 'SKU-C', 1, 100.00)`,
        ['tenant1', orderId]
      );

      await client.query('DELETE FROM order_header WHERE order_id = $1', [orderId]);

      const itemsResult = await pool.query(
        'SELECT COUNT(*) as count FROM order_item WHERE order_id = $1',
        [orderId]
      );
      assert.strictEqual(Number(itemsResult.rows[0].count), 0, 'Items should cascade delete');

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  test('should calculate line_amount correctly', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderId = 'test-calc-' + Date.now();
      await client.query(
        `INSERT INTO order_header(tenant_id, order_id, customer_id, status, currency, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['tenant1', orderId, 'cust-003', 'NEW', 'USD', 250.00]
      );

      await client.query(
        `INSERT INTO order_item(tenant_id, order_id, line_no, sku, qty, unit_price)
         VALUES ($1, $2, 1, 'SKU-D', 5, 50.00)`,
        ['tenant1', orderId]
      );

      const result = await pool.query(
        'SELECT line_amount FROM order_item WHERE order_id = $1',
        [orderId]
      );
      assert.strictEqual(Number(result.rows[0].line_amount), 250.00, 'Line amount should be qty * unit_price');

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
});
