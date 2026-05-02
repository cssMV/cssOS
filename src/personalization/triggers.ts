// CSSOS_PHASE2_PERSONALIZATION_FOUNDATION 20260502 #268 — Jing
//
// Trigger registry. Stage A leaves it empty — Stages B / C / D
// register concrete triggers (welcome, first_subscriber, milestones,
// plan_upgrade, birthday, …) by calling registerGiftTrigger() at
// module load time. The engine's fireTrigger() looks them up here.

import type { GiftTrigger, GiftTriggerKey } from "./types.js";

const REGISTRY: Map<GiftTriggerKey, GiftTrigger> = new Map();

/**
 * Add a trigger to the registry. Re-registering the same key
 * overwrites the previous entry (useful for hot-reload tests).
 */
export function registerGiftTrigger(trigger: GiftTrigger): void {
  REGISTRY.set(trigger.key, trigger);
}

export function getRegisteredTrigger(
  key: GiftTriggerKey,
): GiftTrigger | undefined {
  return REGISTRY.get(key);
}

export function listRegisteredTriggers(): GiftTrigger[] {
  return [...REGISTRY.values()];
}

/**
 * Test helper: clear the registry between unit tests so each test
 * starts from a known empty state. Should NOT be called in prod.
 */
export function _resetGiftTriggerRegistryForTests(): void {
  REGISTRY.clear();
}
