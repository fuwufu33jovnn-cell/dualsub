// DualSub extension -> local/server translation bridge.
// Import this module from the extension code that currently sends translation requests.

const DEFAULT_DUALSUB_SERVER = "http://127.0.0.1:8787";

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_DUALSUB_SERVER).replace(/\/+$/, "");
}

export async function checkDualSubServer({
  baseUrl = DEFAULT_DUALSUB_SERVER,
  signal
} = {}) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/health`, {
    method: "GET",
    signal
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `DualSub server unavailable (HTTP ${response.status})`);
  }

  return data;
}

export async function translateWithDualSub({
  text,
  sourceLanguage = "auto-detect",
  targetLanguage = "Simplified Chinese",
  baseUrl = DEFAULT_DUALSUB_SERVER,
  accessToken = "",
  signal
}) {
  const cleanText = typeof text === "string" ? text.trim() : "";

  if (!cleanText) {
    throw new Error("Subtitle text is empty");
  }

  const headers = {
    "Content-Type": "application/json"
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/translate`,
    {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        text: cleanText,
        sourceLanguage,
        targetLanguage
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error || `Translation request failed (HTTP ${response.status})`;
    const error = new Error(message);
    error.code = data?.code || "DUALSUB_TRANSLATION_FAILED";
    error.status = response.status;
    throw error;
  }

  if (!data?.translation) {
    throw new Error("DualSub server returned an empty translation");
  }

  return {
    translation: data.translation,
    model: data.model || null,
    usage: data.usage || null
  };
}
