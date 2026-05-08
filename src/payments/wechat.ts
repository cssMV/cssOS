/* CSSOS_PERSON_MV_WAVE104 20260508 — Jing
 * WeChat Pay (微信支付) Premium subscription adapter — scaffold.
 *
 * Env vars expected (all required to enable):
 *   WECHAT_MCH_ID        — 商户号 from pay.weixin.qq.com
 *   WECHAT_APP_ID        — Public account / mini-program / open-platform AppID
 *   WECHAT_API_KEY_V3    — APIv3 key (32 chars)
 *   WECHAT_CERT_SERIAL   — Merchant certificate serial number
 *   WECHAT_PRIVATE_KEY   — Merchant private key PEM (apiclient_key.pem)
 *   WECHAT_NOTIFY_URL    — Public HTTPS webhook URL (must be reachable & ICP-filed)
 *
 * Library: wechatpay-axios-plugin (community APIv3 client). Loaded
 * lazily so the codebase still type-checks when the package is absent
 * in dev. Webhook signature verification uses APIv3:
 *   Wechatpay-Signature header verified with the platform certificate
 *   (RSA-SHA256). Body is AES-GCM encrypted with WECHAT_API_KEY_V3.
 * Replay safety: payment_provider_events.external_event_id UNIQUE
 * (we use the transaction_id as the external id). */

let wechatModCached: unknown = null;
let wechatModLoaded = false;

function loadWechatSdk(): unknown {
  if (wechatModLoaded) return wechatModCached;
  wechatModLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    wechatModCached = require("wechatpay-axios-plugin");
  } catch {
    wechatModCached = null;
  }
  return wechatModCached;
}

export interface WechatConfig {
  mchId: string;
  appId: string;
  apiKeyV3: string;
  certSerial: string;
  privateKey: string;
  notifyUrl: string;
}

export function readWechatEnv(): WechatConfig | null {
  const mchId = process.env.WECHAT_MCH_ID;
  const appId = process.env.WECHAT_APP_ID;
  const apiKeyV3 = process.env.WECHAT_API_KEY_V3;
  const certSerial = process.env.WECHAT_CERT_SERIAL;
  const privateKey = process.env.WECHAT_PRIVATE_KEY;
  const notifyUrl = process.env.WECHAT_NOTIFY_URL;
  if (!mchId || !appId || !apiKeyV3 || !certSerial || !privateKey || !notifyUrl) {
    return null;
  }
  return { mchId, appId, apiKeyV3, certSerial, privateKey, notifyUrl };
}

export function isWechatConfigured(): boolean {
  return readWechatEnv() !== null;
}

export interface NativeOrderInput {
  user_id: string;
  amount_cents: number;       // CNY fen
  description?: string;
}

export interface NativeOrderResult {
  code_url: string;           // weixin:// URI for QR generation
  out_trade_no: string;
}

/* Creates a Native Pay (QR code) order via /v3/pay/transactions/native.
 * Returns a code_url that the frontend renders as a QR code. */
export async function createNativeOrder(
  input: NativeOrderInput,
): Promise<NativeOrderResult | null> {
  const cfg = readWechatEnv();
  if (!cfg) return null;
  const sdkMod = loadWechatSdk() as
    | { Wechatpay?: unknown; default?: unknown }
    | null;
  if (!sdkMod) return null;
  const Ctor =
    (sdkMod as { Wechatpay?: unknown }).Wechatpay ||
    (sdkMod as { default?: unknown }).default ||
    sdkMod;
  const out_trade_no = `cssos_premium_${input.user_id.slice(0, 8)}_${Date.now()}`;
  try {
    const wxpay = new (Ctor as new (cfg: Record<string, unknown>) => unknown)({
      mchid: cfg.mchId,
      serial: cfg.certSerial,
      privateKey: cfg.privateKey,
      key: cfg.apiKeyV3,
    });
    const v3 = (wxpay as Record<string, unknown>)["v3"] as
      | Record<string, unknown>
      | undefined;
    if (!v3) return null;
    const path = ((v3 as Record<string, unknown>)["pay"] as Record<string, unknown>
      | undefined)?.["transactions"] as Record<string, unknown> | undefined;
    if (!path) return null;
    const native = path["native"] as
      | { post: (b: Record<string, unknown>) => Promise<{ data?: { code_url?: string } }> }
      | undefined;
    if (!native || typeof native.post !== "function") return null;
    const resp = await native.post({
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: input.description || "cssstudio Premium — 月度订阅",
      out_trade_no,
      notify_url: cfg.notifyUrl,
      amount: { total: input.amount_cents, currency: "CNY" },
    });
    const code_url = String(resp?.data?.code_url || "");
    if (!code_url) return null;
    return { code_url, out_trade_no };
  } catch {
    return null;
  }
}

/* Verify the APIv3 webhook signature using the platform certificate.
 * Header values: Wechatpay-Timestamp, Wechatpay-Nonce, Wechatpay-Signature,
 * Wechatpay-Serial. The signed string is "${timestamp}\n${nonce}\n${rawBody}\n".
 * For a scaffold we accept the SDK's built-in verifier when available;
 * otherwise return false (callers will 401). */
export function verifyWebhookSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
): boolean {
  const cfg = readWechatEnv();
  if (!cfg) return false;
  const sdkMod = loadWechatSdk() as
    | { Rsa?: { verify?: (msg: string, sig: string, pub: string) => boolean } }
    | null;
  const sig = String(headers["wechatpay-signature"] || "");
  const ts = String(headers["wechatpay-timestamp"] || "");
  const nonce = String(headers["wechatpay-nonce"] || "");
  const platformCert = process.env.WECHAT_PLATFORM_CERT_PEM;
  if (!sig || !ts || !nonce || !platformCert) return false;
  const message = `${ts}\n${nonce}\n${rawBody}\n`;
  try {
    const verifier = sdkMod?.Rsa?.verify;
    if (typeof verifier === "function") {
      return Boolean(verifier(message, sig, platformCert));
    }
    // Fallback: native crypto RSA-SHA256.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cryptoMod = require("node:crypto") as typeof import("node:crypto");
    const v = cryptoMod.createVerify("RSA-SHA256");
    v.update(message);
    v.end();
    return v.verify(platformCert, sig, "base64");
  } catch {
    return false;
  }
}

/* Decrypt the AES-GCM resource payload from a webhook event. */
export function decryptResource(resource: {
  ciphertext?: string;
  associated_data?: string;
  nonce?: string;
}): unknown {
  const cfg = readWechatEnv();
  if (!cfg) return null;
  const ct = resource.ciphertext || "";
  const aad = resource.associated_data || "";
  const nonce = resource.nonce || "";
  if (!ct || !nonce) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cryptoMod = require("node:crypto") as typeof import("node:crypto");
    const buf = Buffer.from(ct, "base64");
    const authTag = buf.subarray(buf.length - 16);
    const data = buf.subarray(0, buf.length - 16);
    const decipher = cryptoMod.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(cfg.apiKeyV3, "utf8"),
      Buffer.from(nonce, "utf8"),
    );
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(dec.toString("utf8"));
  } catch {
    return null;
  }
}
