const cors = require('cors');
const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.PG_URL || 'postgres://postgres:postgres@pg.dev.svc.cluster.local:5432/postgres'
});

app.get('/healthz', (_,res)=>res.send('ok'));
app.post('/orders', async (req, res) => {
  const orderId = 'o-' + Date.now();
  const tenantId = req.headers['x-tenant-id'] || 'tenant1';
  const body = req.body || {};

  try {
    await pool.query('INSERT INTO orders(order_id, payload) VALUES ($1, $2)', [orderId, body]);
  } catch (err) {
    console.error('orders insert error', err);
    return res.status(500).json({ ok: false, error: 'db_insert_failed' });
  }

  publishOrderCreated({ tenantId, orderId, ...body }).catch(() => {});
  return res.status(201).json({ ok: true, orderId, received: body });
});

app.listen(8080, ()=> console.log('order-svc listening on :8080'));

// ---- Redpanda (Kafka) minimal producer ----
const { Kafka } = require('kafkajs');
const kafka = new Kafka({
  clientId: 'order-svc',
  brokers: [process.env.KAFKA_BROKER || 'redpanda.dev.svc.cluster.local:9092']
});
const producer = kafka.producer();

async function publishOrderCreated(evt) {
  try {
    // connect once; subsequent calls reuse the connection
    if (!producer._connected) { await producer.connect(); producer._connected = true; }
    await producer.send({
      topic: 'sales.order.created.v1',
      messages: [{ key: String(evt.orderId || ''), value: JSON.stringify(evt) }]
    });
  } catch (err) {
    console.error('kafka publish error', err);
  }
}

// Hook into your existing POST /orders route:
// Fire-and-forget publish from route handler above
