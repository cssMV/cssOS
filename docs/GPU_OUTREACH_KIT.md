# CSS Studio — GPU / Compute Outreach Kit (NVIDIA + Google)

**Purpose:** re-open the compute conversation now that the "features incomplete"
objection is dead — CSS Studio is feature-complete AND live across all six Apple
platforms. Follow-up target: **Tue Jul 14, 2026** (also PH launch day — use it as the hook).

**Positioning rule (别再喊 AI):** lead with the RESULT ("open it, a music video is
already playing; make yours in a sentence"). AI belongs in how-it-works, never the hook.

**Fill before sending:** replace every `[…]` placeholder with a real number. Don't
invent metrics; if a number is thin, omit it rather than pad.

---

## 1. The "why-GPU" argument (the 命门 — everything else hangs off this)

A compute gatekeeper's first question is **not** "is the product complete?" — it's
**"you already buy inference from APIs; why do you need *your own* GPU?"** If that isn't
airtight, full-ecosystem coverage won't move a single card. Here is the airtight version.

**Today:** CSS Studio orchestrates *rented* third-party inference (an Anthropic-style
model gateway for image/video/music/chat; ElevenLabs for voice + speech-to-text). That
was the right call to prove the thing that's actually hard — the **product**: a
result-first "it's already playing" UX, the world's first **emotion-synced subtitles**,
digital-actor face-to-face, and shipping the whole stack across six Apple platforms
solo. Renting inference got us here. It cannot get us where we're going, for three
structural reasons — each of which **only owned compute solves**:

**(a) Quality ceiling — rented general-purpose video APIs can't carry our signature.**
Our output isn't "a clip." It's a fully-produced piece with emotion-synced subtitles,
per-persona/civilization coherence, and continuity across an entire MV → short drama →
film. General-purpose video APIs are not fine-tunable to that signature; we hit their
ceiling. Owned GPU lets us **train/fine-tune our own video + subtitle-aligned models** —
the viral-grade, coherent output rented APIs structurally cannot produce.

**(b) Unit economics — pay-as-you-go collapses at launch scale.**
Our wallet model passes vendor cost through. At Product-Hunt-launch volume the per-call
vendor markup crushes margin. Owned compute flips COGS from **per-call markup → amortized
capex**, which is the only path to sustainable gross margin at scale.

**(c) Latency — "already playing" is the product, and round-trips cap it.**
The entire identity is *instant, streaming, already playing* — text/lyrics/frames flowing
in as they generate, live face-to-face with a digital actor. Round-tripping every frame
to a third-party API structurally caps how instant and streaming we can be. **Local GPU
inference is the only way to deliver the real-time studio** — especially face-to-face and
live short-drama/opera.

**Proof we can actually use the compute:** a solo founder who built and shipped a live,
paying product across all six Apple platforms is not going to let an allocation sit idle.
Execution risk is already retired in public.

**The unlock (what the compute buys *them* as a proof point):** on GPU we ship **1–2
genuinely viral real videos in each format — MV, trilogy, opera, short drama, TV series,
film** — flagship demonstrations of NVIDIA/Google silicon powering a new consumer
creative category.

> One-liner: *We rented inference to prove the product. We hit the quality, cost, and
> latency walls that only owned GPU breaks through — and we've already proven we can ship.*

---

## 2. One-pager (result-first; answers objections 1–5 head-on)

**CSS Studio — the creative studio that's already playing.**
Open it and a fully-produced music video is already playing, with sound. Say one line and
it makes yours — any language, any voice, the world's first emotion subtitles. Live today
across **iPhone · iPad · Mac · Apple Watch · Apple TV · Vision Pro.**

**Traction (fill real numbers):** [works created] pieces made · [DAU/MAU] active ·
[paying users / MRR] · Product Hunt launch Jul 14, 2026 · solo-founded, 100% owned,
US entity (CSS Studio LLC, Washington DC).

**Why we're raising compute — and why now:**
- **Quality:** rented video APIs can't be fine-tuned to our emotion-subtitle /
  persona-coherence signature. Owned GPU = train our own models = viral-grade output.
- **Cost:** pay-as-you-go passes vendor markup through; owned compute flips COGS to
  amortized capex → margin at scale.
- **Latency:** the "already playing" real-time studio (face-to-face, live drama) needs
  local inference, not API round-trips.

**Objections, answered (the 1–5):**
1. *"Why your own GPU vs. keep renting?"* → §1 above: quality ceiling, unit economics,
   latency — all structural, all owned-compute-only.
2. *"Traction is just output volume."* → We show [DAU], [retention], [MRR]; PH launch is
   the top-of-funnel event. Honest that it's early-stage, with the curve to prove it.
3. *"Show us the output."* → 60-second reel (§5): today's ceiling on rented inference →
   what GPU unlocks. Output is the whole pitch; we lead with it.
4. *"Responsible AI / likeness."* → Digital actors ship with likeness/rights guardrails,
   content-safety filters, and misuse protections; happy to walk through our policy.
5. *"Can a solo founder use an allocation?"* → Already shipped a live, paying product
   across all six Apple platforms alone. Execution is de-risked in public.

**Clean, not a gap:** US entity (Washington DC) — no GPU export-control friction.

**The ask (make specific before sending):** [N × H100 / DGX Cloud hours / $ credits] to
[train our video+subtitle model / serve real-time face-to-face], targeting 1–2 viral
flagship videos per format within [timeframe].

---

## 3a. NVIDIA follow-up email (Inception / DGX Cloud / GPU)

**Subject:** CSS Studio — feature-complete + live across all six Apple platforms (re: our earlier conversation)

Hi [Name],

When we last spoke, the feedback was that the platform's features weren't complete yet.
That gap is now closed — and then some: **CSS Studio is feature-complete and, as of this
week, live across the entire Apple ecosystem — iPhone, iPad, Mac, Apple Watch, Apple TV,
and Vision Pro.** We're also launching on Product Hunt today (Jul 14).

Quick reminder of what it is: you open CSS Studio and a fully-produced music video is
already playing — say one line and it makes your own, in any language, any voice, with the
world's first emotion subtitles.

Where NVIDIA comes in: we've proven the product on *rented* inference, and we've now hit
the three walls only owned compute breaks — model quality (fine-tuning our own
video+subtitle models), unit economics at launch scale, and the real-time latency our
"already playing" studio depends on. With DGX Cloud / GPU access we'd ship 1–2 flagship,
viral-grade videos in each format — MV, short drama, opera, film — as public proof of
NVIDIA silicon powering a new consumer creative category.

Traction: [works], [DAU/MAU], [MRR], PH launch today. Solo-founded, US entity (CSS Studio
LLC, DC) — no export-control friction.

Could we re-open the Inception / compute conversation, or could you point me to the right
program? Specific ask: [N × H100 / DGX Cloud hours] for [workload].

Thank you,
Jing Du · Founder, CSS Studio · [email] · [links: App Store, cssstudio.app, PH]

---

## 3b. Google follow-up email (Google for Startups Cloud / Vertex / TPU-GPU)

**Subject:** CSS Studio — live across all six Apple platforms, launching on Product Hunt today

Hi [Name],

Following up with real news: **CSS Studio is now feature-complete and live across the full
Apple ecosystem — iPhone, iPad, Mac, Apple Watch, Apple TV, and Vision Pro** — and we're
launching on Product Hunt today (Jul 14).

What it is: open it and a fully-produced music video is already playing; say one line and
it makes yours, any language, any voice, with the world's first emotion subtitles.

Why Google Cloud: we validated the product on rented inference and hit the quality, cost,
and latency walls that only owned compute solves — we want to train our own
video+subtitle-aligned models and serve the real-time, "already playing" studio experience
(including live face-to-face with digital actors). We build responsibly: our digital
actors ship with likeness/rights guardrails, content-safety filtering, and misuse
protections — happy to walk your team through the policy.

Traction: [works], [DAU/MAU], [MRR], PH launch today. Solo-founded, US entity.

Is CSS Studio a fit for the Google for Startups Cloud Program (AI track), and who's the
right person to talk to about credits / Vertex / GPU access? Specific ask: [$ credits /
GPU allocation] for [workload].

Thank you,
Jing Du · Founder, CSS Studio · [email] · [links]

---

## 4. Cadence

- Sent original outreach ~week of Jul 7. **Follow up Tue Jul 14** (this kit + PH-launch hook).
- No reply by ~Jul 21 → one more short nudge, then move on / find a warm intro (VC, accelerator, Apple/dev relations).
- Formal programs (NVIDIA Inception, Google for Startups) respond in ~1–4 weeks; cold BD may never reply — that's normal, not a no.

---

## 5. 60-second demo reel — script / storyboard (build once PH assets are ready)

Goal: output-first. In 60s prove (a) the "already playing" magic, (b) emotion subtitles,
(c) the format range, (d) the ceiling→GPU story. No talking-head, no logos-first.

| Time | Visual | Audio / on-screen text |
|---|---|---|
| 0:00–0:05 | Cold open: an MV **already playing** the instant the app opens (no menus). | Music hits immediately. Text: "You didn't press play. It was already playing." |
| 0:05–0:15 | User says one line; MV assembles live — lyrics/frames streaming in. | Text: "Say one line → a full music video." |
| 0:15–0:25 | Close-up on **emotion subtitles** reacting to the vocal. | Text: "The world's first emotion subtitles." |
| 0:25–0:38 | Fast montage: same engine → MV · short drama · opera · film frame. | Text: "One studio. Every format." |
| 0:38–0:48 | Face-to-face with a digital actor, talking live. | Text: "Talk to it. Live." |
| 0:48–0:56 | Split: "today (rented inference)" vs a bolder "on GPU" target frame. | Text: "This is the ceiling on rented compute. GPU breaks it." |
| 0:56–1:00 | Six Apple device silhouettes light up; end card. | Text: "Live on all six Apple platforms. cssstudio.app" |

Notes: keep the last 12s as the compute pitch — it's what NVIDIA/Google actually watch for.
Pull the best real outputs from the PH launch set for 0:00–0:38.
