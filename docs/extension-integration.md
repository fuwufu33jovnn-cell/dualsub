# Connecting the browser extension to the DualSub server

The repository now contains a reusable client module:

`extension/dualsub-api.js`

It exposes:

- `checkDualSubServer()`
- `translateWithDualSub()`

## Basic usage

```js
import {
  checkDualSubServer,
  translateWithDualSub
} from "./dualsub-api.js";

const result = await translateWithDualSub({
  text: originalSubtitle,
  sourceLanguage: detectedLanguage || "auto-detect",
  targetLanguage: selectedTargetLanguage || "Simplified Chinese"
});

translatedSubtitleElement.textContent = result.translation;
```

## Important

The current repository does not yet contain the original DualSub browser-extension source files, so the exact existing translation function cannot be patched until those files are available in this repository.

When the extension source is added, replace the old direct AI-provider request at the translation call site with `translateWithDualSub(...)`.

The browser extension should never contain `OPENAI_API_KEY`. The key stays in the server process.

## Local flow

1. Start the server:

```bash
export OPENAI_API_KEY="YOUR_REAL_KEY"
npm start
```

2. The extension sends subtitle text to:

```text
http://127.0.0.1:8787/api/translate
```

3. The server calls OpenAI.
4. The server returns only the translation.
5. The extension renders it beside/below the original subtitle.

## Chrome extension note

If the extension's CSP or permissions block localhost requests, add the server origin to the extension manifest's `host_permissions`, for example:

```json
{
  "host_permissions": [
    "http://127.0.0.1:8787/*"
  ]
}
```

For a cloud deployment later, replace the local URL with the deployed HTTPS endpoint and update `host_permissions` accordingly.
