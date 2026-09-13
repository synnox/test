/* ============ lecteur video custom ============ */
(function () {
  const wrap = document.getElementById("playerWrap");
  const shell = document.getElementById("playerShell");
  const video = document.getElementById("player");
  if (!video || !shell) return;

  const cue = document.getElementById("playerCue");
  const cuePlay = document.getElementById("cuePlay");
  const cueSpin = document.getElementById("cueSpin");
  const cueMsg = document.getElementById("cueMsg");
  const controls = document.getElementById("pControls");
  const seek = document.getElementById("pSeek");
  const cur = document.getElementById("pCur");
  const dur = document.getElementById("pDur");
  const btnPlay = document.getElementById("pPlay");
  const btnBack = document.getElementById("pBack");
  const btnFwd = document.getElementById("pFwd");
  const btnMute = document.getElementById("pMute");
  const vol = document.getElementById("pVol");
  const rate = document.getElementById("pRate");
  const btnFull = document.getElementById("pFull");

  let hideTimer = null;
  let seeking = false;
  let lastVol = 1;

  const icoPlay = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const icoPause = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  const icoVolOn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>';
  const icoVolOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/></svg>';

  function fmt(s) {
    if (!isFinite(s)) s = 0;
    s = Math.max(0, Math.floor(s));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function iconPlayPause() { btnPlay.innerHTML = video.paused ? icoPlay : icoPause; }
  function iconVol() { btnMute.innerHTML = video.muted || video.volume === 0 ? icoVolOff : icoVolOn; }
  function setMsg(t) {
    cueMsg.textContent = t || "";
    cueMsg.classList.toggle("show", !!t);
  }
  function showCue() { cue.classList.add("show"); }
  function hideCue() { cue.classList.remove("show"); }
  function showControls() {
    controls.classList.add("show");
    resetHide();
  }
  function resetHide() {
    clearTimeout(hideTimer);
    if (!video.paused) hideTimer = setTimeout(() => controls.classList.remove("show"), 2600);
  }

  function toggle() {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  /* --- evenements video --- */
  video.addEventListener("loadedmetadata", () => { dur.textContent = fmt(video.duration); });
  video.addEventListener("timeupdate", () => {
    if (seeking) return;
    cur.textContent = fmt(video.currentTime);
    if (video.duration) seek.value = (video.currentTime / video.duration) * 1000;
  });
  video.addEventListener("play", () => { iconPlayPause(); hideCue(); showControls(); });
  video.addEventListener("pause", () => { iconPlayPause(); showCue(); showControls(); });
  video.addEventListener("ended", () => setMsg("Fin de la lecture"));
  video.addEventListener("waiting", () => { cueSpin.style.display = ""; });
  video.addEventListener("playing", () => { cueSpin.style.display = "none"; hideCue(); setMsg(""); });
  video.addEventListener("canplay", () => { cueSpin.style.display = "none"; });
  video.addEventListener("error", () => {
    cueSpin.style.display = "none";
    setMsg("Lecture impossible : source expirée, absente ou bloquée");
    showCue();
  });

  /* --- boutons --- */
  btnPlay.addEventListener("click", toggle);
  cuePlay.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
  shell.addEventListener("click", (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select")) return;
    toggle();
  });
  btnBack.addEventListener("click", () => { video.currentTime = Math.max(0, video.currentTime - 10); });
  btnFwd.addEventListener("click", () => { video.currentTime = Math.min(video.duration || 1e9, video.currentTime + 10); });

  /* --- barre --- */
  seek.addEventListener("input", () => {
    seeking = true;
    if (video.duration) cur.textContent = fmt((seek.value / 1000) * video.duration);
  });
  seek.addEventListener("change", () => {
    if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
    seeking = false;
  });

  /* --- volume --- */
  vol.addEventListener("input", () => {
    video.muted = false;
    video.volume = vol.value / 100;
    lastVol = video.volume || 0.5;
    iconVol();
    showControls();
  });
  btnMute.addEventListener("click", () => {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      video.volume = lastVol;
      vol.value = lastVol * 100;
    } else {
      lastVol = video.volume;
      video.muted = true;
      vol.value = 0;
    }
    iconVol();
  });

  /* --- vitesse --- */
  rate.addEventListener("change", () => { video.playbackRate = parseFloat(rate.value); });

  /* --- plein ecran --- */
  btnFull.addEventListener("click", () => {
    if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (shell.requestFullscreen) {
      shell.requestFullscreen();
    } else if (shell.webkitRequestFullscreen) {
      shell.webkitRequestFullscreen();
    }
  });

  /* --- auto masquage --- */
  shell.addEventListener("mousemove", resetHide, { passive: true });
  shell.addEventListener("touchstart", resetHide, { passive: true });
  shell.addEventListener("mouseleave", () => controls.classList.remove("show"));

  /* --- raccourcis clavier --- */
  document.addEventListener("keydown", (e) => {
    if (wrap.style.display === "none") return;
    const tag = document.activeElement ? document.activeElement.tagName : "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    switch (e.code) {
      case "Space": e.preventDefault(); toggle(); break;
      case "ArrowLeft": e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break;
      case "ArrowRight": e.preventDefault(); video.currentTime = Math.min(video.duration || 1e9, video.currentTime + 10); break;
      case "KeyM": video.muted = !video.muted; iconVol(); break;
      case "KeyF": btnFull.click(); break;
    }
  });
})();