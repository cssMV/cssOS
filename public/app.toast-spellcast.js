let toastHideTimer = 0;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    toastHideTimer = 0;
  }, 4800);
}

function applyRandomLyricSpellcastPalette() {
  const spellcastPanels = [logoPanel, settingsPanel].filter(Boolean);
  if (!spellcastPanels.length) return;
  const hue = Math.floor(Math.random() * 360);
  const accentHue = (hue + 36 + Math.floor(Math.random() * 88)) % 360;
  const glowHue = (hue + 180 + Math.floor(Math.random() * 72)) % 360;
  spellcastPanels.forEach((panel) => {
    panel.style.setProperty("--lyric-spellcast-primary", `hsla(${hue}, 100%, 64%, 0.72)`);
    panel.style.setProperty("--lyric-spellcast-secondary", `hsla(${accentHue}, 100%, 58%, 0.42)`);
    panel.style.setProperty("--lyric-spellcast-glow", `hsla(${glowHue}, 100%, 72%, 0.34)`);
    panel.style.setProperty("--lyric-spellcast-text", `hsla(${hue}, 100%, 74%, 0.44)`);
  });
}

function enterLyricSpellcast() {
  lyricSpellcastDepth += 1;
  if (!logoPanel || lyricSpellcastDepth !== 1) return;
  clearInterval(lyricSpellcastColorTimer);
  applyRandomLyricSpellcastPalette();
  lyricSpellcastColorTimer = window.setInterval(applyRandomLyricSpellcastPalette, 220);
  logoPanel.classList.add("lyric-spellcast");
  applyMirrorAnimationMode(getStoredMirrorAnimationMode());
}

function exitLyricSpellcast(force = false) {
  lyricSpellcastDepth = force ? 0 : Math.max(0, lyricSpellcastDepth - 1);
  if (!logoPanel || lyricSpellcastDepth > 0) return;
  clearInterval(lyricSpellcastColorTimer);
  lyricSpellcastColorTimer = null;
  logoPanel.classList.remove("lyric-spellcast");
  MIRROR_SPELLCAST_CLASSNAMES.forEach((className) => logoPanel.classList.remove(className));
  logoPanel.dataset.mirrorAnimationResolved = "";
  [logoPanel].filter(Boolean).forEach((panel) => {
    panel.style.removeProperty("--lyric-spellcast-primary");
    panel.style.removeProperty("--lyric-spellcast-secondary");
    panel.style.removeProperty("--lyric-spellcast-glow");
    panel.style.removeProperty("--lyric-spellcast-text");
  });
}
