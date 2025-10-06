const cors = require('cors');
const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(cors());
app.use(express.json());

const PG_URL = process.env.PG_URL || 'postgres://postgres:postgres@pg.dev.svc.cluster.local:5432/postgres';
const pool = new Pool({ connectionString: PG_URL });

app.get('/healthz', (_,res)=>res.send('ok'));
app.post('/orders', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'] || 'tenant1';
  const payload = req.body || {};
  const orderId = 'o-' + Date.now();

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const total = lines.reduce((sum, line) => {
    const qty = Number(line.qty) || 0;
    const price = Number(line.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO orders(tenant_id, order_id, customer_id, status, currency, total_amount, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7)` ,
      [tenantId, orderId, payload.customerId || 'UNKNOWN', 'NEW', payload.currency || 'USD', total, payload]
    );

    await client.query(
      `INSERT INTO order_items(tenant_id, order_id, line_no, sku, qty, unit_price, payload)
       SELECT $1, $2, (row_number() OVER (ORDER BY 1))::int,
              (elem->>'sku')::text,
              (elem->>'qty')::numeric,
              (elem->>'unitPrice')::numeric,
              elem
       FROM jsonb_array_elements($3::jsonb) AS elem(elem)`,
      [tenantId, orderId, JSON.stringify(lines)]
    );

    await client.query('COMMIT');

    publishOrderCreated({ tenantId, orderId, ...payload }).catch(() => {});
    return res.status(201).json({ ok: true, orderId, received: payload });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('order persist failed', err);
    return res.status(500).json({ ok: false, error: 'db_insert_failed' });
  } finally {
    client.release();
  }
});

app.get('/orders/recent', async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT order_id, customer_id, total_amount, currency, to_char(created_at,'YYYY-MM-DD HH24:MI:SS') AS created_at FROM orders ORDER BY created_at DESC LIMIT 20"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('db query failed', err);
    res.status(500).json({ ok: false, error: 'db_query_failed' });
  }
});

app.listen(8080, ()=> console.log('order-svc listening on :8080'));

// ---- Redpanda (Kafka) minimal producer ----
process.env.KAFKAJS_NO_PARTITIONER_WARNING = process.env.KAFKAJS_NO_PARTITIONER_WARNING || '1';

const { Kafka, logLevel } = require('kafkajs');
const kafkaBrokers = (process.env.KAFKA_BROKER || 'redpanda.dev.svc.cluster.local:9092')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const kafkaEnabled = kafkaBrokers.length > 0;
const kafka = kafkaEnabled ? new Kafka({ clientId: 'order-svc', brokers: kafkaBrokers, logLevel: logLevel.NOTHING }) : null;
const producer = kafkaEnabled ? kafka.producer() : null;
let producerConnectPromise = null;
let producerHealthy = true;
let producerWarned = false;

async function publishOrderCreated(evt) {
  if (!producer || !producerHealthy) {
    return;
  }
  try {
    if (!producerConnectPromise) {
      producerConnectPromise = producer.connect();
    }
    await producerConnectPromise;
    await producer.send({
      topic: 'sales.order.created.v1',
      messages: [{ key: String(evt.orderId || ''), value: JSON.stringify(evt) }]
    });
  } catch (err) {
    producerHealthy = false;
    if (!producerWarned) {
      console.warn('kafka disabled after publish failure', err.message);
      producerWarned = true;
    }
  }
}

// Hook into your existing POST /orders route:
// Fire-and-forget publish from route handler above
