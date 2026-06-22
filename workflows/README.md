# n8n workflows

Two importable workflows. They target n8n 1.60 or newer, which bundles the
LangChain nodes used on the model branch.

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
   at host `postgres`, port `5432`, user `support`.

3. **Model credential (offline mock).** Open the `Chat Model (offline mock)`
   node and create an OpenAI credential. Any non empty API key works, because
   the node `baseURL` is overridden to the local mock at
   `{{$env.SUPPORT_SERVICE_URL}}/v1`. No real provider is contacted. To use a
   real provider later, point the base URL and key at it in the credential and
   in `config.json`.

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

Every path ends by writing a row to `tickets` and responding to the caller.
