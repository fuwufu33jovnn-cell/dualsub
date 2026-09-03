(() => {
  if (window.__DUALSUB_PAGE_BRIDGE__) return;
  window.__DUALSUB_PAGE_BRIDGE__ = true;

  function player() {
    return document.getElementById("movie_player");
  }

  function safeCall(fn, fallback = null) {
    try {
      return fn() ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readableName(value) {
    if (typeof value === "string") return value;
    return value?.simpleText || value?.runs?.map(item => item.text || "").join("") || "";
  }

  function rawTracks(instance) {
    const optionTracks = safeCall(() => instance.getOption("captions", "tracklist"), []);
    if (Array.isArray(optionTracks) && optionTracks.length) return optionTracks;
    const responseTracks = safeCall(
      () => instance.getPlayerResponse().captions.playerCaptionsTracklistRenderer.captionTracks,
      []
    );
    return Array.isArray(responseTracks) ? responseTracks : [];
  }

  function normalizeTrack(track) {
    if (!track) return null;
    return {
      languageCode: track.languageCode || track.langCode || "",
      name: readableName(track.name || track.displayName),
      kind: track.kind || "",
      vssId: track.vssId || track.id || "",
      isDefault: !!(track.isDefault || track.defaultTrack),
      isOriginal: !!track.isOriginal
    };
  }

  function audioLanguage(instance) {
    const candidates = [
      safeCall(() => instance.getOption("audioTrack", "track")),
      safeCall(() => instance.getAudioTrack()),
      safeCall(() => instance.getPlayerResponse().audioConfig.audioTrack)
    ].filter(Boolean);
    for (const track of candidates) {
      const code = track.languageCode || track.langCode || track.audioTrackId?.split(".")?.[0];
      if (code) return code;
    }
    return "";
  }

  function publish(extra = {}) {
    const instance = player();
    if (!instance) return;
    const tracks = rawTracks(instance);
    const active = safeCall(() => instance.getOption("captions", "track"));
    window.postMessage({
      source: "dualsub-page",
      type: "DUALSUB_YT_STATE",
      tracks: tracks.map(normalizeTrack).filter(Boolean),
      activeTrack: normalizeTrack(active),
      audioLanguage: audioLanguage(instance),
      ...extra
    }, "*");
  }

  function setTrack(request) {
    const instance = player();
    if (!instance) return publish({ setError: "PLAYER_UNAVAILABLE" });
    const tracks = rawTracks(instance);
    const target = tracks.find(track =>
      (request.vssId && (track.vssId || track.id) === request.vssId) ||
      (!request.vssId && (track.languageCode || track.langCode) === request.languageCode)
    );
    if (!target) return publish({ unavailableLanguage: request.languageCode || "" });
    const changed = safeCall(() => {
      instance.setOption("captions", "track", target);
      return true;
    }, false);
    setTimeout(() => publish(changed ? {} : { setError: "SET_TRACK_FAILED" }), 120);
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.source !== "dualsub-content") return;
    if (event.data.type === "DUALSUB_YT_GET_STATE") publish();
    if (event.data.type === "DUALSUB_YT_SET_TRACK") setTrack(event.data.track || {});
  });

  setInterval(publish, 900);
  publish();
})();
