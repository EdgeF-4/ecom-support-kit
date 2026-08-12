# Local workflow definitions

This directory contains a thin intake webhook and an error recorder for the
offline acceptance kit. The intake workflow delegates once to the tested
`POST /support` pipeline, which owns routing, cache behavior, and ticket writes.

The repository validates these definitions as JSON and checks their graph
shape, node types, request path, and single service call in `npm test`. It does
not bundle a workflow runtime. That keeps an optional third-party dependency
surface out of the acceptance stack while preserving the definitions for teams
that already operate a supported installation.

## Files

| File | Purpose |
|---|---|
| `support-intake.json` | Accepts a message, calls the service once, and returns its result |
| `error-handler.json` | Records the failed workflow, node, error, and input |

## Import

Start the database and service from the repository root:

```bash
docker compose up -d --wait
curl -s http://127.0.0.1:8080/health
```

In your separately managed workflow installation, import
`support-intake.json` and `error-handler.json` using that installation's
documented import command or UI. Configure `SUPPORT_SERVICE_URL` to the URL by
which that installation reaches the service. The workflows need no application
credential, and the service uses the local model and database.

## Required operator steps

1. Import both JSON files into a separately managed supported installation.
2. Open `Support Intake`.
3. Open **Settings, Error Workflow**.
4. Select `Support Error Handler`.
5. Save both workflows.
6. Activate `Support Intake` for the production webhook, or click **Execute
   workflow** for one test webhook request.

Imported workflows do not select or activate an error workflow automatically.

## Send a test request

After clicking **Execute workflow**, replace port 5678 below if your separately
managed installation uses another loopback port, then run:

```bash
curl -s http://127.0.0.1:5678/webhook-test/support/intake \
  -H 'content-type: application/json' \
  -d '{"message":"where is my order #1001?","channel":"web"}'
```

After activation, use the production webhook path:

```bash
curl -s http://127.0.0.1:5678/webhook/support/intake \
  -H 'content-type: application/json' \
  -d '{"message":"where is my order #1001?","channel":"web"}'
```

A successful response includes `reply`, `intent`, `route`, `status`,
`ticketId`, and `cached`.

Confirm that the service recorded exactly one ticket:

```bash
curl -s http://127.0.0.1:8080/tickets
```

## Failure behavior

If the service is unavailable, the `Process Support Request` node fails. With
the error workflow selected, the error handler attempts to record that failure
through `POST /errors` after service access is restored.

If the error recorder also cannot reach the service, inspect the failed
execution in the workflow UI. Restore the service with:

```bash
docker compose up -d --wait service
curl -s http://127.0.0.1:8080/health
```

Then retry the failed intake request. The kit does not include an external
dead-letter queue, notification channel, or automatic replay.

## Why the workflow is thin

The previous graph repeated classification and persistence steps already owned
by the service. That allowed the demo and imported workflow to drift, and made
duplicate writes possible.

The rebuilt graph has one composition root. The tradeoff is that route changes
must be made and tested in the TypeScript pipeline rather than edited visually.
