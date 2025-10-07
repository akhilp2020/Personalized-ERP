# Platform Services Access Guide

## Active Port-Forwards

All services are running in the `dev` namespace. Use port-forwards to access them locally:

### Core Services

#### 1. PostgreSQL Database
```bash
kubectl -n dev port-forward svc/pg 5432:5432
```
- **Port**: 5432
- **Connection**: `postgres://postgres:postgres@localhost:5432/postgres`
- **Tables**: `order_header`, `order_item`, and 96+ others

#### 2. PgAdmin (Database UI)
```bash
kubectl -n dev port-forward svc/pgadmin 5050:80
```
- **URL**: http://localhost:5050
- **Email**: `admin@example.com`
- **Password**: `admin123`

To add PostgreSQL server in PgAdmin:
- **Host**: `pg.dev.svc.cluster.local`
- **Port**: `5432`
- **Username**: `postgres`
- **Password**: `postgres`

#### 3. Redpanda Console (Kafka UI)
```bash
kubectl -n dev port-forward svc/redpanda-console 8083:8080
```
- **URL**: http://localhost:8083
- **Topics**: `sales.order.created.v1`

#### 4. Order Service API
```bash
kubectl -n dev port-forward svc/order-svc 8088:8080
```
- **Base URL**: http://localhost:8088
- **Endpoints**:
  - `POST /orders` - Create order
  - `GET /orders/recent` - List recent orders
  - `GET /orders/:orderId` - Get order with items

#### 5. Jaeger (Distributed Tracing)
```bash
kubectl -n dev port-forward svc/jaeger-query 16686:16686
```
- **URL**: http://localhost:16686
- **Tracked Services**: `jaeger-all-in-one`, `order-svc`

#### 6. Apicurio Registry (Schema Registry)
```bash
kubectl -n dev port-forward svc/apicurio-registry 18080:8080
```
- **URL**: http://localhost:18080
- **Health**: http://localhost:18080/health/live

### Other Available Services

#### Prometheus
```bash
kubectl -n dev port-forward svc/prom 9090:9090
```
- **URL**: http://localhost:9090

#### Grafana
```bash
kubectl -n dev port-forward svc/grafana 3000:3000
```
- **URL**: http://localhost:3000

#### Temporal (Workflow Engine)
```bash
kubectl -n dev port-forward svc/temporal-frontend 7233:7233
```

#### Unleash (Feature Flags)
```bash
kubectl -n dev port-forward svc/unleash 4242:4242
```
- **URL**: http://localhost:4242

#### Kafka/Redpanda (Direct Access)
```bash
kubectl -n dev port-forward svc/redpanda 9092:9092
```

## Quick Testing

### Order API
```bash
# Create order
curl -X POST http://localhost:8088/orders \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant1" \
  -d '{
    "customerId": "test-123",
    "currency": "USD",
    "lines": [
      {"sku": "WIDGET-A", "qty": 2, "unitPrice": 25.00}
    ]
  }'

# List recent orders
curl http://localhost:8088/orders/recent | jq .

# Get order details
curl http://localhost:8088/orders/{orderId} | jq .
```

### Database Access
```bash
export PGPASSWORD=postgres
psql -h localhost -U postgres -d postgres

# View new order tables
\dt order*
SELECT * FROM order_header LIMIT 5;
SELECT * FROM order_item LIMIT 5;
```

### Order UI Demo
```bash
open apps/demos/order-ui/index.html
# Uses port 8088 for order-svc
```

## Troubleshooting

### Check Port-Forwards
```bash
ps aux | grep port-forward | grep -v grep
```

### Restart a Port-Forward
```bash
# Kill existing
pkill -f "port-forward.*<service>"

# Start new
kubectl -n dev port-forward svc/<service> <local-port>:<service-port> &
```

### Check Service Status
```bash
# All pods
kubectl -n dev get pods

# All services
kubectl -n dev get svc

# Logs
kubectl -n dev logs -l app=<service> --tail=50
```

### Start All Essential Port-Forwards
```bash
# PostgreSQL
kubectl -n dev port-forward svc/pg 5432:5432 > /dev/null 2>&1 &

# PgAdmin
kubectl -n dev port-forward svc/pgadmin 5050:80 > /dev/null 2>&1 &

# Kafka Console
kubectl -n dev port-forward svc/redpanda-console 8083:8080 > /dev/null 2>&1 &

# Order Service
kubectl -n dev port-forward svc/order-svc 8088:8080 > /dev/null 2>&1 &

# Jaeger
kubectl -n dev port-forward svc/jaeger-query 16686:16686 > /dev/null 2>&1 &

# Apicurio
kubectl -n dev port-forward svc/apicurio-registry 18080:8080 > /dev/null 2>&1 &
```

## Service Health Checks

```bash
# PostgreSQL
psql -h localhost -U postgres -d postgres -c "SELECT version();"

# PgAdmin
curl -s http://localhost:5050/login | grep -q pgAdmin && echo "OK" || echo "FAIL"

# Kafka Console
curl -s http://localhost:8083/api/topics | jq .

# Order Service
curl http://localhost:8088/healthz

# Jaeger
curl -s http://localhost:16686/api/services | jq .

# Apicurio
curl -s http://localhost:18080/health/live | jq .
```
