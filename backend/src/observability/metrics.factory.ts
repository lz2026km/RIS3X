import client from 'prom-client'

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
})

export const httpRequestDurationHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60],
})

export const dbConnectionErrorsCounter = new client.Counter({
  name: 'db_connection_errors_total',
  help: 'Total database connection errors',
})

export const dbActiveConnectionsGauge = new client.Gauge({
  name: 'db_active_connections',
  help: 'Current active database connections',
})

export const cacheHitCounter = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
})

export const cacheMissCounter = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
})

export const queueJobsWaitingGauge = new client.Gauge({
  name: 'queue_jobs_waiting',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'] as const,
})

export const queueJobsActiveGauge = new client.Gauge({
  name: 'queue_jobs_active',
  help: 'Number of active jobs in queue',
  labelNames: ['queue'] as const,
})

export const queueJobsFailedCounter = new client.Counter({
  name: 'queue_jobs_failed_total',
  help: 'Total failed jobs in queue',
  labelNames: ['queue'] as const,
})
