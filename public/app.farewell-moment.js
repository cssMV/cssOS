// CSSOS_FAREWELL_MOMENT 20260711 — Jing
// "销毁账号也要有一段离别音乐。这是情感设计,要有。"
//
// A ~13-second cinematic farewell "MV" that takes over the viewport the
// moment a user confirms account deletion — BEFORE the guest reload.
//
// Why client-side (not a backend gift MV): the account-deletion flow
// destroys the server session and reloads to guest state, so a gift MV
// dropped in the personalization inbox would land somewhere the user can
// never reach again. The farewell must play in the moment. Like
// app.subscription-celebration.js it is built entirely with Canvas
// (drifting embers + light bloom), CSS animations (dusk gradient, hero
// card) and Web Audio (a warm, wistful-but-hopeful cadence). No mp4/mp3
// asset dependency — fires instantly even on a slow link, zero engine
// cost, fully deterministic.
//
// Tone is the emotional mirror of the celebration: the celebration is a
// C-major sunrise ("your dream came true"); the farewell is a warm dusk
// ("until we meet again"). It is a soft goodbye, not a dirge — the door
// stays open for 7 days and the music the user made stays theirs.
//
// present(opts) returns a Promise that resolves when the farewell ends.
// FORCED playback (Jing, Apple-compliance): the farewell is NOT skippable
// — no Esc, no click-to-dismiss. It plays fully (~13s) and the ONLY
// resolver is the auto-finish timer, so the promise always settles and
// the delete flow can never hang. The delete flow awaits this, then
// commits the account deletion. Personalization (name) follows the UI
// locale — the 文明智能联动 "normal path" (login/welcome-class moment),
// NOT the person-MV path.

(function initFarewellMomentModule() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (globalThis.__cssosFarewellMomentLoaded) return;
  globalThis.__cssosFarewellMomentLoaded = true;

  const STYLE_ID = "cssos-farewell-moment-style";
  const ROOT_ID = "cssos-farewell-moment-root";
  const DURATION_MS = 13000;
  const FADE_OUT_MS = 900;

  // Local i18n router — mirrors app.subscription-celebration.js. Language
  // follows the active UI locale (normal path); never hardcode literals.
  function loginCopy(en, zh) {
    try {
      const lang = (globalThis.cssosLanguageState
        ? globalThis.cssosLanguageState()?.activeLanguage
        : "") || "";
      if (String(lang).toLowerCase().startsWith("zh")) return zh || en;
    } catch (_e) {}
    return en;
  }

  function resolveDisplayName(explicit) {
    const clean = (s) => String(s || "").trim();
    if (clean(explicit)) return clean(explicit);
    try {
      const auth = globalThis.cssosAuthState
        ? globalThis.cssosAuthState()
        : globalThis.authState;
      const u = (auth && auth.user) || {};
      // Prefer a real name; fall back to the local-part of an email so we
      // never print a raw address in a big hero headline.
      if (clean(u.name)) return clean(u.name);
      if (clean(u.display_name)) return clean(u.display_name);
      const email = clean(u.email);
      if (email) return email.split("@")[0];
    } catch (_e) {}
    return "";
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${ROOT_ID} {
  position: fixed; inset: 0; z-index: 2147483646;
  pointer-events: auto; overflow: hidden;
  background: radial-gradient(ellipse at 50% 78%,
    rgba(255, 176, 122, 0.55) 0%,
    rgba(150, 84, 132, 0.75) 30%,
    rgba(42, 34, 92, 0.95) 66%,
    rgba(6, 6, 22, 1) 100%);
  background-size: 170% 170%;
  animation: cssos-fw-bg 13s ease-in-out forwards;
  opacity: 0;
  transition: opacity ${FADE_OUT_MS}ms ease-out;
}
#${ROOT_ID}.cssos-fw-show { opacity: 1; }
@keyframes cssos-fw-bg {
  0%   { background-position: 50% 40%; filter: brightness(1.02); }
  55%  { background-position: 50% 62%; filter: brightness(0.9) saturate(1.05); }
  100% { background-position: 50% 82%; filter: brightness(0.62) saturate(0.95); }
}
#${ROOT_ID} .fw-bloom {
  position: absolute; inset: -12%;
  background: radial-gradient(ellipse at 50% 70%,
    rgba(255,214,170,0.30) 0%,
    rgba(255,190,150,0.10) 22%,
    transparent 58%);
  mix-blend-mode: screen;
  animation: cssos-fw-breathe 4.4s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes cssos-fw-breathe {
  from { transform: scale(1.0); opacity: 0.45; }
  to   { transform: scale(1.06); opacity: 0.8; }
}
#${ROOT_ID} canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#${ROOT_ID} .fw-card {
  position: absolute; left: 50%; top: 46%;
  transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 20px;
  padding: 42px 54px 36px;
  border-radius: 26px;
  background: linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04));
  backdrop-filter: blur(26px) saturate(1.1);
  -webkit-backdrop-filter: blur(26px) saturate(1.1);
  box-shadow: 0 40px 120px rgba(6,6,22,0.55), 0 0 0 1px rgba(255,255,255,0.14) inset;
  text-align: center; color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", system-ui, sans-serif;
  max-width: min(700px, 90vw);
  animation: cssos-fw-card-in 1.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
  opacity: 0;
}
@keyframes cssos-fw-card-in {
  0%   { opacity: 0; transform: translate(-50%, -46%) scale(0.9); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
}
#${ROOT_ID} .fw-mark {
  width: 96px; height: 96px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 44px;
  background: radial-gradient(circle at 50% 40%, rgba(255,214,170,0.35), rgba(255,255,255,0.04));
  box-shadow: 0 0 48px rgba(255, 196, 150, 0.5);
  animation: cssos-fw-mark 4.4s ease-in-out infinite alternate;
}
@keyframes cssos-fw-mark {
  from { transform: translateY(0); opacity: 0.86; }
  to   { transform: translateY(-6px); opacity: 1; }
}
#${ROOT_ID} .fw-eyebrow {
  font-size: 12px; letter-spacing: 0.34em; text-transform: uppercase;
  opacity: 0.72; font-weight: 600;
}
#${ROOT_ID} .fw-headline {
  font-size: clamp(30px, 5.4vw, 56px);
  font-weight: 800; line-height: 1.08; letter-spacing: -0.02em;
  background: linear-gradient(135deg, #fff, #ffd9b0 62%, #ff9d7a);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  text-shadow: 0 4px 24px rgba(255, 140, 100, 0.4);
}
#${ROOT_ID} .fw-sub {
  font-size: 15px; font-weight: 500; opacity: 0.9;
  max-width: 92%; line-height: 1.5;
}
#${ROOT_ID} .fw-lyric {
  position: absolute; left: 50%; bottom: 18%;
  transform: translateX(-50%);
  font-size: clamp(19px, 2.8vw, 30px); font-weight: 600; color: #fff;
  opacity: 0; text-shadow: 0 2px 16px rgba(0,0,0,0.45);
  letter-spacing: 0.02em; pointer-events: none; text-align: center;
  width: 90vw; max-width: 820px;
  font-family: "Playfair Display", "Cormorant Garamond", "Georgia", serif;
  font-style: italic;
}
#${ROOT_ID} .fw-progress {
  position: absolute; left: 0; bottom: 0; right: 0; height: 3px;
  background: rgba(255,255,255,0.10);
}
#${ROOT_ID} .fw-progress > div {
  height: 100%; width: 0;
  background: linear-gradient(90deg, #ffd9b0, #ff9d7a, #96548f);
  animation: cssos-fw-progress 13s linear forwards;
}
@keyframes cssos-fw-progress { to { width: 100%; } }
#${ROOT_ID} .fw-dismiss-hint {
  position: absolute; right: 22px; top: 22px;
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(255,255,255,0.6);
  background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.16);
  padding: 8px 14px; border-radius: 999px;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}
@media (prefers-reduced-motion: reduce) {
  #${ROOT_ID} { animation: none; }
  #${ROOT_ID} .fw-bloom, #${ROOT_ID} .fw-mark { animation: none; }
}
`;
    document.head.appendChild(style);
  }

  function buildCanvas(root, name) {
    const canvas = document.createElement("canvas");
    canvas.dataset.role = name;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    canvas.__cssosResize = resize;
    root.appendChild(canvas);
    return canvas;
  }

  // Embers drift UPWARD and fade — the visual inverse of celebration
  // confetti (which falls). A gentle letting-go.
  function startEmbers(canvas, durationMs) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const W = () => canvas.clientWidth;
    const H = () => canvas.clientHeight;
    const embers = [];
    const spawn = () => ({
      x: Math.random() * W(),
      y: H() + Math.random() * 40,
      vy: -(0.3 + Math.random() * 0.9),
      vx: (Math.random() - 0.5) * 0.4,
      size: 1 + Math.random() * 2.6,
      hue: 26 + Math.random() * 22,
      life: 0.7 + Math.random() * 0.3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02,
    });
    for (let i = 0; i < 90; i += 1) {
      const e = spawn();
      e.y = Math.random() * H();
      embers.push(e);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "screen";
      const globalFade = elapsed < 800
        ? elapsed / 800
        : (elapsed > durationMs - 1200 ? Math.max(0, (durationMs - elapsed) / 1200) : 1);
      embers.forEach((e) => {
        e.wobble += e.wobbleSpeed;
        e.x += e.vx + Math.sin(e.wobble) * 0.3;
        e.y += e.vy;
        if (e.y < -20) {
          Object.assign(e, spawn());
        }
        const a = e.life * globalFade;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${e.hue}, 95%, 68%, ${a})`;
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
      if (elapsed < durationMs + 400) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }

  // Warm, wistful-but-hopeful cadence. A gentle descending phrase that
  // resolves upward at the end — "goodbye, but not the end". All Web
  // Audio, no assets.
  function playMusic() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return () => {};
      const ctx = new Ctx();
      try { if (ctx.state === "suspended" && ctx.resume) ctx.resume(); } catch (_e) {}
      const master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      const now = ctx.currentTime;
      // Melody: a descending A-minor-ish phrase that lifts on the last two
      // notes to a hopeful resolve. A4 G4 E4 D4 C4 · E4 A4.
      const motif = [440.00, 392.00, 329.63, 293.66, 261.63, 329.63, 440.00];
      const stepDur = 0.62;
      motif.forEach((freq, i) => {
        const t = now + 0.3 + i * stepDur;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i >= motif.length - 2 ? "triangle" : "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.85, t + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
        osc.connect(gain).connect(master);
        osc.start(t);
        osc.stop(t + 1.2);
        // Soft octave-up bell shimmer.
        const bell = ctx.createOscillator();
        const bg = ctx.createGain();
        bell.type = "sine";
        bell.frequency.value = freq * 2;
        bg.gain.setValueAtTime(0, t + 0.03);
        bg.gain.linearRampToValueAtTime(0.16, t + 0.09);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        bell.connect(bg).connect(master);
        bell.start(t + 0.03);
        bell.stop(t + 1.6);
      });
      // Warm sustained pad (A2-C3-E3) underneath, fading through the show.
      const padFreqs = [110.0, 130.81, 164.81];
      padFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + 0.2);
        gain.gain.linearRampToValueAtTime(0.05, now + 2.0);
        gain.gain.linearRampToValueAtTime(0.06, now + 8.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 12.5);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 700;
        osc.connect(filter).connect(gain).connect(master);
        osc.start(now + 0.2);
        osc.stop(now + 13);
      });
      return () => {
        try { master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4); } catch (_e) {}
        setTimeout(() => { try { ctx.close(); } catch (_e) {} }, 600);
      };
    } catch (_e) {
      return () => {};
    }
  }

  function rotateLyrics(root, lines, durationMs) {
    const el = document.createElement("div");
    el.className = "fw-lyric";
    root.appendChild(el);
    let idx = 0;
    let timer = null;
    const fadeIn = () => {
      el.textContent = lines[idx];
      el.style.transition = "opacity 0.7s ease-out, transform 0.7s ease-out";
      el.style.transform = "translateX(-50%) translateY(8px)";
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateX(-50%) translateY(0)";
      });
    };
    const fadeOut = (cb) => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(-8px)";
      setTimeout(cb, 650);
    };
    fadeIn();
    const stepMs = Math.floor(durationMs / lines.length);
    const step = () => {
      fadeOut(() => {
        idx = (idx + 1) % lines.length;
        if (idx === 0) return; // last line lingers, no loop
        fadeIn();
        timer = setTimeout(step, stepMs);
      });
    };
    timer = setTimeout(step, stepMs);
    return () => { if (timer) clearTimeout(timer); };
  }

  function present(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      if (document.getElementById(ROOT_ID)) { resolve(); return; }
      ensureStyles();

      const name = resolveDisplayName(opts.name);
      const headlineText = name
        ? loginCopy(`Until we meet again, ${name}.`, `后会有期，${name}。`)
        : loginCopy("Until we meet again.", "后会有期。");
      const eyebrow = loginCopy("A farewell from cssOS", "cssOS 的告别");
      const subText = loginCopy(
        "Your account is closing. The door stays open for 7 days — sign back in any time to undo this.",
        "你的账号正在关闭。7 天内随时可以重新登录撤销。",
      );
      const lyrics = [
        loginCopy(
          "Thank you for the songs we made together.",
          "谢谢你，谢谢我们一起创造的这些歌。",
        ),
        loginCopy(
          "Every note you wrote here was real.",
          "你在这里写下的每一个音符，都真实存在过。",
        ),
        loginCopy(
          "The music you made stays yours, always.",
          "你创造的音乐，永远属于你。",
        ),
        loginCopy(
          "Go gently. And if you ever miss it — the door is open.",
          "一路珍重。若哪天想念了 —— 门，一直开着。",
        ),
      ];

      const root = document.createElement("div");
      root.id = ROOT_ID;
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-label", eyebrow + " — " + headlineText);

      const bloom = document.createElement("div");
      bloom.className = "fw-bloom";
      root.appendChild(bloom);

      const emberCanvas = buildCanvas(root, "embers");

      const card = document.createElement("div");
      card.className = "fw-card";

      const mark = document.createElement("div");
      mark.className = "fw-mark";
      mark.textContent = "🕯️";
      card.appendChild(mark);

      const eyebrowEl = document.createElement("div");
      eyebrowEl.className = "fw-eyebrow";
      eyebrowEl.textContent = eyebrow;
      card.appendChild(eyebrowEl);

      const headline = document.createElement("div");
      headline.className = "fw-headline";
      headline.textContent = headlineText;
      card.appendChild(headline);

      const sub = document.createElement("div");
      sub.className = "fw-sub";
      sub.textContent = subText;
      card.appendChild(sub);

      root.appendChild(card);

      // Forced playback: a non-interactive caption, NOT a dismiss control.
      const dismissHint = document.createElement("div");
      dismissHint.className = "fw-dismiss-hint";
      dismissHint.textContent = loginCopy("A farewell that plays once", "只播放一次的告别");
      root.appendChild(dismissHint);

      const progress = document.createElement("div");
      progress.className = "fw-progress";
      progress.appendChild(document.createElement("div"));
      root.appendChild(progress);

      document.body.appendChild(root);
      requestAnimationFrame(() => { root.classList.add("cssos-fw-show"); });

      const stopEmbers = startEmbers(emberCanvas, DURATION_MS);
      const stopMusic = playMusic();
      const stopLyrics = rotateLyrics(root, lyrics, DURATION_MS);

      let finished = false;
      // Forced, non-skippable: the ONLY resolver is the auto-finish timer.
      // No Esc / click handlers are attached, so the farewell always plays
      // to completion. The timer guarantees the promise settles even if
      // audio/canvas fail, so the delete flow can never hang.
      const finish = () => {
        if (finished) return;
        finished = true;
        try { stopEmbers(); } catch (_e) {}
        try { stopMusic(); } catch (_e) {}
        try { stopLyrics(); } catch (_e) {}
        root.classList.remove("cssos-fw-show");
        setTimeout(() => { try { root.remove(); } catch (_e) {} }, FADE_OUT_MS + 100);
        try {
          if (emberCanvas.__cssosResize) {
            window.removeEventListener("resize", emberCanvas.__cssosResize);
          }
        } catch (_e) {}
        setTimeout(resolve, FADE_OUT_MS + 120);
      };
      setTimeout(finish, DURATION_MS);

      try {
        console.log(
          "%c🕯️ cssOS · " + eyebrow + (name ? " · " + name : ""),
          "color:#ff9d7a;font-weight:700;font-size:14px",
        );
      } catch (_e) {}
    });
  }

  globalThis.cssosFarewellMoment = {
    present,
    demo() {
      return present({ name: "Jing" });
    },
  };
})();
