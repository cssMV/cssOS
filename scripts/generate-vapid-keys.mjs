#!/usr/bin/env node
/* CSSOS_PERSON_MV_WAVE50 20260508 — Jing
 * Generate a VAPID keypair for Web Push and print the env lines to
 * append to /etc/cssos.env. Run once per environment.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * Then restart the API. The /api/push/vapid-public-key endpoint will
 * pick up VAPID_PUBLIC_KEY automatically. */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
const subj = process.env.VAPID_SUBJECT || "mailto:admin@cssstudio.app";

console.log("# Append to /etc/cssos.env (or your env file) and restart the API:");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=${subj}`);
