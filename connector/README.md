# ⚙️ FHIR Connector (Node.js Service)

The **FHIR Connector** is a stateless Node.js worker that listens for database change notifications from PostgreSQL and pushes synchronized updates to a FHIR server.

It forms the core of the **Health Tables → FHIR synchronization pipeline** and integrates with **Prometheus** and **Grafana** for observability.

---

## 🧩 Overview

**Data Flow**
```text
1. PostgreSQL trigger → INSERTs into fhir_outbox
2. trigger → pg_notify('fhir_outbox_event', outbox_id)
3. connector listens → claims outbox rows (txid + patient_id)
4. transforms rows → FHIR Patient JSON
5. PUT /Patient?identifier=system|value
6. marks processed or moves to DLQ
````

**Latency goal:** < 1 second from DB commit to FHIR update
**Delivery semantics:** *at-least-once* (idempotent PUTs prevent duplicates)

---

## 🧠 Modular Design

| Folder        | Description                                      |
| ------------- | ------------------------------------------------ |
| `config/`     | Environment, defaults, and constants             |
| `db/`         | Sequelize initialization + model definitions     |
| `notify/`     | pg LISTEN/NOTIFY subscriber                      |
| `processing/` | Transaction grouping, retry, and DLQ handling    |
| `fhir/`       | HTTP client + mapping DB rows → FHIR JSON        |
| `metrics/`    | Prometheus counters, gauges, and /metrics server |
| `logger/`     | Pino structured logger                           |
| `utils/`      | Common utilities (sleep, mergePayloads, etc.)    |

---

## 🧾 Key Metrics

| Metric                           | Type      | Description                                    |
| -------------------------------- | --------- | ---------------------------------------------- |
| `fhir_outbox_unprocessed_count`  | Gauge     | Number of unprocessed rows                     |
| `fhir_outbox_lag_seconds`        | Gauge     | Age of oldest unprocessed outbox row           |
| `fhir_connector_processed_total` | Counter   | Number of successfully processed rows          |
| `fhir_connector_failed_total`    | Counter   | Number of failed rows (transient or permanent) |
| `fhir_dlq_total`                 | Gauge     | DLQ size                                       |
| `fhir_call_latency_seconds`      | Histogram | FHIR call duration distribution (p50/p90/p99)  |
| `fhir_call_errors_total`         | Counter   | Count of FHIR API failures                     |

Metrics are exported via `prom-client` and scraped every 5 seconds by Prometheus.

---

## 🧭 Prometheus Endpoint

The connector exposes metrics via an embedded HTTP server:

```
GET /metrics → text/plain; version=0.0.4
```

Default port: `9464`
Change with `METRICS_PORT` in `.env`.

Prometheus scrape config (from root `prometheus.yml`):

```yaml
scrape_configs:
  - job_name: fhir_connector
    static_configs:
      - targets: ['connector:9464']
```

Grafana automatically provisions a dashboard from
`grafana/dashboards/fhir_connector_dashboard.json` when using the provided Docker setup.

---

## 🧱 Local Development

### 1️⃣ Start in hot-reload mode (Docker)

```bash
docker compose up
```

The dev override mounts source code and runs:

```bash
npm install && npm run dev
```

(`nodemon` watches for changes and restarts automatically.)

The startup is guarded by `wait-for-postgres.sh` — it waits until the Postgres service is reachable before starting Node.js.

### 2️⃣ Run standalone (without Docker)

```bash
cd connector
cp ../.env.example .env
npm install
npm run start
```

---

## 🧩 Logging

Structured JSON logs emitted via **Pino**:

```json
{
  "level": "info",
  "time": "2025-10-05T13:05:22.322Z",
  "msg": "[processor] processed",
  "txid": 201992,
  "fhirId": "a3c22",
  "worker_id": "worker-1"
}
```

Log levels:

* `debug` → verbose development logs
* `info` → lifecycle + normal ops
* `warn` → transient failures
* `error` → DLQ, unrecoverable, or FHIR 4xx errors

Set with `LOG_LEVEL=debug` in `.env`.

---

## 🧰 Maintenance Operations

| Operation                | Command                                                |
| ------------------------ | ------------------------------------------------------ |
| Purge old processed rows | `SELECT fhir_cleanup_old(30);`                         |
| Inspect DLQ              | `SELECT * FROM fhir_dlq ORDER BY last_failed_at DESC;` |
| Requeue DLQ manually     | Move rows back to `fhir_outbox` if fixed               |

---

## 🧪 Testing and Verification

Run the built-in test script (from repo root):

```bash
docker exec -it fhir_pg psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/test_events.sql
```

Verify:

* Outbox rows created.
* Connector logs show FHIR PUT calls.
* Prometheus metrics counters increase.
* Grafana dashboard updates live.

---

## 🧱 Deployment Notes

* **Stateless:** Scale horizontally (multiple workers safely claim rows due to row-level locks).
* **Config via ENV:** Injected via `.env` or Docker environment.
* **Docker-ready:** Lightweight Alpine image (~120 MB).
* **Wait-for-Postgres:** Prevents startup race with DB initialization.
* **Prometheus endpoint:** `/metrics` (port `9464`).
* **Grafana-ready:** Dashboards auto-provisioned and persisted in `grafana_data` volume.
* **Logging:** JSON (compatible with Loki, Datadog, etc.).

---

## 📦 Environment Variables

| Variable               | Description                  | Default                                     |
| ---------------------- | ---------------------------- | ------------------------------------------- |
| `DB_HOST`              | Postgres hostname            | `postgres`                                  |
| `DB_PORT`              | Postgres port                | `5432`                                      |
| `DB_USER`              | Postgres user                | `postgres`                                  |
| `DB_PASSWORD`          | DB password                  | `postgres`                                  |
| `DB_NAME`              | Database name                | `postgres`                                  |
| `DB_CHANNEL`           | NOTIFY channel               | `fhir_outbox_event`                         |
| `FHIR_SERVER`          | FHIR server base URL         | `https://fhir-bootcamp.medblocks.com/fhir/` |
| `WORKER_ID`            | Unique worker name           | auto-generated                              |
| `MAX_RETRIES`          | Max retries before DLQ       | `5`                                         |
| `METRICS_PORT`         | Prometheus port              | `9464`                                      |
| `METRICS_POLL_SECONDS` | Interval to update DB gauges | `10`                                        |
| `LOG_LEVEL`            | Log level                    | `info`                                      |

---

## 🧠 Extensibility Roadmap

* Add **OpenTelemetry tracing** for FHIR and DB operations.
* Support **Observation** and **Encounter** resource mappings.
* Introduce **graceful shutdown hooks** for Kubernetes readiness probes.
* Extend **Grafana dashboards** with latency and DLQ drill-downs.

---

## 🔗 See Also

Refer to the **[Root README](../README.md)** for:

* Docker Compose setup (Postgres + Connector + Prometheus + Grafana)
* Grafana provisioning details
* Troubleshooting common issues

---

MIT © 2025 — [Utkarsh Patil](https://github.com/imutkarshpatil)