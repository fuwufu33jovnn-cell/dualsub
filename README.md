# DualSub server

A minimal server-side translation proxy for DualSub.

The OpenAI API key stays on the server and is never hard-coded into the browser extension.

## Requirements

- Node.js 18+
- An OpenAI API key

## Start

No npm packages need to be installed.

```bash
export OPENAI_API_KEY="YOUR_REAL_KEY"
npm start
```

The server starts at:

```text
http://127.0.0.1:8787
```

## Health check

```text
GET http://127.0.0.1:8787/health
```

## Translate

```text
POST http://127.0.0.1:8787/api/translate
Content-Type: application/json
```

Example body:

```json
{
  "text": "Hello, how are you?",
  "sourceLanguage": "English",
  "targetLanguage": "Simplified Chinese"
}
```

## Configuration

- `OPENAI_MODEL` — defaults to `gpt-5.6-luna`
- `DUALSUB_ACCESS_TOKEN` — optional Bearer token
- `ALLOWED_ORIGINS` — optional comma-separated browser origins
- `PORT` — defaults to `8787`
- `HOST` — defaults to `127.0.0.1`

See `.env.example` for the full list.

## Security

Never commit a real API key to GitHub.

For a public release, do not expose a permanent shared API secret in the browser extension. Use server-side authentication, per-user quotas, and rate limiting before allowing public traffic.
