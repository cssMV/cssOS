/* CSSOS_WAVE_2354 20261120 — cssTV: 上传之后的【提交审核】全自动。
 *
 * Jing 2026-11-20:「请提交审核到苹果商店, 全权授权给你了, 【不要再需要我按任何提交按键】。」
 *
 * tvos-appstore-submit.sh 只管到【上传】, 它最后一行明写「到此为止, 没有提交审核」。
 * 后面那几步(等构建处理完 → 建版本 → 挂构建 → 写更新说明 → 写审核备注 →
 * 建审核提交单 → 提交)上一轮是我手工一条条调 ASC API 做的。手工做一次就得盯一次,
 * 那就还是"要人按键"。这个脚本把那一串补上。
 *
 * 用法: node scripts/tvos-submit-for-review.mjs            (读 .env.local 的三件套)
 *       WHATS_NEW="..." node scripts/tvos-submit-for-review.mjs
 *
 * 幂等: 每一步都先查后建 —— 版本已存在就复用, 构建已挂就跳过, 审核单已存在就复用。
 *       中途失败(网络/处理中)直接重跑即可, 不会建出两个版本。
 *
 * ⚠ 平台教训(audit-must-report-its-own-gaps): 轮询必须把【没到】和【我没查到】分开。
 *    上一轮 ASC 轮询把 API 报错渲染成"还没出现", 白等了 30 分钟。这里 API 出错一律
 *    抛出来, 绝不当成"构建还没处理完"。 */
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const APP_ID = process.env.ASC_APP_ID || "6784525214";          // cssTV
const PLATFORM = "TV_OS";
const LOCALE = "en-US";

const KID = process.env.APP_STORE_CONNECT_KEY_ID;
const ISS = process.env.APP_STORE_CONNECT_ISSUER_ID;
const KP  = process.env.APP_STORE_CONNECT_KEY_PATH;
if (!KID || !ISS || !KP) {
  console.error("缺 APP_STORE_CONNECT_KEY_ID / _ISSUER_ID / _KEY_PATH(在 .env.local)");
  process.exit(2);
}

/* JWT: 逐字照搬 tvos-appstore-submit.sh 的 asc_probe —— 那份已经在用, 不另造一套。 */
function jwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "ES256", kid: KID, typ: "JWT" });
  const p = b64({ iss: ISS, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" });
  const der = crypto.createSign("SHA256").update(`${h}.${p}`)
    .sign({ key: readFileSync(KP, "utf8"), dsaEncoding: "der" });
  let o = 2; if (der[1] & 0x80) o = 2 + (der[1] & 0x7f);
  const rL = der[o + 1], r = der.subarray(o + 2, o + 2 + rL);
  const sO = o + 2 + rL, sL = der[sO + 1], s = der.subarray(sO + 2, sO + 2 + sL);
  const pad = (b) => (b.length >= 32 ? b.subarray(b.length - 32)
                                     : Buffer.concat([Buffer.alloc(32 - b.length), b]));
  return `${h}.${p}.${Buffer.concat([pad(r), pad(s)]).toString("base64url")}`;
}

let TOKEN = jwt(), TOKEN_AT = Date.now();
async function api(method, path, body) {
  if (Date.now() - TOKEN_AT > 900_000) { TOKEN = jwt(); TOKEN_AT = Date.now(); }   // 长轮询会把 token 熬过期
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const e = json?.errors?.[0];
    const err = new Error(`${method} ${path} → ${res.status} ${e?.code || ""} ${e?.detail || text.slice(0, 300)}`);
    err.status = res.status; err.code = e?.code; err.json = json;
    throw err;   /* ⚠ 抛出来, 不返回 null —— 否则调用方会把"API 出错"读成"还没出现" */
  }
  return json;
}

const log = (...a) => console.log(...a);
const hr  = (t) => log(`\n── ${t} ${"─".repeat(Math.max(0, 56 - t.length))}`);

/* 版本号/构建号的唯一真源是 pbxproj —— 不许在这里另写一份, 否则两处会分叉。 */
const pbx = readFileSync("tvos/cssTV.xcodeproj/project.pbxproj", "utf8");
const VER = pbx.match(/MARKETING_VERSION = ([0-9.]+);/)?.[1];
const BLD = pbx.match(/CURRENT_PROJECT_VERSION = ([0-9]+);/)?.[1];
if (!VER || !BLD) { console.error("从 pbxproj 读不出版本/构建号"); process.exit(2); }

const WHATS_NEW = process.env.WHATS_NEW || `Apple TV remote fixes.

• One press of the Select button now opens the language / voice / visuals / takes capsule. It used to take two or three fast presses.
• Removed a translucent overlay that could dim the whole picture while the capsule was hidden.
• Fast-forward, rewind and previous/next track are unchanged and working.`;

const REVIEW_NOTES = process.env.REVIEW_NOTES ||
  `No account is required to browse or play. Creation is free for reviewers: every new account is granted $5 of generation credit automatically, which is enough to create a full work.

This build fixes Apple TV remote handling in the player: a single press of the Select button now opens the capsule that switches language, voice, visuals and takes.`;

(async () => {
  hr(`要提交的是 cssTV ${VER} (build ${BLD})`);

  /* ① 等构建处理完。分三种状态说三种话 —— 不许把"查不到"和"还没好"混成一句。 */
  hr("① 等 App Store Connect 处理构建");
  let build = null;
  for (let i = 1; i <= 40; i++) {
    const r = await api("GET",
      `/v1/builds?filter[app]=${APP_ID}&filter[version]=${BLD}&limit=1`);
    build = r?.data?.[0] || null;
    const state = build?.attributes?.processingState;
    if (build && state === "VALID") { log(`   构建已就绪 (id ${build.id})`); break; }
    if (state === "FAILED" || state === "INVALID") {
      console.error(`❌ 构建处理失败: ${state} —— 去 ASC 看具体原因, 本脚本不猜。`);
      process.exit(1);
    }
    log(`   第 ${i}/40 次: ${build ? `处理中 (${state})` : "还没出现(上传后 1–2 分钟才会列出)"} —— 等 30s`);
    if (i === 40) { console.error("❌ 等了 20 分钟仍未就绪。这是【没等到】, 不是【失败】—— 重跑即可。"); process.exit(1); }
    await new Promise((r) => setTimeout(r, 30_000));
  }

  /* ② 版本: 已存在就复用(幂等) */
  hr("② 建 / 取 App Store 版本");
  let ver = (await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=50`))
    ?.data?.find((v) => v.attributes?.versionString === VER && v.attributes?.platform === PLATFORM);
  if (ver) {
    log(`   已存在 ${VER} (${ver.attributes.appStoreState}) —— 复用, 不新建`);
  } else {
    ver = (await api("POST", "/v1/appStoreVersions", {
      data: {
        type: "appStoreVersions",
        attributes: { platform: PLATFORM, versionString: VER, releaseType: "AFTER_APPROVAL" },
        relationships: { app: { data: { type: "apps", id: APP_ID } } },
      },
    })).data;
    log(`   已新建 ${VER} (id ${ver.id})`);
  }

  /* ③ 挂构建 */
  hr("③ 把构建挂到版本上");
  await api("PATCH", `/v1/appStoreVersions/${ver.id}/relationships/build`,
    { data: { type: "builds", id: build.id } });
  log(`   build ${BLD} → ${VER}`);

  /* ④ 更新说明。Jing 常驻授权: What's New 不必经他过目(只限这一项)。 */
  hr("④ 写更新说明 (What's New)");
  const locs = (await api("GET", `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=50`))?.data || [];
  const loc = locs.find((l) => l.attributes?.locale === LOCALE) || locs[0];
  if (!loc) { console.error("❌ 这个版本没有任何本地化条目"); process.exit(1); }
  await api("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`,
    { data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew: WHATS_NEW } } });
  log(`   ${loc.attributes.locale} 已写入 ${WHATS_NEW.length} 字`);

  /* ⑤ 审核备注 */
  hr("⑤ 写审核备注");
  let det = null;
  try { det = (await api("GET", `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`))?.data; }
  catch (e) { if (e.status !== 404) throw e; }
  if (det) {
    await api("PATCH", `/v1/appStoreReviewDetails/${det.id}`,
      { data: { type: "appStoreReviewDetails", id: det.id, attributes: { notes: REVIEW_NOTES } } });
  } else {
    await api("POST", "/v1/appStoreReviewDetails", {
      data: { type: "appStoreReviewDetails", attributes: { notes: REVIEW_NOTES },
              relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } } } },
    });
  }
  log("   已写入");

  /* ⑥⑦ 审核提交单 + 提交 */
  hr("⑥ 建审核提交单");
  let sub = (await api("GET", `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=${PLATFORM}&limit=50`))
    ?.data?.find((s) => s.attributes?.state === "READY_FOR_REVIEW" || s.attributes?.state === "UNRESOLVED_ISSUES");
  if (sub) log(`   已有一张未提交的 (${sub.attributes.state}) —— 复用`);
  else {
    sub = (await api("POST", "/v1/reviewSubmissions", {
      data: { type: "reviewSubmissions", attributes: { platform: PLATFORM },
              relationships: { app: { data: { type: "apps", id: APP_ID } } } },
    })).data;
    log(`   已新建 (id ${sub.id})`);
  }

  const items = (await api("GET", `/v1/reviewSubmissions/${sub.id}/items?limit=50`))?.data || [];
  if (items.some((i) => i.relationships?.appStoreVersion?.data?.id === ver.id)) {
    log("   版本已在提交单里 —— 不重复加");
  } else {
    await api("POST", "/v1/reviewSubmissionItems", {
      data: { type: "reviewSubmissionItems",
              relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub.id } },
                               appStoreVersion:  { data: { type: "appStoreVersions",  id: ver.id } } } },
    });
    log("   版本已加入提交单");
  }

  hr("⑦ 提交审核");
  await api("PATCH", `/v1/reviewSubmissions/${sub.id}`,
    { data: { type: "reviewSubmissions", id: sub.id, attributes: { submitted: true } } });

  /* 读回来核对 —— 不读回就只是"我发了个请求", 不是"提交成功了"。 */
  const after = (await api("GET", `/v1/appStoreVersions/${ver.id}`))?.data?.attributes;
  const subAfter = (await api("GET", `/v1/reviewSubmissions/${sub.id}`))?.data?.attributes;
  hr("结果(读回来的, 不是我以为的)");
  log(`   版本 ${VER} (build ${BLD})  状态: ${after?.appStoreState}`);
  log(`   提交单状态: ${subAfter?.state}   提交时间: ${subAfter?.submittedDate || "(未记录)"}`);
  const ok = subAfter?.state === "WAITING_FOR_REVIEW" || after?.appStoreState === "WAITING_FOR_REVIEW";
  log(ok ? "\n✅ 已进入审核队列。" : "\n⚠ 状态不是 WAITING_FOR_REVIEW —— 去 ASC 看一眼, 别当成功。");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("\n❌ " + e.message); process.exit(1); });
