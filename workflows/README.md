# Local workflow definitions

This directory contains a thin intake webhook and an error recorder for the
offline acceptance kit. The intake workflow delegates once to the tested
`POST /support` pipeline, which owns routing, cache behavior, and ticket writes.

The Compose file pins workflow runtime 2.33.7, the version used for the import
check. Other versions are not covered by that check.

## Files

| File | Purpose |
|---|---|
| `support-intake.json` | Accepts a message, calls the service once, and returns its result |
| `error-handler.json` | Records the failed workflow, node, error, and input |

## Import

Start the stack from the repository root, then import both definitions:

```bash
docker compose up -d --wait
docker compose exec n8n n8n import:workflow --separate --input=/workflows
```

The offline workflows need no application credential. Compose supplies
`SUPPORT_SERVICE_URL=http://service:8080`, and the service uses the local model
and database.

## Required operator steps

1. Open `Support Intake`.
2. Open **Settings, Error Workflow**.
3. Select `Support Error Handler`.
4. Save both workflows.
5. Activate `Support Intake` for the production webhook, or click **Execute
   workflow** for one test webhook request.

Imported workflows do not select or activate an error workflow automatically.

## Send a test request

After clicking **Execute workflow**, run:

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
