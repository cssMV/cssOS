/* CSSOS_PERSON_MV_WAVE104B 20260508 — Jing
 * NihaoPay (https://nihaopay.com) aggregator adapter — replaces the
 * direct Alipay + WeChat Pay scaffolds from wave 104. NihaoPay routes
 * Alipay / WeChat Pay / UnionPay through a single merchant ID, so we
 * only need their REST API.
 *
 * Env vars (all required to enable):
 *   NIHAOPAY_MERCHANT_ID                — e.g. MBET102230
 *   NIHAOPAY_API_KEY                    — 32-byte hex secret (Bearer token + HMAC key)
 *   NIHAOPAY_ENV                        — "sandbox" | "live" (default "sandbox")
 *   NIHAOPAY_PURCHASE_PLATFORM_BPS      — existing platform fee config (read elsewhere)
 *
 * Endpoints (per NihaoPay docs):
 *   sandbox: https://sandbox.nihaopay.com/v2.0/transactions/secure-pay
 *   live:    https://api.nihaopay.com/v2.0/transactions/secure-pay
 *
 * Auth: HTTP Basic with token as username + empty password.
 *       Authorization: Basic base64("${NIHAOPAY_API_KEY}:")
 *       (NOT Bearer — earlier attempt got "label 92 reference field
 *       is required" because NihaoPay didn't auth the body.)
 *
 * Webhook signature: HMAC-SHA256 over the form fields sorted
 * alphabetically as `key=value&key=value...` (excluding `signature`),
 * keyed by NIHAOPAY_API_KEY. Compared in constant time.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type NihaoVendor = "alipay" | "wechatpay" | "unionpay";

export function isNihaoPayConfigured(): boolean {
  return !!(process.env.NIHAOPAY_MERCHANT_ID && process.env.NIHAOPAY_API_KEY);
}

function endpoint(): string {
  const env = (process.env.NIHAOPAY_ENV || "sandbox").toLowerCase();
  return env === "live" || env === "production"
    ? "https://api.nihaopay.com/v2.0/transactions/secure-pay"
    : "https://sandbox.nihaopay.com/v2.0/transactions/secure-pay";
}

function basicAuthHeader(): string {
  const apiKey = String(process.env.NIHAOPAY_API_KEY || "");
  /* NihaoPay HTTP Basic = token as username + empty password.
   * `${apiKey}:` — note the trailing colon. */
  return "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
}

export interface NihaoCreateInput {
  user_id: string;
  vendor: NihaoVendor;
  amount_cents: number;     // cents (USD by default)
  currency?: string;        // default "USD"
  ipn_url: string;          // server webhook URL
  callback_url: string;     // browser return URL
  note?: string;
}

export interface NihaoCreateResult {
  redirect_url: string;     // hosted-checkout URL or HTML form payload
  reference: string;
}

/* Creates a NihaoPay secure-pay transaction. Returns the hosted
 * redirect URL (or HTML form snippet) that the frontend opens. */
export async function createSecurePay(
  input: NihaoCreateInput,
): Promise<NihaoCreateResult | null> {
  if (!isNihaoPayConfigured()) return null;
  const merchantId = String(process.env.NIHAOPAY_MERCHANT_ID || "");
  const reference = `cssos_premium_${input.user_id.slice(0, 8)}_${Date.now()}`;
  const form = new URLSearchParams();
  form.set("merchant_id", merchantId);
  form.set("vendor", input.vendor);
  form.set("currency", (input.currency || "USD").toUpperCase());
  form.set("amount", String(Math.max(1, Math.round(input.amount_cents))));
  form.set("reference", reference);
  form.set("ipn_url", input.ipn_url);
  form.set("callback_url", input.callback_url);
  form.set("note", input.note || "CSS Studio Premium Monthly Subscription");

  try {
    const resp = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Authorization": basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html, application/json",
      },
      body: form.toString(),
    });
    if (!resp.ok) {
      /* Surface non-2xx — log the body so admins can see NihaoPay's
       * actual error (e.g. label/code/message/traceId JSON). */
      const errBody = await resp.text().catch(() => "");
      console.warn(`[nihaopay] ${resp.status} ${endpoint()} :: ${errBody.slice(0, 400)}`);
      return null;
    }
    // NihaoPay returns either an HTML form (auto-submit) or a JSON
    // body with `{ url }`. Detect both.
    const ct = String(resp.headers.get("content-type") || "");
    if (ct.includes("application/json")) {
      const j = (await resp.json().catch(() => null)) as
        | { url?: string; redirect_url?: string }
        | null;
      const url = j?.url || j?.redirect_url || "";
      if (!url) return null;
      return { redirect_url: url, reference };
    }
    const html = await resp.text();
    return { redirect_url: html, reference };
  } catch {
    return null;
  }
}

/* Verify HMAC-SHA256 signature on an inbound IPN form body. */
export function verifyWebhookSignature(
  body: Record<string, string>,
): boolean {
  const apiKey = String(process.env.NIHAOPAY_API_KEY || "");
  if (!apiKey) return false;
  const incoming = String(body.signature || body.sign || "").trim();
  if (!incoming) return false;
  const keys = Object.keys(body).filter((k) => k !== "signature" && k !== "sign").sort();
  const canonical = keys.map((k) => `${k}=${body[k] ?? ""}`).join("&");
  const expected = createHmac("sha256", apiKey).update(canonical, "utf8").digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(incoming.toLowerCase(), "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
