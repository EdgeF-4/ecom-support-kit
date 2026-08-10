# n8n workflows

Two importable workflows. The Compose file pins workflow runtime 2.33.7, the
version used for this repository's import check. Other versions are not covered
by that check.

| File | Purpose |
|------|---------|
| `support-intake.json` | Receives a message, classifies it, calls tools, replies, and stores the ticket. |
| `error-handler.json` | Catches any failed execution and posts the failing node, the input, and the error to the tool service. |

## Import

From the n8n UI, open each file with **Workflows, Import from File**. Or from
the running container:

```bash
docker compose exec n8n n8n import:workflow --separate --input=/workflows
```

## Wiring after import

1. **Environment variable.** The workflows reach the tool service through
   `SUPPORT_SERVICE_URL`. Docker Compose sets it to `http://service:8080`. If
   you run n8n outside Compose, set it yourself.

2. **Postgres credential.** Open the `Persist Ticket` node and select a
   Postgres credential pointing at the `support` database. Compose runs Postgres
   at host `postgres`, port `5432`, user `support`. Use the same password value
   supplied to Compose through the `POSTGRES_PASSWORD` environment variable.

3. **Model credential (offline mock).** Open the `Chat Model (offline mock)`
   node and create an OpenAI credential. Any non empty API key works, because
   the node `baseURL` is overridden to the local mock at
   `{{$env.SUPPORT_SERVICE_URL}}/v1`. No real provider is contacted. To use a
   real provider later, configure that node's base URL and owner-managed
   credential. The direct service pipeline remains on its mock adapter.

4. **MCP tools.** The `Store Tools (MCP)` node connects to the tool service MCP
   server at `{{$env.SUPPORT_SERVICE_URL}}/mcp` over streamable HTTP. No auth is
   needed for the local demo.

5. **Error workflow.** Open `support-intake`, go to **Settings, Error
   Workflow**, and select `Support Error Handler`. From then on, any failure in
   the intake workflow is reported through the error workflow.

## How the intake workflow decides

The `Classify` step asks the tool service for a route:

- `deterministic`: a known task with clear data, answered from store data and a
  template with no model call. The cheap, default path.
- `model`: in scope but needs phrasing. The `Support Agent` uses the MCP tools
  and the offline mock model, grounded strictly to tool output.
- `escalate`: low confidence or a human was requested. A ticket is opened.
- `out_of_scope`: not a supported task. The kit declines politely instead of
  behaving like a general chatbot.

Every path writes one row to `tickets` and responds to the caller. The
escalation tool creates its row before responding; the other three branches use
the `Persist Ticket` node.

The answer cache demonstrated by `npm run demo` belongs to the direct service
pipeline. The imported model branch does not currently call the cache.
