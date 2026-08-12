# ecom-support-kit

ecom-support-kit is an offline acceptance kit for engineers and consultants
designing support automation for online stores. It proves routing, store-data
lookups, answer caching, ticket persistence, and human handoff before live data
or paid model calls are involved, so a team can validate the risky workflow
before choosing or integrating a full help desk.

This is a reference implementation and test harness. It is not a live support
product.

## Prove it in under five minutes

Requirements:

- Node.js 24
- npm

Clone the repository with the repository page's Clone action. Then run:

```bash
cd ecom-support-kit/service
npm ci
npm run verify
```

No configuration, API key, container, or paid call is required.

`npm run verify` builds the service, runs the unit and end-to-end suite, then
prints six sample requests. The transcript shows all four routes, one ticket per
request, one offline model call, and a repeated request served from cache.

## Proof matrix

Every capability claimed in this README has a command here.

| Capability | Proof command | What to look for |
|---|---|---|
| Four routing outcomes | `cd service && npm run demo` | `deterministic`, `model`, `escalate`, and `out_of_scope` |
| Store lookups and booking availability | `cd service && npm test` | order, FAQ, and booking test names report `ok` |
| Cache and single ticket writes | `cd service && npm run demo` | `repeat served from cache: true` and ticket numbers increase once |
| HTTP and tool-protocol surfaces | `cd service && npm test` | the HTTP surface test and protocol calls report `ok` |
| Actionable failures | `cd service && npm test` | config, data, and HTTP failure tests report `ok` |
| Workflow graph integrity | `cd service && npm test` | both workflow structure tests report `ok` |
| Local service | `cd service && npm start` | `tool service listening on 127.0.0.1:8080` |
| Database-backed local stack | `docker compose up -d --wait` | `docker compose ps` shows the database and service healthy |
| Exact direct dependency set | `cd service && npm ls --depth=0` | the four deliberate versions match `package.json` |

An imported workflow still needs an operator to select its error workflow and
activate its webhook. Those UI steps are documented in
[workflows/README.md](workflows/README.md).

## What it does not do

- It does not provide an agent inbox, chat widget, email channel, social
  channel, reporting dashboard, or knowledge-base editor.
- It does not connect to a real commerce store or remote model. Both bundled
  adapters are deterministic local fixtures.
- It does not send escalation notifications. It records a queue assignment and
  ticket only.
- It does not reserve booking slots. It returns future availability only.
- It does not authenticate service routes or establish privacy compliance.
- It does not prove a full workflow execution until the operator imports,
  configures, and runs the workflow in their own local runtime.

Do not use this as a drop-in help desk. Do not expose it to live data. Teams
that need a staffed inbox, live channels, or a supported production deployment
should choose a production help desk and use this kit only as an integration
acceptance fixture.

## Design decision and tradeoff

The service pipeline is the single composition root. The workflow is a thin
webhook adapter that calls `POST /support` once and returns that result.

This deliberately avoids duplicating routing and ticket writes in two systems.
The benefit is one tested behavior for the command-line demo, HTTP service, and
workflow. The cost is that visual-workflow users cannot change route logic by
dragging nodes around. They must change and test the TypeScript pipeline.

The router is deterministic first. Clear single-topic requests never need the
offline model. Multi-topic requests use it, uncertain requests escalate, and
unhandled topics are declined. This reduces cost and off-topic behavior. The
tradeoff is a narrow supported scope and more human handoffs than a free-form
chatbot.

## Request outcomes

| Route | Trigger | Result |
|---|---|---|
| `deterministic` | One supported task with enough data | Calls one store tool and writes one resolved ticket |
| `model` | Several supported topics need one response | Combines tool output through the offline model and writes one ticket |
| `escalate` | A human is requested or confidence is low | Writes one escalated ticket with a queue assignment |
| `out_of_scope` | The task is unsupported | Declines the request and writes one ticket |

Run the scenario transcript:

```bash
cd service
npm run demo
```

The mock dates are rebased on each run. Shipped orders and appointment slots do
not silently become stale.

## Run the HTTP service

Start the offline service:

```bash
cd service
npm ci
npm start
```

Leave that terminal running. In a second terminal:

```bash
curl -s http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/tools
curl -s http://127.0.0.1:8080/support \
  -H 'content-type: application/json' \
  -d '{"message":"where is my order #1001?"}'
curl -s http://127.0.0.1:8080/tickets
curl -s http://127.0.0.1:8080/cache/stats
```

Use another loopback port if 8080 is busy:

```bash
PORT=18080 npm start
curl -s http://127.0.0.1:18080/health
```

## Run the database-backed stack

Requirements:

- Docker
- Docker Compose with `--wait` support

From the repository root:

```bash
docker compose config --quiet
docker compose up -d --wait
docker compose ps
curl -s http://127.0.0.1:8080/health
```

This starts the ticket database and tool service. The service port binds to
loopback. The database has no host port.

If a host port is taken:

```bash
SUPPORT_PORT=18080 docker compose up -d --wait
curl -s http://127.0.0.1:18080/health
```

The two optional workflow definitions remain under `workflows/`. They are
validated by `npm test`, but this repository does not bundle their runtime.
Continue with [workflows/README.md](workflows/README.md) only if you already run
a supported workflow installation and accept its separate dependency surface.

## Failure drills and fixes

Each public error has an error code, a cause, and a `Next:` action. These three
drills are safe and do not contact external services.

### Broken configuration

Trigger:

```bash
cd service
SUPPORT_CONFIG=/dev/null npm run demo
```

Error: `[CONFIG_PARSE_FAILED] Cannot parse the configuration file ...`

Cause: the selected file is empty or invalid JSON.

Fix: point `SUPPORT_CONFIG` at valid JSON, or unset it to use the offline
defaults. Then run `npm run demo` again.

### Missing mock data

Trigger:

```bash
cd service
DATA_DIR=/tmp/not-a-support-data-dir npm run demo
```

Error: `[DATA_FILE_MISSING] Cannot load the required mock data file ...`

Cause: the data directory does not contain the four required fixture files.

Fix: unset `DATA_DIR`, restore `service/data`, or point it at a directory with
`orders.json`, `products.json`, `faq.json`, and `booking.json`.

### Unreachable database

Trigger:

```bash
cd service
STORE_DRIVER=postgres PGHOST=127.0.0.1 PGPORT=1 npm start
```

Error: `[STORE_UNAVAILABLE] Cannot initialize the ticket database ...`

Cause: no database accepts connections at the configured host and port.

Fix: run `docker compose -f ../docker-compose.yml up -d postgres`, or use
`STORE_DRIVER=memory` for the offline check.

Other startup errors use the same contract. For example, `LISTEN_FAILED` tells
you to choose a free port, and `CONFIG_INVALID` names the invalid setting and an
accepted value.

## HTTP error contract

Client errors return JSON with three stable fields:

```json
{
  "error": "INVALID_INPUT",
  "message": "The message field is missing or is not text.",
  "next": "Send JSON such as {\"message\":\"where is order 1001?\"} and retry the request."
}
```

The tests deliberately exercise invalid JSON, missing input, unknown tools,
unknown routes, invalid chat input, and unsupported protocol methods.

## Configuration and security boundary

The zero-config service uses memory storage and local fixtures. Optional runtime
configuration lives in `config.json`, which is ignored by git. Copy
`config.example.json`, keep it mode 600, and supply real secrets through an
owner-managed deployment secret store.

The HTTP routes have no authentication. Never publish port 8080. Before using
live data, add an authenticated TLS boundary, implement and test real adapters,
define retention and access controls, add notification delivery, and review the
rules for every support channel and jurisdiction.

## Dependency policy

Run the dependency checks:

```bash
cd service
npm ci
npm audit --omit=dev
npm outdated
```

The manifest exact-pins every direct package. The runtime and type definitions
use Node 24, the active long-term-support line reviewed for this kit. The
compiler stays exact-pinned to 5.9.3 because the next major is a separate
migration, not a compatible patch. The database client stays exact-pinned to
the current compatible version 8 release.

Both container inputs are locked to reviewed digests. The service image removes
the Node package-manager toolchain, runs as the unprivileged `node` user, and
contains only production packages. The optional visual workflow runtime is
deliberately not bundled because its independent dependency surface did not
meet this kit's zero-known-vulnerability release threshold.

## Architecture

[ARCHITECTURE.md](ARCHITECTURE.md) documents the component boundary, request
flow, persistence model, and the single-composition-root decision.

The service exposes four tools through REST and a standard tool protocol:

- `order_lookup`
- `faq_retrieval`
- `check_booking`
- `escalate`

The tool protocol is an integration surface. The bundled workflow intentionally
uses the tested `POST /support` pipeline instead of duplicating orchestration.

## Project layout

```text
ecom-support-kit/
  README.md              executable proof and boundaries
  ARCHITECTURE.md        design decisions and data flow
  docker-compose.yml     database and service runtime
  config.example.json    non-secret configuration example
  service/               TypeScript service, local fixtures, and tests
  sql/init.sql            ticket, cache, and failure tables
  workflows/             intake and error workflow definitions
  scripts/publish.sh     branch-only push helper with safety checks
```

## License

MIT. See [LICENSE](LICENSE).
