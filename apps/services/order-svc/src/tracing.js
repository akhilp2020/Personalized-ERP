const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const url = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector.dev.svc.cluster.local:4318') + '/v1/traces';
new NodeSDK({ traceExporter: new OTLPTraceExporter({ url }), instrumentations: [getNodeAutoInstrumentations()] }).start();
