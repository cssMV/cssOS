// CSSOS_PHASE2_PERSONALIZATION_TRIGGERS 20260502 #270 - Jing
//
// Central registration point for every gift trigger. The Express
// app calls registerAllPersonalizationTriggers() exactly once at
// boot (after loadPersonalizationTemplates() has populated the
// template registry).
//
// Adding a new trigger:
//   1. Create src/personalization/handlers/<name>.ts exporting a
//      GiftTrigger object.
//   2. Import + register it here.
//   3. Done — the engine routes fireTrigger({key:'<name>', ...})
//      to your handler from the next boot onward.

import { registerGiftTrigger } from "../triggers.js";
import { welcomeTrigger } from "./welcome.js";
import { firstSubscriberTrigger } from "./first-subscriber.js";

let REGISTERED = false;

/**
 * Idempotent — repeat calls are a no-op so a misbehaving boot path
 * that double-invokes us doesn't double-register handlers.
 */
export function registerAllPersonalizationTriggers(): void {
  if (REGISTERED) return;
  REGISTERED = true;
  registerGiftTrigger(welcomeTrigger);
  registerGiftTrigger(firstSubscriberTrigger);
  // Stage D will add: milestone100Trigger, milestone1000Trigger, ...
  // Stage E will add: planUpgradeTrigger, planDowngradeTrigger
  // Stage F will add: birthdayTrigger
  // Stage G will add: feedbackAdoptedTrigger
  // Stage H will add: anniversaryMarriageTrigger, anniversaryOtherTrigger
  console.log("[personalization] registered triggers: welcome, first_subscriber");
}
