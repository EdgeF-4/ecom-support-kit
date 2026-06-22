# ecom-support-kit

A self hostable customer support kit for Shopify stores, built on self hosted
n8n. It is a scoped business task assistant for order status, returns, shipping,
store FAQ, and booking. It is not a general chatbot.

This README is expanded with full setup notes, the design rationale, and a demo
in a later build phase. See [ARCHITECTURE.md](ARCHITECTURE.md) for the design.

## Quick start

```bash
cp config.example.json config.json
chmod 600 config.json
docker compose up -d
```

The default configuration runs fully offline with a mock store and a mock model,
so no API keys are required.
