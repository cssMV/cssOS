// CSSOS_PHASE2_PERSONALIZATION_FOUNDATION 20260502 #268 — Jing
//
// Shared types for the personalization engine. The engine handles
// "system gift" MVs — welcome, first subscriber, milestones, plan
// changes, birthdays, anniversaries, feedback rewards. Every gift
// flows through the same trigger → audit → handler pipeline so we
// can enforce cooldowns, cost budgets, and quiet hours uniformly.

/**
 * Stable identifiers for trigger types. Adding a new trigger means:
 *   1. Add the literal here (the type-system enforces it).
 *   2. Register a GiftTrigger in src/personalization/triggers.ts.
 *   3. (Optional) Add a row to a per-trigger config doc.
 */
export type GiftTriggerKey =
  | "welcome" //  new user first-login welcome MV
  | "welcome_back" //  user returning after 90+ days dormant
  | "first_subscriber" //  the first paying subscriber on the platform
  | "milestone_100"
  | "milestone_1000"
  | "milestone_10000"
  | "milestone_100000"
  | "plan_upgrade" //  free → paid, or tier ↑
  | "plan_downgrade" //  tier ↓
  | "account_deletion" //  farewell MV on account close
  | "birthday"
  | "anniversary_marriage" //  user-submitted marriage anniversary
  | "anniversary_other" //  any other approved custom anniversary
  | "feedback_adopted" //  user's bug/feature request was shipped
  | "streak_30day" //  generated work 30 days running
  | "streak_100day"
  | "referral_success"; //  invited friend subscribed

/**
 * Lifecycle states for a gift audit row. The engine never deletes
 * audit rows — every state transition writes back to the same row.
 */
export type GiftStatus =
  | "pending" //  queued, not yet dispatched (e.g. quiet hours)
  | "generating" //  handler running, MV being made
  | "delivered" //  work_id set, user can see it in their inbox
  | "viewed" //  user opened the gift at least once
  | "failed" //  handler error, see failure_reason
  | "rate_limited" //  cooldown / per-year cap hit
  | "opted_out"; //  user has gift_opt_out=true, skipped silently

/**
 * The minimum data every trigger needs to know about its target.
 * Triggers that need extra context (Stripe event, plan name, etc.)
 * pass it via FireTriggerArgs.payload — the engine forwards it to
 * the handler as-is, no inspection.
 */
export interface GiftTargetSnapshot {
  user_id: string;
  email: string | null;
  display_name: string | null;
  locale: string | null;
  /** What this user wants embedded in their MV — overrides display_name. */
  preferred_gift_display_name: string | null;
  /** Override locale for gift content — overrides users.locale. */
  preferred_gift_language: string | null;
  birthday: string | null; //  ISO YYYY-MM-DD or null
  birthday_timezone: string | null;
  birthday_opt_in: boolean;
  gift_opt_out: boolean;
  quiet_hours_start_local: string | null; //  'HH:MM:SS'
  quiet_hours_end_local: string | null;
}

/**
 * Args every trigger handler receives. The engine populates
 * `target` and `auditId`; everything else comes from the caller
 * that fired the trigger.
 */
export interface GenerateArgs {
  /** Snapshot of the recipient at trigger time. */
  target: GiftTargetSnapshot;
  /** Trigger-specific payload (Stripe event, plan ids, etc.). */
  payload: Record<string, unknown>;
  /** The audit row id created for this trigger; handlers update it. */
  auditId: string;
  /** Stripe livemode mirror for cost reporting filters. */
  livemode: boolean;
}

export interface GenerateResult {
  /** The created MV's work_id. */
  workId: string;
  /** Cost in cents for budget tracking. 0 for templated MVs. */
  costCents: number;
  /** Optional template id, if the gift used a pre-rendered skeleton. */
  templateId?: string;
}

/**
 * Trigger registration shape. Each trigger declares its policies
 * (cooldown, max-fires-per-year, cost budget, quiet-hours behavior)
 * and a generate() implementation. The engine enforces the policies
 * before calling generate(); handlers should not re-check them.
 */
export interface GiftTrigger {
  key: GiftTriggerKey;
  /**
   * Minimum days between fires of THIS trigger to the SAME user.
   * Default 0 (no cooldown). For one-shot triggers (welcome,
   * first_subscriber) the engine also enforces a uniqueness index
   * via the audit table — see `oneShot` below.
   */
  cooldownDays?: number;
  /** Hard cap on fires per user per calendar year. */
  maxFiresPerYear?: number;
  /**
   * If true, this trigger can fire AT MOST ONCE per user, ever.
   * The engine checks the audit table for any prior delivered/
   * viewed/generating row for this user+trigger before firing.
   */
  oneShot?: boolean;
  /**
   * If true and the user is currently in their quiet hours window,
   * the trigger is queued (status='pending') for later flush rather
   * than fired immediately.
   *
   * Currently best-effort — the actual queue flush job comes in
   * Stage F (alongside birthdays).
   */
  respectQuietHours?: boolean;
  /**
   * Max cost in cents per gift. If the handler reports cost above
   * this, the engine logs a warning but still credits the gift.
   * Set 0 to disable budget tracking.
   */
  costBudgetCents?: number;
  /**
   * Async handler that produces the actual MV. The engine has
   * already created the audit row and resolved the target by the
   * time this is called.
   */
  generate(args: GenerateArgs): Promise<GenerateResult>;
}

export interface FireTriggerArgs {
  triggerKey: GiftTriggerKey;
  targetUserId: string;
  payload?: Record<string, unknown>;
  livemode?: boolean;
  /**
   * Override the timezone used for quiet-hours calculation. Useful
   * for testing — production reads it off the user's preferences.
   */
  forceTimezone?: string;
}

export interface FireTriggerResult {
  status: GiftStatus;
  auditId: string | null;
  workId: string | null;
  reason?: string;
}

/**
 * Constant: the cssOS Curator's user_id. All system gift MVs are
 * inserted with this owner_user_id so they inherit the #266
 * anti-self-dealing rule (free + priceless + non-transferable).
 */
export const CSSOS_SYSTEM_USER_ID =
  "00000000-0000-0000-0000-000000000001" as const;

export const CSSOS_SYSTEM_USER_EMAIL = "system@cssstudio.app" as const;
export const CSSOS_SYSTEM_USER_DISPLAY_NAME = "cssOS · Curator" as const;
