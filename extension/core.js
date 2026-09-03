(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DualSubCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PROVIDERS = ["qwen", "mistral", "siliconflow", "doubao", "deepseek", "kimi", "gemini", "openai"];
  const PROVIDER_NAMES = {
    gemini: "Gemini",
    deepseek: "DeepSeek",
    openai: "OpenAI",
    qwen: "千问",
    kimi: "Kimi",
    siliconflow: "硅基流动",
    mistral: "Mistral",
    doubao: "豆包"
  };
  const KEY_FIELDS = {
    gemini: "geminiApiKey",
    deepseek: "deepseekApiKey",
    openai: "openaiApiKey",
    qwen: "qwenApiKey",
    kimi: "kimiApiKey",
    siliconflow: "siliconflowApiKey",
    mistral: "mistralApiKey",
    doubao: "doubaoApiKey"
  };
  const MODEL_FIELDS = {
    gemini: "geminiModel",
    deepseek: "deepseekModel",
    openai: "openaiModel",
    qwen: "qwenModel",
    kimi: "kimiModel",
    siliconflow: "siliconflowModel",
    mistral: "mistralModel",
    doubao: "doubaoModel"
  };
  const DEFAULT_MODELS = {
    gemini: "gemini-3.7-flash",
    deepseek: "deepseek-v4-flash",
    openai: "gpt-5.6-luna",
    qwen: "qwen-plus",
    kimi: "kimi-k2.6",
    siliconflow: "Qwen/Qwen3-8B",
    mistral: "mistral-small-latest",
    doubao: "doubao-seed-2-1-pro-260628"
  };

  function normalizeLanguage(code) {
    const value = String(code || "").trim().toLowerCase().replace(/_/g, "-");
    if (!value) return "";
    if (value === "zh-hans" || value === "zh-cn" || value === "cmn-hans") return "zh-CN";
    if (value === "zh-hant" || value === "zh-tw" || value === "cmn-hant") return "zh-TW";
    if (value.startsWith("yue")) return "yue";
    return value.split("-")[0];
  }

  function sameLanguage(a, b) {
    const left = normalizeLanguage(a);
    const right = normalizeLanguage(b);
    if (!left || !right) return false;
    if (left === right) return true;
    return left.toLowerCase() === right.toLowerCase();
  }

  function isSupportedBilibiliUrl(input) {
    try {
      const url = new URL(String(input || ""));
      const host = url.hostname.toLowerCase();
      if (!(host === "bilibili.com" || host.endsWith(".bilibili.com"))) return false;
      return /^\/video\/[^/]+/i.test(url.pathname) || /^\/bangumi\/play\/[^/]+/i.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  function chooseBilibiliSubtitleSource({
    embeddedText,
    embeddedLanguage,
    asrText,
    asrLanguage,
    targetLanguage
  } = {}) {
    const embedded = String(embeddedText || "").trim();
    const speech = String(asrText || "").trim();
    const embeddedCode = normalizeLanguage(embeddedLanguage);
    const targetCode = normalizeLanguage(targetLanguage);
    const isSameTarget = embeddedCode && targetCode && (
      sameLanguage(embeddedCode, targetCode) ||
      (embeddedCode.startsWith("zh") && targetCode.startsWith("zh"))
    );
    if (embedded && speech && isSameTarget) {
      return {
        original: speech,
        translation: embedded,
        sourceLanguage: normalizeLanguage(asrLanguage) || detectScriptLanguage(speech) || "auto",
        usesExistingTranslation: true
      };
    }
    return {
      original: embedded || speech,
      translation: "",
      sourceLanguage: embedded
        ? (embeddedCode || detectScriptLanguage(embedded) || "auto")
        : (normalizeLanguage(asrLanguage) || detectScriptLanguage(speech) || "auto"),
      usesExistingTranslation: false
    };
  }

  function chooseCaptionTrack(tracks, requestedLanguage, audioLanguage, activeTrack) {
    const list = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
    if (!list.length) return null;

    if (requestedLanguage && requestedLanguage !== "auto") {
      return list.find(track => sameLanguage(track.languageCode, requestedLanguage)) || null;
    }

    const originalTrack = list.find(track => track.isOriginal);
    if (originalTrack) return originalTrack;

    if (audioLanguage) {
      const audioMatch = list.find(track => sameLanguage(track.languageCode, audioLanguage));
      if (audioMatch) return audioMatch;
    }

    const asrTracks = list.filter(track => track.kind === "asr" || /^a\./.test(String(track.vssId || "")));
    if (audioLanguage) {
      const audioAsr = asrTracks.find(track => sameLanguage(track.languageCode, audioLanguage));
      if (audioAsr) return audioAsr;
    }
    if (asrTracks.length === 1) return asrTracks[0];

    const defaultTrack = list.find(track => track.isDefault);
    if (defaultTrack) return defaultTrack;

    if (activeTrack) {
      const active = list.find(track =>
        (activeTrack.vssId && track.vssId === activeTrack.vssId) ||
        sameLanguage(track.languageCode, activeTrack.languageCode)
      );
      if (active) return active;
    }

    if (list.length === 1) return list[0];
    return null;
  }

  function detectScriptLanguage(text) {
    const value = String(text || "");
    if (!value.trim()) return "";
    if (/[\u3040-\u30ff]/u.test(value)) return "ja";
    if (/[\uac00-\ud7af]/u.test(value)) return "ko";
    if (/[\u0400-\u04ff]/u.test(value)) return "ru";
    if (/[\u0e00-\u0e7f]/u.test(value)) return "th";
    if (/[\u1780-\u17ff]/u.test(value)) return "km";
    if (/[\u0600-\u06ff]/u.test(value)) return "ar";
    if (/[\u4e00-\u9fff]/u.test(value)) return "zh";
    return "";
  }

  function resolveSourceLanguage(text, metadataLanguage, requestedLanguage, audioLanguage, options = {}) {
    const script = detectScriptLanguage(text);
    const meta = normalizeLanguage(metadataLanguage);
    const requested = normalizeLanguage(requestedLanguage);
    const audio = normalizeLanguage(audioLanguage);
    const trustMetadata = options.trustMetadata !== false;
    const allowRequestedHint = options.allowRequestedHint === true;

    if (script === "ko" || script === "ja") return script;
    if (trustMetadata && meta) return meta;
    if (script && script !== "zh") return script;
    if (allowRequestedHint && requested && requested !== "auto") return requested;
    if (meta) return meta;
    if (script) return script;
    return audio || "auto";
  }

  function classifyProviderFailure(status, message) {
    const code = Number(status || 0);
    const text = String(message || "").toLowerCase();
    if (
      code === 402 ||
      /insufficient[ _-]*(balance|credit)|payment required|billing.+(failed|required)|balance.+insufficient|余额不足|额度不足/.test(text)
    ) return "billing";
    if (code === 429 || /quota|rate.?limit|resource_exhausted|too many requests/.test(text)) return "quota";
    if (/location is not supported|unsupported.+region|region.+not supported/.test(text)) return "region";
    if (/service.?not.?open|model service.+unavailable|permission denied|forbidden|insufficient permissions|no permission/.test(text)) return "permission";
    if (code === 401 || /invalid.+api.?key|incorrect.+api.?key|unauthorized|invalid token/.test(text)) return "auth";
    if (code === 403) return "permission";
    if (code === 408 || code >= 500) return "server";
    if (!code && /network|failed to fetch|load failed|timeout/.test(text)) return "network";
    return "request";
  }

  function shouldFailover(kind) {
    return ["billing", "quota", "region", "server", "network", "auth", "permission", "request"].includes(kind);
  }

  function clamp(value, min, max) {
    if (max < min) return min;
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function placeFloatingPanel(viewport, launcherRect, panelRect, gap = 10, margin = 8) {
    const width = Math.max(0, Number(viewport?.width) || 0);
    const height = Math.max(0, Number(viewport?.height) || 0);
    const launcherWidth = Math.max(0, Number(launcherRect?.width) || 36);
    const launcherHeight = Math.max(0, Number(launcherRect?.height) || 36);
    const panelWidth = Math.max(0, Number(panelRect?.width) || 276);
    const panelHeight = Math.max(0, Number(panelRect?.height) || 0);
    const launcher = {
      left: clamp(launcherRect?.left, margin, width - launcherWidth - margin),
      top: clamp(launcherRect?.top, margin, height - launcherHeight - margin)
    };

    const panelLeft = clamp(
      launcher.left + launcherWidth - panelWidth,
      margin,
      width - panelWidth - margin
    );
    const below = launcher.top + launcherHeight + gap;
    const above = launcher.top - panelHeight - gap;
    let panelTop = below;
    if (below + panelHeight > height - margin && above >= margin) panelTop = above;
    panelTop = clamp(panelTop, margin, height - panelHeight - margin);

    return {
      launcher,
      panel: { left: panelLeft, top: panelTop }
    };
  }

  function providerErrorDetail(provider, status, body) {
    const name = PROVIDER_NAMES[provider] || provider;
    let message = "";
    let code = "";
    try {
      const parsed = JSON.parse(String(body || ""));
      message = String(parsed?.error?.message || parsed?.message || "");
      code = String(parsed?.error?.code || parsed?.error?.status || parsed?.code || "");
    } catch (_) {
      message = String(body || "");
    }
    const clean = `${code}${code && message ? ": " : ""}${message}`
      .replace(/(?:sk|AIza|AQ\.)[-_.a-z0-9]{8,}/gi, "[已隐藏密钥]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    return `${name}${status ? ` ${status}` : ""}${clean ? `：${clean}` : "：请求失败"}`;
  }

  function providerKey(cfg, provider) {
    const field = KEY_FIELDS[provider];
    const dedicated = field ? String(cfg?.[field] || "").trim() : "";
    if (dedicated) return dedicated;
    if (cfg?.provider === provider) return String(cfg?.apiKey || "").trim();
    return "";
  }

  function providerSequence(cfg) {
    const primary = PROVIDERS.includes(cfg?.provider) ? cfg.provider : "gemini";
    if (!cfg?.autoFailover) return [primary];
    return [primary, ...PROVIDERS.filter(item => item !== primary)];
  }

  function providerOrder(cfg) {
    return providerSequence(cfg).filter(provider => providerKey(cfg, provider));
  }

  function providerModel(cfg, provider) {
    const field = MODEL_FIELDS[provider];
    const dedicated = field ? String(cfg?.[field] || "").trim() : "";
    if (dedicated) return dedicated;
    if (cfg?.provider === provider && cfg?.model) return String(cfg.model).trim();
    return DEFAULT_MODELS[provider] || "";
  }

  function friendlyFailureMessage(provider, kind) {
    const name = PROVIDER_NAMES[provider] || provider;
    if (kind === "region") return `${name} 当前网络地区不可用`;
    if (kind === "billing") return `${name} 余额或可用额度不足`;
    if (kind === "quota") return `${name} 额度已用完或正在限流`;
    if (kind === "server") return `${name} 服务暂时不可用`;
    if (kind === "network") return `${name} 网络连接失败`;
    if (kind === "auth") return `${name} API Key 无效`;
    if (kind === "permission") return `${name} 当前账号或模型权限不足`;
    return `${name} 请求失败`;
  }

  return {
    PROVIDERS,
    PROVIDER_NAMES,
    KEY_FIELDS,
    MODEL_FIELDS,
    DEFAULT_MODELS,
    normalizeLanguage,
    sameLanguage,
    chooseCaptionTrack,
    detectScriptLanguage,
    resolveSourceLanguage,
    classifyProviderFailure,
    shouldFailover,
    providerKey,
    providerSequence,
    providerOrder,
    providerModel,
    friendlyFailureMessage,
    placeFloatingPanel,
    providerErrorDetail,
    isSupportedBilibiliUrl,
    chooseBilibiliSubtitleSource
  };
});
