/* CSSOS_WAVE100 20260508 — Jing
 * TLS / cert validity monitor. Daily check of cssstudio.app + sub-hosts.
 * Inserts into tls_cert_checks; <14d remaining → admin notification.
 *
 * Implementation note: uses node:tls directly (not https) because we want
 * the peer certificate even if the HTTPS handshake would otherwise be
 * fine — no body fetch, no follow-redirects, just the cert metadata.
 * Fire-and-forget; never throws to caller.
 */

import * as tls from "node:tls";
import { withClient } from "../db";

export type TlsCheckResult = {
  hostname: string;
  ok: boolean;
  valid_from: Date | null;
  valid_to: Date | null;
  days_remaining: number | null;
  issuer: string | null;
  error: string | null;
};

const HOSTS_DEFAULT = ["cssstudio.app", "cdn.cssstudio.app", "embed.cssstudio.app"];
const ALERT_THRESHOLD_DAYS = 14;

export function tlsHosts(): string[] {
  const env = String(process.env.CSSOS_TLS_HOSTS || "").trim();
  if (env) {
    return env.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return HOSTS_DEFAULT.slice();
}

export function checkTlsCert(hostname: string, timeoutMs = 8000): Promise<TlsCheckResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: TlsCheckResult) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(r);
    };
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) {
            finish({
              hostname, ok: false, valid_from: null, valid_to: null,
              days_remaining: null, issuer: null,
              error: "no_peer_certificate",
            });
            return;
          }
          const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
          const validTo = new Date(cert.valid_to);
          const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / 86400000);
          const issuerO = (cert.issuer && (cert.issuer.O || cert.issuer.CN)) || null;
          finish({
            hostname,
            ok: socket.authorized && daysRemaining > 0,
            valid_from: validFrom,
            valid_to: validTo,
            days_remaining: daysRemaining,
            issuer: issuerO ? String(issuerO).slice(0, 200) : null,
            error: socket.authorized ? null : (socket.authorizationError ? String(socket.authorizationError) : null),
          });
        } catch (err) {
          finish({
            hostname, ok: false, valid_from: null, valid_to: null,
            days_remaining: null, issuer: null,
            error: (err as Error)?.message || String(err),
          });
        }
      },
    );
    socket.setTimeout(timeoutMs, () => {
      finish({
        hostname, ok: false, valid_from: null, valid_to: null,
        days_remaining: null, issuer: null, error: "timeout",
      });
    });
    socket.on("error", (err) => {
      finish({
        hostname, ok: false, valid_from: null, valid_to: null,
        days_remaining: null, issuer: null,
        error: (err as Error)?.message || String(err),
      });
    });
  });
}

export async function logTlsCheck(r: TlsCheckResult): Promise<void> {
  try {
    await withClient((c) =>
      c.query(
        `INSERT INTO tls_cert_checks
           (hostname, valid_from, valid_to, days_remaining, issuer, ok, error)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          r.hostname.slice(0, 200),
          r.valid_from,
          r.valid_to,
          r.days_remaining,
          r.issuer,
          r.ok,
          r.error ? r.error.slice(0, 500) : null,
        ],
      ),
    );
  } catch (err) {
    console.warn("[tls-monitor] log insert failed:", (err as Error)?.message || err);
  }
}

export type TlsRunSummary = {
  results: TlsCheckResult[];
  expiring: TlsCheckResult[];
};

export async function runTlsChecks(hosts?: string[]): Promise<TlsRunSummary> {
  const list = hosts && hosts.length ? hosts : tlsHosts();
  const results: TlsCheckResult[] = [];
  for (const h of list) {
    try {
      const r = await checkTlsCert(h);
      results.push(r);
      await logTlsCheck(r);
    } catch (err) {
      const r: TlsCheckResult = {
        hostname: h, ok: false, valid_from: null, valid_to: null,
        days_remaining: null, issuer: null,
        error: (err as Error)?.message || String(err),
      };
      results.push(r);
      await logTlsCheck(r);
    }
  }
  const expiring = results.filter(
    (r) => r.days_remaining != null && r.days_remaining < ALERT_THRESHOLD_DAYS,
  );
  return { results, expiring };
}

export async function loadRecentTlsChecks(limit = 20): Promise<unknown[]> {
  const lim = Math.max(1, Math.min(200, Math.floor(limit) || 20));
  try {
    const r = await withClient((c) =>
      c.query(
        `SELECT id, hostname, valid_from, valid_to, days_remaining, issuer, ok, error, checked_at
           FROM tls_cert_checks
          ORDER BY checked_at DESC
          LIMIT $1`,
        [lim],
      ),
    );
    return r.rows;
  } catch (err) {
    console.warn("[tls-monitor] load failed:", (err as Error)?.message || err);
    return [];
  }
}

export const TLS_ALERT_THRESHOLD_DAYS = ALERT_THRESHOLD_DAYS;
