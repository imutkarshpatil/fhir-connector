# 🏥 Health Tables → FHIR Connector Service

A real-time synchronization connector that streams database changes from the **Health Tables** PostgreSQL schema to a **FHIR server** (Medblocks Bootcamp environment).

Every `INSERT`, `UPDATE`, or `DELETE` on `patient` or `patient_other_identifiers` is captured via triggers, written into an **Outbox Table**, and then propagated as a **FHIR Patient resource update** using the connector worker.

---

## 🧩 Architecture Overview

```text
PostgreSQL (Health Tables)
 ├── patient
 ├── patient_other_identifiers
 ├── fhir_outbox
 ├── fhir_dlq
 └── fhir_processed_event

Triggers → fhir_outbox_write_notify() → NOTIFY channel → Connector → FHIR Server
```

The connector:

* Listens to Postgres `NOTIFY` events (low-latency).
* Groups rows by transaction ID (txid) + `patient_id`.
* Transforms DB payload → FHIR `Patient` JSON.
* Performs idempotent `PUT /Patient?identifier=system|value`.
* Marks events processed, retries transient failures, and moves permanent failures to DLQ.
* Exposes Prometheus metrics and integrates with Grafana for live monitoring.

---

## ⚙️ Repository Structure

```text
fhir-connector/
│
├── connector/                     # Node.js Connector app
│   ├── Dockerfile
│   ├── package.json
│   ├── index.js
│   ├── wait-for-postgres.sh       # Ensures DB readiness before start
│   ├── src/
│   │   ├── config/                # Environment + constants
│   │   ├── db/                    # Sequelize + models
│   │   ├── fhir/                  # FHIR client + mapper
│   │   ├── notify/                # pg LISTEN/NOTIFY handler
│   │   ├── processing/            # Outbox processor logic
│   │   ├── metrics/               # Prometheus metrics + /metrics server
│   │   ├── logger/                # Pino logger
│   │   └── utils/                 # Helpers (sleep, mergePayloads, etc.)
│
├── sql/                           # PostgreSQL schema + seed data
│   ├── init.sql                   # Health Tables + Outbox + Triggers
│   └── health_tables_simple.sql   # (Optional) simple schema example
│
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/datasource.yml
│   │   └── dashboards/dashboard.yml
│   └── dashboards/fhir_connector_dashboard.json
│
├── prometheus.yml                 # Prometheus scrape config (connector:9464)
├── docker-compose.yml             # Full stack (Postgres + Connector + Prometheus + Grafana)
├── .env.example                   # Environment variable template
└── README.md                      # (this file)
```

---

## 🧱 Quick Start (Dev Mode)

```bash
# 1. Clone and prepare environment
git clone https://github.com/imutkarshpatil/fhir-connector
cd fhir-connector
cp .env.example .env

# 2. Start everything (Postgres + Connector + Prometheus + Grafana)
docker compose up --build

# 3. Verify services
docker compose ps

# 4. Check connector logs
docker compose logs -f connector

# 5. Check DB initialization
docker exec -it fhir_pg psql -U postgres -d postgres -c "SELECT * FROM patient LIMIT 2;"
```

---

## 🧠 Key Components

| Component                                      | Description                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| **PostgreSQL triggers**                        | Capture DB changes via `AFTER INSERT/UPDATE/DELETE` hooks.       |
| **Outbox Table (`fhir_outbox`)**               | Durable event store grouped by `txid`.                           |
| **Connector Worker**                           | Listens to notifications, processes outbox rows, calls FHIR API. |
| **Dead-Letter Queue (`fhir_dlq`)**             | Stores permanently failing records.                              |
| **Idempotency Store (`fhir_processed_event`)** | Ensures no duplicate processing.                                 |
| **Metrics Server**                             | Exposes Prometheus metrics on port `9464`.                       |
| **Grafana Dashboard**                          | Visualizes metrics in real time (auto-provisioned).              |

---

## 📊 Monitoring Stack

### 🟢 Prometheus

Runs at **[http://localhost:9090](http://localhost:9090)**
Configured via `prometheus.yml` to scrape the connector every 5 seconds.

```yaml
scrape_configs:
  - job_name: "fhir_connector"
    static_configs:
      - targets: ["connector:9464"]
```

### 📈 Grafana

Runs at **[http://localhost:3000](http://localhost:3000)**
Default login: `admin / admin` (can be overridden in `.env`)

* Auto-provisions:

  * Prometheus datasource (`datasource.yml`)
  * Dashboard: **FHIR Connector — Metrics Overview**
* Persists dashboards & data in named Docker volumes.

Dashboard panels include:

| Metric                           | Type      | Description                               |
| -------------------------------- | --------- | ----------------------------------------- |
| `fhir_outbox_unprocessed_count`  | Gauge     | Number of unprocessed outbox rows         |
| `fhir_outbox_lag_seconds`        | Gauge     | Age (seconds) of oldest unprocessed event |
| `fhir_dlq_total`                 | Gauge     | Current DLQ size                          |
| `fhir_connector_processed_total` | Counter   | Successfully processed events             |
| `fhir_connector_failed_total`    | Counter   | Failed processing attempts                |
| `fhir_call_latency_seconds`      | Histogram | FHIR API call latency (p50/p90/p99)       |
| `fhir_call_errors_total`         | Counter   | FHIR HTTP errors (by code)                |

---

## 📊 Dashboard View

When the stack is running:

1. Visit **Grafana → Dashboards → FHIR Connector — Metrics Overview**
2. You’ll see panels for:

   * Connector health
   * Outbox queue size & lag
   * Processed / failed event rates
   * FHIR call latency histogram
   * DLQ size & trends

If you edit dashboards, export and commit the JSON back to
`grafana/dashboards/fhir_connector_dashboard.json` to persist changes.

---

## 🔄 Wait-for-Postgres Script

To avoid race conditions on startup, the connector uses a lightweight shell script:

```bash
connector/wait-for-postgres.sh
```

It checks for PostgreSQL readiness via TCP (and `pg_isready` if available) before starting the Node.js service.

---

## 🧾 Logs

Structured JSON logs via **Pino**:

```bash
docker compose logs -f connector | jq .
```

Each log entry includes:

* `service`, `worker_id`, `txid`, `fhirId`
* `msg` and error context

---

## 🧰 Troubleshooting

| Problem                                      | Cause / Hint                           | Fix                                                                                              |
| -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pollLoop error` / `relation does not exist` | DB init failed mid-way                 | Drop `pgdata/` and restart (`docker compose down && rm -rf pgdata && docker compose up --build`) |
| `ECONNREFUSED postgres`                      | DB not yet ready                       | Connector auto-retries; uses wait script                                                         |
| `gauge() unknown function`                   | PromQL syntax issue                    | Dashboard JSON fixed to remove invalid `gauge()` usage                                           |
| `No identifier available`                    | Missing patient identifiers            | Ensure `identifier_system` & `identifier_value` columns                                          |
| `FHIR call error 500`                        | Upstream FHIR server unstable          | Retries automatically with exponential backoff                                                   |
| Grafana dashboard not showing                | Provisioning files misplaced or cached | Check `grafana/provisioning` mounts; remove `grafana_data` volume to reprovision                 |

---

## 🧪 Testing the Triggers

You can simulate data changes to verify the connector reacts in real time:

```bash
docker exec -it fhir_pg psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/test_events.sql
```

Expected behavior:

* Outbox rows created for every DB change.
* Connector logs show FHIR `PUT /Patient?...` calls.
* Prometheus/Grafana metrics update live.

---

## 🧩 References

* [FHIR R4 Patient Resource](https://www.hl7.org/fhir/patient.html)
* [Medblocks Bootcamp FHIR Server](https://fhir-bootcamp.medblocks.com/fhir/)
* [Prometheus Docs](https://prometheus.io/docs/)
* [Grafana Docs](https://grafana.com/docs/)
* [prom-client (Node.js)](https://github.com/siimon/prom-client)
* [Sequelize ORM](https://sequelize.org/)
* [Pino Logger](https://getpino.io/)

---

## 📜 License

MIT © 2025 — [Utkarsh Patil](https://github.com/imutkarshpatil)