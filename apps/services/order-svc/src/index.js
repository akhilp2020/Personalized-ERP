const cors = require("cors");
const express = require('express');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/healthz', (_,res)=>res.send('ok'));
app.post('/orders', (req,res)=>res.status(201).json({ ok:true, received:req.body }));

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
const origPost = app._router.stack.find(l => l.route && l.route.path === '/orders' && l.route.methods.post);
if (origPost) {
  const handler = origPost.route.stack[0].handle;
  origPost.route.stack[0].handle = async (req, res, next) => {
    const orderId = 'o-' + Date.now();
    const tenantId = req.headers['x-tenant-id'] || 'tenant1';
    // Call original handler; capture body user sent
    const body = req.body || {};
    // Fire-and-forget publish (no need to block the response)
    publishOrderCreated({ tenantId, orderId, ...body }).catch(() => {});
    return handler(req, res, next);
  };
}
