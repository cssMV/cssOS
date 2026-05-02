# cssOS Personalization Engine

Foundation module for "system gift" MVs — welcome, first subscriber,
milestones, plan changes, birthdays, anniversaries, feedback rewards.
Every gift flows through the same pipeline so cooldowns, cost budgets,
quiet hours, and audit logging are enforced uniformly.

## Stage A scope (this commit)

- DB migration `migrations/018_personalization_engine_foundation.sql`
  - `user_preferences` table (birthday, opt-out, quiet hours, terms)
  - `system_gift_audit` table (every trigger leaves a row)
  - `cssOS · Curator` system pseudo-user (id `00000000-0000-0000-0000-000000000001`)
- TypeScript scaffold (this directory)
  - `types.ts` — shared types + sentinel constants
  - `audit.ts` — read/write helpers for `system_gift_audit`
  - `preferences.ts` — read/upsert for `user_preferences`
  - `system-user.ts` — Curator lookup with cache
  - `rate-limiter.ts` — policy gates (opt-out, cooldown, annual cap, quiet hours)
  - `triggers.ts` — registry + dispatch
  - `index.ts` — public `fireTrigger()` entry point
- **No actual triggers registered yet.** That's Stage B.

## Pipeline

```
fireTrigger(q, { triggerKey, targetUserId, payload, livemode })
    │
    ├─ 1. Resolve trigger from registry
    ├─ 2. buildTargetSnapshot(q, userId)   — joins users + user_preferences
    ├─ 3. insertAuditRow(...)              — status='pending'
    ├─ 4. checkPolicies(q, trigger, target)
    │       ├─ master gift_opt_out         → 'opted_out'
    │       ├─ trigger.oneShot             → 'rate_limited' if ever delivered
    │       ├─ trigger.cooldownDays        → 'rate_limited' if too recent
    │       ├─ trigger.maxFiresPerYear     → 'rate_limited' if YTD cap met
    │       └─ trigger.respectQuietHours   → still allow but flag for queue
    ├─ 5. markGenerating(q, auditId)
    ├─ 6. trigger.generate({ target, payload, auditId, livemode })
    │       → returns { workId, costCents, templateId? }
    └─ 7. markDelivered / markFailed
```

## Adding a new trigger (Stage B+)

```ts
import { registerGiftTrigger } from "./personalization/index.js";

registerGiftTrigger({
  key: "welcome",
  oneShot: true,
  costBudgetCents: 50,         // pre-rendered template, near-zero cost
  async generate({ target, auditId }) {
    const workId = await createWelcomeMvForUser(target);
    return { workId, costCents: 5, templateId: "welcome.v1" };
  },
});
```

Then call from anywhere:

```ts
import { fireTriggerFireAndForget } from "./personalization/index.js";

// e.g. in the new-user signup completion handler:
fireTriggerFireAndForget(pool, {
  triggerKey: "welcome",
  targetUserId: newUser.id,
  livemode: true,
});
```

## Inviolable rules

1. **Every system MV is owned by `CSSOS_SYSTEM_USER_ID`.** Combined
   with the #266 anti-self-dealing rule (anything `@cssstudio.app`
   is free + priceless + non-transferable), system gifts inherit
   those exact semantics for free — no duplicated code.

2. **Errors thrown by handlers are caught at the engine boundary.**
   The caller is usually a webhook or cron; one bad gift must not
   derail the rest of the system. Inspect `system_gift_audit` for
   the failure reason.

3. **No PII in trigger payloads.** Payloads are stored as JSONB and
   replayed for debugging. Don't put credit-card last-4, social
   security numbers, or personal addresses in there.

4. **No marketing in gift MVs.** These are gifts. They thank the
   user. They do not promote the product, upsell, or solicit.
   Marketing campaigns live elsewhere.

## Quiet hours (Stage F preview)

`respectQuietHours: true` on a trigger means: if the recipient is
currently between their `quiet_hours_start_local` and
`quiet_hours_end_local` (default 23:00–07:00) in their local
timezone, the audit row stays in `status='pending'` and a future
flush job dispatches the gift after their morning starts.

Stage A's `checkPolicies` correctly _detects_ quiet hours and flags
the decision via `queueDueToQuietHours`, but the engine still fires
immediately — the deferred-flush job lands with the birthday cron
in Stage F.
