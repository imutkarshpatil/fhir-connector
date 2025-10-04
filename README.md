# 🏥 Health Tables → FHIR Connector Service

A real-time synchronization connector that streams database changes from the **Health Tables** PostgreSQL schema to a **FHIR server** (Medblocks Bootcamp environment).

Every INSERT, UPDATE, or DELETE on `patient` or `patient_other_identifiers` is captured via triggers, written into an **Outbox Table**, and then propagated as a **FHIR Patient resource update** using the connector worker.

---

## 🧩 Architecture Overview

```text
PostgreSQL (Health Tables)
 ├── patient
 ├── patient_other_identifiers
 ├── fhir_outbox
 ├── fhir_dlq
 └── fhir_processed_event

Triggers → fhir_outbox_write_notify() → NOTIFY channel → Connector
````

The connector:
* Listens to Postgres `NOTIFY` events (low-latency).
* Groups rows by transaction ID (txid) + patient_id.
* Transforms DB payload → FHIR `Patient` JSON.
* Performs idempotent `PUT /Patient?identifier=system|value`.
* Marks events processed, retries transient failures, and moves permanent failures to DLQ.

---

## ⚙️ Repository Structure

```text
fhir-connector/
│
├── connector/               # Connector app (Node.js)
│   ├── Dockerfile
│   ├── package.json
│   ├── README.md
│   └── lib/
│       ├── config/          # Environment + constants
│       ├── db/              # Sequelize + models
│       ├── fhir/            # FHIR client + mapper
│       ├── notify/          # pg LISTEN/NOTIFY handler
│       ├── processing/      # Outbox processor logic
│       ├── metrics/         # Prometheus metrics + /metrics server
│       ├── logger/          # Pino logger
│       └── utils/           # Helpers (sleep, mergePayloads, etc.)
│
├── sql/                     # PostgreSQL setup
│   ├── init.sql             # Schema + triggers + sample data
│   └── test_events.sql      # Script to verify trigger & outbox
│
├── docker-compose.yml       # Production / staging setup
├── docker-compose.override.yml # Dev override (hot reload)
├── .env.example             # Config template
└── README.md                # (this file)
```

---

## 🧱 Quick Start (Dev Mode)

```bash
# 1. Clone and prepare environment
git clone https://github.com/imutkarshpatil/fhir-connector
cd fhir-connector
cp .env.example .env

# 2. Start Postgres + Connector
docker compose up --build

# 3. Verify connector logs
docker compose logs -f connector

# 4. Verify DB initialization
docker exec -it fhir_pg psql -U postgres -d health_tables -c "SELECT * FROM patient LIMIT 2;"

# 5. Test triggers
docker exec -it fhir_pg psql -U postgres -d health_tables -f /docker-entrypoint-initdb.d/test_events.sql
```

---

## 🧠 Key Components

| Component                                      | Description                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| **PostgreSQL triggers**                        | Capture DB changes via `AFTER INSERT/UPDATE/DELETE` hooks.       |
| **Outbox Table (`fhir_outbox`)**               | Durable store of events grouped by `txid`.                       |
| **Connector Worker**                           | Listens to notifications, processes outbox rows, calls FHIR API. |
| **Dead-Letter Queue (`fhir_dlq`)**             | Stores permanently failing records.                              |
| **Idempotency Store (`fhir_processed_event`)** | Ensures no duplicate processing.                                 |
| **Metrics Server**                             | Exposes Prometheus metrics on port `9464`.                       |

---

## 📊 Monitoring & Metrics

The connector exposes Prometheus metrics at:

**URL:** [http://localhost:9464/metrics](http://localhost:9464/metrics)

| Metric                           | Type      | Description                     |
| -------------------------------- | --------- | ------------------------------- |
| `fhir_outbox_unprocessed_count`  | Gauge     | Number of unprocessed rows      |
| `fhir_outbox_lag_seconds`        | Gauge     | Age of oldest unprocessed event |
| `fhir_dlq_total`                 | Gauge     | DLQ size                        |
| `fhir_connector_processed_total` | Counter   | Successfully processed events   |
| `fhir_connector_failed_total`    | Counter   | Failed attempts                 |
| `fhir_call_latency_seconds`      | Histogram | FHIR API call latency           |
| `fhir_call_errors_total`         | Counter   | FHIR HTTP errors                |

---

## 🧾 Logs

Structured JSON logs via **Pino**:

```bash
docker compose logs -f connector | jq .
```

Each log entry includes `worker_id`, `txid`, `fhirId`, and message context.

---

## 🧰 Troubleshooting

| Problem                   | Possible Cause                  | Fix                                                           |
| ------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `ECONNREFUSED postgres`   | DB not ready                    | Wait for DB startup; connector retries                        |
| `No identifier available` | Missing patient identifiers     | Ensure `identifier_system` & `identifier_value` columns exist |
| `FHIR call error 500`     | FHIR server unstable            | Retried automatically with backoff                            |
| Empty `/metrics`          | Metrics poll interval too short | Increase `METRICS_POLL_SECONDS` in `.env`                     |

---

## 🧪 Testing

Run test events:

```bash
docker exec -it fhir_pg psql -U postgres -d health_tables -f /docker-entrypoint-initdb.d/test_events.sql
```

Expected behavior:

* Outbox rows created for INSERT/UPDATE/DELETE.
* Connector logs show FHIR PUT calls.
* Metrics updated.

---

## 🧩 References

* [FHIR R4 Patient Resource](https://www.hl7.org/fhir/patient.html)
* [Medblocks Bootcamp FHIR Server](https://fhir-bootcamp.medblocks.com/fhir/)
* [prom-client Documentation](https://github.com/siimon/prom-client)
* [Sequelize ORM Docs](https://sequelize.org/)
* [Pino Logger](https://getpino.io/)

---

## 📜 License

MIT © 2025