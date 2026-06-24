/* CSSOS_PERSON_MV_WAVE32 20260508 — Jing
 * Service worker: cache-first for static assets, network-first
 * for /api/*, plus web push handlers so notifications fire even
 * when the tab is closed. */

// CSSOS_WAVE_485k 20260528 — Jing「App 卡崩溃循环、拉不到修复版」系统级破局: bump 缓存名
// → 旧 SW 缓存的【崩溃版 CSS】在 activate 时被全部清除(skipWaiting+clients.claim 已就位),
// 卡死设备下次崩溃重载(=导航, 会重新拉 sw.js)即换新 SW → 清缓存 → 取到修复版 style.css,
// 无需用户重装。每次有"必须送达所有客户端"的静态资源修复时, 都应顺手 bump 此版本号。
const CACHE = "cssos-static-v683-w1218";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return /\/(app\.[^/]+\.js|style\.[^/]+\.css|icons\/[^/]+|manifest\.webmanifest|favicon\.ico)$/.test(url.pathname)
      || /\/(app\.|style\.)/.test(url.pathname) && /\.(js|css|png|svg|webmanifest)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_e) { return; }
  if (url.origin !== self.location.origin) return;

  // CSSOS_WAVE_381 20260523 — Jing「闪退/刷新返回主界面」根因之一: 旧 SW 对 /api/
  // 用 `fetch().catch(() => caches.match(req))`, 网络失败且未缓存时 caches.match
  // 解析为 undefined → respondWith(null) → "FetchEvent.respondWith received an error:
  // Returned response is null" → "Load failed" → 整页报错/刷新回主界面(崩溃日志实锤)。
  // 修复: /api/ 一律【直通网络】不拦截(动态接口本就不该被 SW 缓存, 否则还会喂旧数据
  // 导致串台), 彻底消除该路径的 null。
  if (url.pathname.startsWith("/api/")) {
    return; // pass through to network; SW does not intercept dynamic APIs
  }

  // CSSOS_WAVE_395 20260524 — Jing「App 端卡在旧缓存版本」根治: 导航请求(应用外壳/
  // index.html)一律【网络优先】。此前一份缓存住的旧外壳把 iOS App 钉死在旧 build,
  // 冷启动都刷不掉。现在每次导航都取最新, 只有真正离线才回退到缓存的外壳副本 —— 让
  // 任何未来的 SW 缓存状态都能自愈, 不再版本滞后。
  if (req.mode === "navigate" ||
      (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req).then((res) => {
        try {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put("/__shell__", clone)).catch(() => {});
          }
        } catch (_e) {}
        return res;
      }).catch(() =>
        caches.open(CACHE)
          .then((c) => c.match("/__shell__"))
          .then((h) => h || new Response("", { status: 504, statusText: "offline" })),
      ),
    );
    return;
  }

  if (isStatic(url)) {
    // Cache-first for versioned static assets. CSSOS_WAVE_381 — 所有分支都【保证
    // 返回真 Response, 绝不 null】: 命中缓存→返回; 否则取网络, 取网络失败再回缓存,
    // 再不行返回 504 占位 Response, 永不让 respondWith 收到 undefined。
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          if (hit) return hit;
          return fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() =>
            cache.match(req).then((h) => h || new Response("", { status: 504, statusText: "offline" })),
          );
        }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { data = {}; }
  const title = data.title || "CSS Studio";
  const body = data.body || "";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
