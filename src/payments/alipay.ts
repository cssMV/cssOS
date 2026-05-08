/* CSSOS_PERSON_MV_WAVE104 20260508 — Jing
 * Alipay (支付宝) Premium subscription adapter — scaffold.
 *
 * Env vars expected (all required to enable):
 *   ALIPAY_APP_ID           — 商户 app_id from open.alipay.com
 *   ALIPAY_PRIVATE_KEY      — RSA2 private key (PEM, app's private key)
 *   ALIPAY_PUBLIC_KEY       — RSA2 Alipay public key (PEM, used to verify callbacks)
 *   ALIPAY_GATEWAY_URL      — Optional. Defaults to https://openapi.alipay.com/gateway.do
 *
 * Webhook signature verification: Alipay signs callback POST bodies
 * with RSA2 (SHA256withRSA). We verify via the SDK's checkNotifySign
 * using ALIPAY_PUBLIC_KEY. Replay safety is enforced upstream by the
 * payment_provider_events.external_event_id UNIQUE constraint
 * (we use the trade_no as the external id).
 *
 * Library: alipay-sdk (^4.0.0). The require is lazy so the codebase
 * still type-checks and runs when the package is not yet installed in
 * the deploy environment. */

let alipaySdkCached: unknown = null;
let alipaySdkLoaded = false;

function loadAlipaySdk(): unknown {
  if (alipaySdkLoaded) return alipaySdkCached;
  alipaySdkLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    alipaySdkCached = require("alipay-sdk");
  } catch {
    alipaySdkCached = null;
  }
  return alipaySdkCached;
}

export interface AlipayClient {
  exec: (
    method: string,
    bizContent: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ) => Promise<unknown>;
  pageExec: (
    method: string,
    bizContent: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ) => Promise<string>;
  checkNotifySign: (postBody: Record<string, string>) => boolean;
}

/* Returns null when env keys are unset OR alipay-sdk is not installed.
 * Callers must treat null as "Coming soon" / 503. */
export function getAlipayClient(): AlipayClient | null {
  const appId = process.env.ALIPAY_APP_ID;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
  if (!appId || !privateKey || !alipayPublicKey) return null;
  const sdkMod = loadAlipaySdk() as
    | { default?: unknown; AlipaySdk?: unknown }
    | null;
  if (!sdkMod) return null;
  const Ctor = (sdkMod as { default?: unknown }).default
    || (sdkMod as { AlipaySdk?: unknown }).AlipaySdk
    || sdkMod;
  try {
    const inst = new (Ctor as new (cfg: Record<string, unknown>) => unknown)({
      appId,
      privateKey,
      alipayPublicKey,
      signType: "RSA2",
      gateway: process.env.ALIPAY_GATEWAY_URL || "https://openapi.alipay.com/gateway.do",
    });
    const i = inst as {
      exec?: AlipayClient["exec"];
      pageExec?: AlipayClient["pageExec"];
      checkNotifySign?: AlipayClient["checkNotifySign"];
    };
    if (typeof i.exec !== "function" || typeof i.checkNotifySign !== "function") {
      return null;
    }
    return {
      exec: i.exec.bind(inst),
      pageExec: (i.pageExec || i.exec).bind(inst) as AlipayClient["pageExec"],
      checkNotifySign: i.checkNotifySign.bind(inst),
    };
  } catch {
    return null;
  }
}

export function isAlipayConfigured(): boolean {
  return getAlipayClient() !== null;
}

export interface CreateOrderInput {
  user_id: string;
  amount_cents: number;       // CNY fen
  return_url: string;
  notify_url: string;         // server webhook url
  subject?: string;
}

export interface CreateOrderResult {
  redirect_url: string;
  out_trade_no: string;
}

/* Creates an Alipay web-redirect order via alipay.trade.page.pay.
 * Returns a URL the user opens in a new tab to complete payment. */
export async function createSubscriptionOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult | null> {
  const client = getAlipayClient();
  if (!client) return null;
  const out_trade_no = `cssos_premium_${input.user_id.slice(0, 8)}_${Date.now()}`;
  const yuan = (input.amount_cents / 100).toFixed(2);
  const bizContent = {
    out_trade_no,
    product_code: "FAST_INSTANT_TRADE_PAY",
    total_amount: yuan,
    subject: input.subject || "cssstudio Premium — 月度订阅",
  };
  try {
    const html = await client.pageExec("alipay.trade.page.pay", bizContent, {
      formData: false,
      validateSign: false,
      notify_url: input.notify_url,
      return_url: input.return_url,
    } as unknown as Record<string, unknown>);
    return { redirect_url: String(html), out_trade_no };
  } catch {
    return null;
  }
}

/* Verify the RSA2 signature on an incoming webhook POST body. */
export function verifyWebhookSignature(
  body: Record<string, string>,
): boolean {
  const client = getAlipayClient();
  if (!client) return false;
  try {
    return Boolean(client.checkNotifySign(body));
  } catch {
    return false;
  }
}
