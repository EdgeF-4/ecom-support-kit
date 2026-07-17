# ecom-support-kit

## Quickstart: 60-second offline demo

With Node 20 or newer and the repository's npm dependencies installed, run:

```sh
./demo.sh
```

The command compiles the service locally, loads the bundled synthetic
storefront, and walks through deterministic answers, multi-tool synthesis,
scope refusal, human handoff, ticket persistence, and cache reuse. It forces the
in-memory store and mock model, so it needs no API keys, containers, paid calls,
or network access. Expected output includes:

```text
[1/4] Load a synthetic storefront
[2/4] Route customer messages through the real support pipeline
  route=deterministic  intent=order_status  status=resolved  ticket=#1
  route=model  intent=multi_topic  status=resolved  ticket=#3
  route=out_of_scope  intent=out_of_scope  status=resolved  ticket=#5
[3/4] Repeat the multi-tool question to exercise the answer cache
  served from cache: true
  model calls total: 1
[4/4] Confirm the operational trail
  tickets persisted: 7
```

A self hostable customer support kit for Shopify stores, built on self hosted
n8n. It is a scoped business task assistant for order status, returns, shipping,
store FAQ, and booking. It answers from your store data and routes anything it
should not handle to a person. It is not a general chatbot.

I built this for small stores that want useful automated support they can run
themselves, without shipping customer questions to a black box and without a
monthly per seat bill. Everything in this repo runs offline out of the box with
a mock store and a mock model, so you can try the whole flow with no API keys
and no paid calls.

**Stack:** importable n8n workflows, a small Node and TypeScript tool service,
Postgres for tickets, and Docker Compose for one command startup.

## Why this beats a generic chatbot

A generic chatbot bolted onto a store tends to do three things badly: it
invents answers it cannot back up, it costs a model call on every single
message, and it happily wanders off topic. This kit is built the opposite way.

- **It stays in scope, which keeps it compliant.** As of January 2026, Meta
  restricts general purpose AI chatbots on its messaging platforms, while scoped
  assistants that handle defined business tasks such as order status, FAQ, and
  booking remain allowed. This kit is scoped by construction: a classifier
  decides whether a message is one of the supported tasks, and anything else is
  declined politely rather than answered freely.
- **Answers trace back to store data.** The deterministic tools look up real
  orders and real FAQ entries. When the model is used, it is given only the tool
  output and told to stay inside it, so it cannot make up a tracking number.
- **Most messages never touch a paid model.** A deterministic first router
  handles order lookups, FAQ, shipping, and booking with templates. The model is
  reserved for messages that genuinely need to combine several tools. On top of
  that, an answer cache means a repeated question is free the second time.
- **You own it.** It is self hosted, every message becomes a ticket in your own
  Postgres, and a dedicated error workflow captures any failed run so nothing
  silently disappears.

## Architecture

![Architecture diagram](docs/architecture.svg)

A message arrives at the n8n intake webhook. A deterministic classifier picks
one of four routes: answer from store data with no model, synthesize an in scope
answer with the model and the MCP tools, escalate to a human, or decline because
the request is out of scope. Every path writes a ticket and replies to the
caller. The tool service exposes the same business logic two ways, an MCP server
for the model driven branch and a REST facade for the deterministic branch, both
backed by mock adapters that need no credentials. Full detail is in
[ARCHITECTURE.md](ARCHITECTURE.md).

## See it run

This terminal preview shows the same support routes as the current offline demo.
The compact dataset used by `./demo.sh` has synthetic order IDs and shorter
store answers so a prospect can scan the walkthrough in under a minute:

![Demo run](docs/demo.svg)

Notice the last three lines: one model call across the whole run, the repeated
question served from cache, and a ticket opened for every message.

## Quick start

You need Docker and Docker Compose.

```bash
git clone https://github.com/EdgeF-4/ecom-support-kit.git
cd ecom-support-kit
cp config.example.json config.json
chmod 600 config.json
docker compose up -d
```

This starts Postgres, the tool service on port 8080, and n8n on port 5678. The
default configuration uses the mock store and the mock model, so no API key is
required.

Send a message straight to the tool service:

```bash
curl -s localhost:8080/support \
  -H 'content-type: application/json' \
  -d '{"message":"where is my order #1001?"}'
```

Then import the workflows into n8n at `http://localhost:5678`. See
[workflows/README.md](workflows/README.md) for the import and wiring steps,
including how to point the n8n chat model node at the offline mock.

### Run the tool service without Docker

```bash
cd service
npm install
npm run build
npm start          # serves on 8080 with the in memory store and mock model
npm run demo       # runs the same offline portfolio walkthrough as ./demo.sh
```

## How it decides

| Route | When | Cost |
|-------|------|------|
| Deterministic | A single supported task with clear data, for example an order number or a known FAQ. | No model call. |
| Model | In scope but needs to combine tools, for example an order plus a return question. | One model call, then cached. |
| Escalate | The customer asks for a human, or confidence is low. | Opens a ticket, no model call. |
| Out of scope | Not one of the supported tasks. | Declined politely, no model call. |

## Tools and MCP

The tool service exposes four tools over an MCP server at `/mcp` and over a REST
facade at `/tools/<name>`:

- `order_lookup`: order status, fulfillment, and tracking by order number or email.
- `faq_retrieval`: ranked answers from the store FAQ corpus.
- `check_booking`: available consultation or fitting slots.
- `escalate`: opens a ticket and routes it to a human queue.

The n8n MCP Client node connects to `/mcp`, so the model driven branch discovers
and calls these tools the standard way.

## Configuration and secrets

Runtime configuration lives in `config.json`, which is git ignored and expected
to be `chmod 600`. A committed `config.example.json` documents every field.
Secrets never go in environment files and are never committed. The default
config runs the kit offline, so no secret is needed to try it.

To go live, point the store adapter at a real Shopify backend and set
`llm.driver` to `openaiCompatible` with the base URL, model, and key of any
OpenAI compatible provider. Those are the only changes; the rest of the kit does
not move.

## Tests

```bash
cd service
npm test
```

The suite uses the Node built in test runner, so there is no test framework to
install. It covers the classifier routing decisions, each tool against the mock
adapters, the answer cache, an offline end to end run through every route, and
the HTTP and MCP surface on a real ephemeral port. It runs fully offline with
the in memory store, and it passes from a clean checkout.

## Project layout

```
ecom-support-kit/
  docker-compose.yml      one command startup for Postgres, the service, and n8n
  config.example.json     documented config; copy to config.json (git ignored)
  sql/init.sql            tickets, answer_cache, and failures tables
  workflows/              importable n8n intake and error workflows
  service/                Node and TypeScript tool service
    src/                  classifier, tools, mock adapters, MCP server, pipeline
    test/                 unit and offline end to end tests
  docs/                   architecture diagram and demo screenshot
  scripts/publish.sh      one step publish for the repository owner
```

## License

MIT. See [LICENSE](LICENSE).
