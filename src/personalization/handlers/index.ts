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
import {
  milestone100Trigger,
  milestone1000Trigger,
  milestone10000Trigger,
  milestone100000Trigger,
} from "./milestones.js";
import {
  planUpgradeTrigger,
  planDowngradeTrigger,
} from "./plan-change.js";
import { birthdayTrigger } from "./birthday.js";
import { feedbackAdoptedTrigger } from "./feedback-adopted.js";
import {
  anniversaryMarriageTrigger,
  anniversaryOtherTrigger,
} from "./anniversaries.js";

let REGISTERED = false;

/**
 * Idempotent — repeat calls are a no-op so a misbehaving boot path
 * that double-invokes us doesn't double-register handlers.
 */
export function registerAllPersonalizationTriggers(): void {
  if (REGISTERED) return;
  REGISTERED = true;
  // Stage A/B/C — already shipped
  registerGiftTrigger(welcomeTrigger);
  registerGiftTrigger(firstSubscriberTrigger);
  // Stage D — subscriber-count milestones
  registerGiftTrigger(milestone100Trigger);
  registerGiftTrigger(milestone1000Trigger);
  registerGiftTrigger(milestone10000Trigger);
  registerGiftTrigger(milestone100000Trigger);
  // Stage E — plan changes (recurring per user, not oneShot)
  registerGiftTrigger(planUpgradeTrigger);
  registerGiftTrigger(planDowngradeTrigger);
  // Stage F — birthday (cron-driven via runDailyBirthdayFlush)
  registerGiftTrigger(birthdayTrigger);
  // Stage G — feedback adopted
  registerGiftTrigger(feedbackAdoptedTrigger);
  // Stage H — anniversaries
  registerGiftTrigger(anniversaryMarriageTrigger);
  registerGiftTrigger(anniversaryOtherTrigger);
  console.log(
    "[personalization] registered triggers: welcome, first_subscriber, " +
      "milestone_100, milestone_1000, milestone_10000, milestone_100000, " +
      "plan_upgrade, plan_downgrade, birthday, feedback_adopted, " +
      "anniversary_marriage, anniversary_other",
  );
}

// Re-export the birthday cron so the boot scheduler can call it.
export { runDailyBirthdayFlush } from "./birthday.js";
