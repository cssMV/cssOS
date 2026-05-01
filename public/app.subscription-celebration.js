// CSSOS_PHASE2_FIRST_SUB_CELEBRATION 20260501 #265 — Jing
// "弹出庆祝MV，一个制作精美的MV，而不只是一个简单的toast.
//  睡个好觉，做个好梦，醒来梦想就成真!"
//
// A 14-second cinematic celebration "MV" that takes over the viewport
// when the first paying subscriber lands. Built entirely with Canvas
// (confetti + sparkles), CSS animations (gradient backdrop, hero card),
// and Web Audio (six-note rising motif + bell shimmer). No mp4 / mp3
// asset dependencies — fires instantly the moment the watcher detects
// the event, even on a slow link.
//
// Composition (z-stacked):
//   Layer 0 — animated gradient backdrop (cinematic dawn → sunrise)
//   Layer 1 — radial light bloom (CSS, breathes)
//   Layer 2 — confetti canvas (240 physics-based ribbons)
//   Layer 3 — sparkle canvas (radial bursts on every chord change)
//   Layer 4 — hero card: avatar ring, headline, subscriber, plan, stats
//   Layer 5 — karaoke-style lyric line that fades through 4 verses
//   Layer 6 — bottom progress bar so the user knows it'll end
//
// Audio: a C-major rising arc (C4 E4 G4 C5 E5 G5) layered with a soft
// bell at +0.4s octaves, all gated through a master gain so reload
// noise is softer than the intro.
//
// Dismissal: Escape, click backdrop, or auto-fade after 14s. Ignores
// the production console silencer — celebration banner is allowed.

(function initFirstSubCelebrationModule() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (globalThis.__cssosFirstSubCelebrationLoaded) return;
  globalThis.__cssosFirstSubCelebrationLoaded = true;

  const STYLE_ID = "cssos-first-sub-celebration-style";
  const ROOT_ID = "cssos-first-sub-celebration-root";
  const DURATION_MS = 14000;
  const FADE_OUT_MS = 800;

  function loginCopy(en, zh) {
    try {
      const lang = (globalThis.cssosLanguageState
        ? globalThis.cssosLanguageState()?.activeLanguage
        : "") || "";
      if (String(lang).toLowerCase().startsWith("zh")) return zh || en;
    } catch (_e) {}
    return en;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${ROOT_ID} {
  position: fixed; inset: 0; z-index: 2147483646;
  pointer-events: auto;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 35%,
    rgba(255, 196, 145, 0.95) 0%,
    rgba(255, 122, 89, 0.92) 28%,
    rgba(74, 22, 84, 0.96) 70%,
    rgba(8, 4, 28, 1) 100%);
  background-size: 180% 180%;
  animation: cssos-cele-bg 14s ease-in-out forwards;
  opacity: 0;
  transition: opacity ${FADE_OUT_MS}ms ease-out;
}
#${ROOT_ID}.cssos-cele-show { opacity: 1; }
@keyframes cssos-cele-bg {
  0%   { background-position: 50% 100%; filter: brightness(0.6); }
  18%  { background-position: 50% 50%;  filter: brightness(1.05); }
  60%  { background-position: 50% 30%;  filter: brightness(1.15) saturate(1.1); }
  100% { background-position: 50% 60%;  filter: brightness(0.9); }
}
#${ROOT_ID} .cele-bloom {
  position: absolute; inset: -10%;
  background: radial-gradient(ellipse at 50% 45%,
    rgba(255,255,255,0.35) 0%,
    rgba(255,255,255,0.12) 18%,
    transparent 55%);
  mix-blend-mode: screen;
  animation: cssos-cele-breathe 3.2s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes cssos-cele-breathe {
  from { transform: scale(1.0); opacity: 0.55; }
  to   { transform: scale(1.08); opacity: 0.95; }
}
#${ROOT_ID} canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#${ROOT_ID} .cele-card {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%) scale(0.86);
  display: flex; flex-direction: column; align-items: center; gap: 22px;
  padding: 44px 56px 38px;
  border-radius: 28px;
  background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06));
  backdrop-filter: blur(28px) saturate(1.2);
  -webkit-backdrop-filter: blur(28px) saturate(1.2);
  box-shadow: 0 40px 120px rgba(8,4,28,0.55), 0 0 0 1px rgba(255,255,255,0.18) inset;
  text-align: center;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", system-ui, sans-serif;
  max-width: min(680px, 88vw);
  animation: cssos-cele-card-in 1.4s cubic-bezier(0.16, 1.05, 0.32, 1) 0.25s forwards;
  opacity: 0;
}
@keyframes cssos-cele-card-in {
  0%   { opacity: 0; transform: translate(-50%, -42%) scale(0.78); }
  60%  { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
}
#${ROOT_ID} .cele-avatar-ring {
  width: 132px; height: 132px;
  border-radius: 50%;
  padding: 6px;
  background: conic-gradient(from 0deg,
    #ffd28d, #ff7a59, #ff4488, #aa4cf0, #4cc4ff, #ffd28d);
  box-shadow: 0 0 60px rgba(255, 200, 140, 0.65);
  animation: cssos-cele-ring-spin 7s linear infinite;
  display: flex; align-items: center; justify-content: center;
}
@keyframes cssos-cele-ring-spin { to { transform: rotate(360deg); } }
#${ROOT_ID} .cele-avatar-ring > * {
  width: 120px; height: 120px; border-radius: 50%;
  background: #1a0d2e center/cover no-repeat;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 56px; font-weight: 700;
  animation: cssos-cele-ring-counter 7s linear infinite;
}
@keyframes cssos-cele-ring-counter { to { transform: rotate(-360deg); } }
#${ROOT_ID} .cele-eyebrow {
  font-size: 13px; letter-spacing: 0.32em;
  text-transform: uppercase; opacity: 0.78;
  font-weight: 600;
}
#${ROOT_ID} .cele-headline {
  font-size: clamp(34px, 6vw, 64px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #fff, #ffd28d 60%, #ff7a59);
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
  text-shadow: 0 4px 24px rgba(255, 122, 89, 0.5);
}
#${ROOT_ID} .cele-customer {
  font-size: 18px;
  font-weight: 500;
  opacity: 0.92;
  word-break: break-all;
  max-width: 88%;
}
#${ROOT_ID} .cele-stats {
  display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
  font-size: 14px;
}
#${ROOT_ID} .cele-stats > span {
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.22);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
#${ROOT_ID} .cele-lyric {
  position: absolute;
  left: 50%; bottom: 18%;
  transform: translateX(-50%);
  font-size: clamp(20px, 3vw, 32px);
  font-weight: 600;
  color: #fff;
  opacity: 0;
  text-shadow: 0 2px 16px rgba(0,0,0,0.45);
  letter-spacing: 0.02em;
  pointer-events: none;
  text-align: center;
  width: 90vw; max-width: 800px;
  font-family: "Playfair Display", "Cormorant Garamond", "Georgia", serif;
  font-style: italic;
}
#${ROOT_ID} .cele-progress {
  position: absolute; left: 0; bottom: 0; right: 0; height: 3px;
  background: rgba(255,255,255,0.12);
}
#${ROOT_ID} .cele-progress > div {
  height: 100%;
  background: linear-gradient(90deg, #ffd28d, #ff7a59, #aa4cf0);
  width: 0;
  animation: cssos-cele-progress 14s linear forwards;
}
@keyframes cssos-cele-progress { to { width: 100%; } }
#${ROOT_ID} .cele-dismiss-hint {
  position: absolute; right: 22px; top: 22px;
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.18);
  padding: 8px 14px; border-radius: 999px;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}
@media (prefers-reduced-motion: reduce) {
  #${ROOT_ID} { animation: none; }
  #${ROOT_ID} .cele-avatar-ring { animation: none; }
  #${ROOT_ID} .cele-bloom { animation: none; }
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

  function startConfetti(canvas, durationMs) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const colors = ["#ffd28d", "#ff7a59", "#ff4488", "#aa4cf0", "#4cc4ff", "#ffffff", "#ffe066"];
    const ribbons = [];
    const W = () => canvas.clientWidth;
    const H = () => canvas.clientHeight;
    for (let i = 0; i < 240; i += 1) {
      ribbons.push({
        x: Math.random() * W(),
        y: -Math.random() * H() * 0.5,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1.2 + Math.random() * 2.2,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.18,
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 14,
        color: colors[Math.floor(Math.random() * colors.length)],
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.04 + Math.random() * 0.04,
      });
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W(), H());
      const w = W(), h = H();
      ribbons.forEach((r) => {
        r.wobble += r.wobbleSpeed;
        r.x += r.vx + Math.sin(r.wobble) * 0.6;
        r.y += r.vy;
        r.rot += r.vr;
        if (r.y > h + 30) {
          r.y = -20;
          r.x = Math.random() * w;
        }
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rot);
        ctx.fillStyle = r.color;
        ctx.globalAlpha = elapsed < 600 ? elapsed / 600 : (elapsed > durationMs - 800 ? Math.max(0, (durationMs - elapsed) / 800) : 1);
        ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
        ctx.restore();
      });
      if (elapsed < durationMs + 200) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }

  function startSparkles(canvas, durationMs) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    const particles = [];
    const W = () => canvas.clientWidth;
    const H = () => canvas.clientHeight;
    const burst = (x, y, count) => {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.012 + Math.random() * 0.015,
          size: 1 + Math.random() * 2.4,
          hue: 30 + Math.random() * 35,
        });
      }
    };
    // Schedule rhythmic bursts across the duration.
    const burstTimes = [
      { t: 200,  count: 80,  pos: [0.5, 0.5] },
      { t: 1100, count: 60,  pos: [0.32, 0.42] },
      { t: 1900, count: 60,  pos: [0.68, 0.42] },
      { t: 3200, count: 90,  pos: [0.5, 0.36] },
      { t: 4800, count: 70,  pos: [0.4, 0.55] },
      { t: 6200, count: 70,  pos: [0.6, 0.55] },
      { t: 7800, count: 100, pos: [0.5, 0.45] },
      { t: 9600, count: 80,  pos: [0.5, 0.5] },
      { t: 11800, count: 120, pos: [0.5, 0.45] },
    ];
    let burstIdx = 0;
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      while (burstIdx < burstTimes.length && elapsed >= burstTimes[burstIdx].t) {
        const b = burstTimes[burstIdx];
        burst(b.pos[0] * W(), b.pos[1] * H(), b.count);
        burstIdx += 1;
      }
      ctx.clearRect(0, 0, W(), H());
      ctx.globalCompositeOperation = "screen";
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.life})`;
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      if (elapsed < durationMs + 1000) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }

  function playMusic() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return () => {};
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
      const now = ctx.currentTime;
      // Rising C-major arpeggio: C4 E4 G4 C5 E5 G5, each ~0.45s apart
      const motif = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
      motif.forEach((freq, i) => {
        const t = now + i * 0.42;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i < 3 ? "sine" : "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.9, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
        osc.connect(gain).connect(master);
        osc.start(t);
        osc.stop(t + 1.0);
        // Bell shimmer: octave up, softer, slight delay
        const bell = ctx.createOscillator();
        const bellGain = ctx.createGain();
        bell.type = "sine";
        bell.frequency.value = freq * 2;
        bellGain.gain.setValueAtTime(0, t + 0.04);
        bellGain.gain.linearRampToValueAtTime(0.25, t + 0.08);
        bellGain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        bell.connect(bellGain).connect(master);
        bell.start(t + 0.04);
        bell.stop(t + 1.7);
      });
      // Sustained pad chord (C-E-G) underneath at +0.2s, fades through whole show
      const padFreqs = [130.81, 164.81, 196.00];
      padFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + 0.2);
        gain.gain.linearRampToValueAtTime(0.05, now + 1.5);
        gain.gain.linearRampToValueAtTime(0.07, now + 7);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 13.5);
        // Soft lowpass via biquad
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 800;
        osc.connect(filter).connect(gain).connect(master);
        osc.start(now + 0.2);
        osc.stop(now + 14);
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
    el.className = "cele-lyric";
    root.appendChild(el);
    let idx = 0;
    let timer = null;
    const fadeIn = () => {
      el.textContent = lines[idx];
      el.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
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
      setTimeout(cb, 600);
    };
    fadeIn();
    const stepMs = Math.floor(durationMs / lines.length);
    const step = () => {
      fadeOut(() => {
        idx = (idx + 1) % lines.length;
        if (idx === 0) return; // don't loop, last line lingers
        fadeIn();
        timer = setTimeout(step, stepMs);
      });
    };
    timer = setTimeout(step, stepMs);
    return () => { if (timer) clearTimeout(timer); };
  }

  function pickAvatar(authState) {
    try {
      const u = authState?.user || authState || {};
      return u.avatar_url || u.picture || u.owner_avatar_url || "";
    } catch (_e) { return ""; }
  }

  function fanciestFontFamily() {
    try {
      const allow = globalThis.WATCH_FANCY_FONT_ALLOWLIST;
      if (Array.isArray(allow) && allow.length) {
        const pick = allow[Math.floor(Math.random() * allow.length)];
        return `"${pick}", "Playfair Display", Georgia, serif`;
      }
    } catch (_e) {}
    return `"Playfair Display", "Cormorant Garamond", Georgia, serif`;
  }

  function present(event) {
    if (!event) event = {};
    if (document.getElementById(ROOT_ID)) return; // already showing
    ensureStyles();

    const customerEmail = String(event.customer_email || "").trim()
      || loginCopy("(email pending)", "(邮箱待补)");
    const amountCents = Number(event.amount_cents || 0);
    const currency = String(event.currency || "usd").toUpperCase();
    const planId = String(event.plan_id || "").trim();
    const amountLabel = amountCents
      ? `${currency} ${(amountCents / 100).toFixed(2)}`
      : "";
    const eventLabel = event.event_type === "customer.subscription.created"
      ? loginCopy("New subscription", "新订阅")
      : event.event_type === "invoice.paid"
        ? loginCopy("Invoice paid", "账单已支付")
        : event.event_type === "checkout.session.completed"
          ? loginCopy("Checkout completed", "结账完成")
          : loginCopy("Subscription event", "订阅事件");

    const headlineText = loginCopy(
      "🎉  Your dream just came true.",
      "🎉  你的梦想刚刚成真了。",
    );
    const eyebrow = loginCopy("First Subscriber · cssOS", "第一位订阅用户 · cssOS");
    const lyrics = [
      loginCopy(
        "From an empty playlist to a paying listener…",
        "从空空的播放列表，到一位真正付费的听众……",
      ),
      loginCopy(
        "Someone, somewhere, just believed in this.",
        "在世界的某个角落，有人相信了这件事。",
      ),
      loginCopy(
        `Welcome, ${customerEmail}.`,
        `欢迎你，${customerEmail}。`,
      ),
      loginCopy(
        "The first one is the hardest. The next one is on its way.",
        "第一位永远最难。下一位已经在路上了。",
      ),
    ];

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", eyebrow + " — " + headlineText);

    const bloom = document.createElement("div");
    bloom.className = "cele-bloom";
    root.appendChild(bloom);

    const confettiCanvas = buildCanvas(root, "confetti");
    const sparkleCanvas = buildCanvas(root, "sparkle");

    const card = document.createElement("div");
    card.className = "cele-card";

    const ring = document.createElement("div");
    ring.className = "cele-avatar-ring";
    const avatarInner = document.createElement("div");
    const avatarUrl = pickAvatar(globalThis.cssosAuthState ? globalThis.cssosAuthState() : globalThis.authState);
    if (avatarUrl) {
      avatarInner.style.backgroundImage = `url(${JSON.stringify(avatarUrl).slice(1, -1)})`;
    } else {
      avatarInner.textContent = "🎁";
    }
    ring.appendChild(avatarInner);
    card.appendChild(ring);

    const eyebrowEl = document.createElement("div");
    eyebrowEl.className = "cele-eyebrow";
    eyebrowEl.textContent = eyebrow;
    card.appendChild(eyebrowEl);

    const headline = document.createElement("div");
    headline.className = "cele-headline";
    headline.style.fontFamily = fanciestFontFamily();
    headline.textContent = headlineText;
    card.appendChild(headline);

    const customer = document.createElement("div");
    customer.className = "cele-customer";
    customer.textContent = `${eventLabel} — ${customerEmail}`;
    card.appendChild(customer);

    if (amountLabel || planId) {
      const stats = document.createElement("div");
      stats.className = "cele-stats";
      if (amountLabel) {
        const a = document.createElement("span");
        a.textContent = amountLabel;
        stats.appendChild(a);
      }
      if (planId) {
        const p = document.createElement("span");
        p.textContent = planId;
        stats.appendChild(p);
      }
      const live = document.createElement("span");
      live.textContent = event.livemode === false
        ? loginCopy("test mode", "测试模式")
        : loginCopy("live", "正式");
      stats.appendChild(live);
      card.appendChild(stats);
    }

    root.appendChild(card);

    const dismissHint = document.createElement("div");
    dismissHint.className = "cele-dismiss-hint";
    dismissHint.textContent = loginCopy("Press Esc or click anywhere to dismiss", "按 Esc 或点击任意位置关闭");
    root.appendChild(dismissHint);

    const progress = document.createElement("div");
    progress.className = "cele-progress";
    const progressFill = document.createElement("div");
    progress.appendChild(progressFill);
    root.appendChild(progress);

    document.body.appendChild(root);
    requestAnimationFrame(() => { root.classList.add("cssos-cele-show"); });

    const stopConfetti = startConfetti(confettiCanvas, DURATION_MS);
    const stopSparkles = startSparkles(sparkleCanvas, DURATION_MS);
    const stopMusic = playMusic();
    const stopLyrics = rotateLyrics(root, lyrics, DURATION_MS);

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      try { stopConfetti(); } catch (_e) {}
      try { stopSparkles(); } catch (_e) {}
      try { stopMusic(); } catch (_e) {}
      try { stopLyrics(); } catch (_e) {}
      root.classList.remove("cssos-cele-show");
      setTimeout(() => { try { root.remove(); } catch (_e) {} }, FADE_OUT_MS + 100);
      try { document.removeEventListener("keydown", keyHandler, true); } catch (_e) {}
      try { root.removeEventListener("click", clickHandler); } catch (_e) {}
      try {
        if (confettiCanvas.__cssosResize) {
          window.removeEventListener("resize", confettiCanvas.__cssosResize);
        }
        if (sparkleCanvas.__cssosResize) {
          window.removeEventListener("resize", sparkleCanvas.__cssosResize);
        }
      } catch (_e) {}
    };
    const keyHandler = (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        dismiss();
        e.preventDefault();
      }
    };
    const clickHandler = () => { dismiss(); };
    document.addEventListener("keydown", keyHandler, true);
    root.addEventListener("click", clickHandler);
    setTimeout(dismiss, DURATION_MS);

    try {
      console.log(
        "%c🎉 cssOS · " + eyebrow + " · " + customerEmail + (amountLabel ? " · " + amountLabel : ""),
        "color:#ff7a59;font-weight:700;font-size:14px",
      );
    } catch (_e) {}
  }

  globalThis.cssosFirstSubCelebration = {
    present,
    demo() {
      present({
        event_type: "customer.subscription.created",
        customer_email: "first.believer@example.com",
        amount_cents: 1900,
        currency: "usd",
        plan_id: "price_pro_monthly",
        livemode: true,
      });
    },
  };
})();
