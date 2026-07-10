# CSS Studio — YC Application · Product Hunt Kit · Finalized Investor Emails

**Drafted for Jing to review, then submit/send himself.**
Rules: every `[bracket]` = fill it (links, numbers). Metrics below are from the Investor Brief
(as of **2026-06-04**) — **refresh to current real numbers before submitting.** Never inflate.

- **50-char pitch:** `Open the app — a music video plays, with sound.` (47 chars)
- **One-liner:** The first zero-friction *watch + create* platform for AI music videos —
  audible full-screen from the first second, and you create your own in the same cinema.
- **Demo video (60s):** https://youtu.be/g-9L4zG5lKI  ·  **Live app:** https://cssstudio.app  ·  **Deck:** `[deck link]`

---

# PART 1 — Y Combinator Application (full answers)

> YC bets on **founder + product + wedge** at this stage, and values **short, concrete, honest**
> answers. Keep the video demo as the real convincer.

**Company name:** CSS Studio

**Company URL:** https://cssstudio.app

**Demo video (≤1 min, show the product, no slides):** https://youtu.be/g-9L4zG5lKI — *film your screen: open app →
a full MV plays WITH SOUND → type one line → it generates and plays in the same full-screen panel
→ tap "add a language" → same visuals, new language/voice.*

**Describe what your company does in 50 characters or less:**
> Open the app — a music video plays, with sound.

**What is your company going to make? (product, what it does):**
> CSS Studio is a *destination* for AI music videos, not another generation tool. Open the app and
> a fully-produced music video plays instantly — audible, full-screen, zero gestures. Type one line
> and it generates and plays in the **same** cinema panel. The core architectural bet: we never burn
> lyrics, audio and video into one file — they stay separate layers, so **any work is instantly
> re-voiceable and re-languageable** (one tap: same visuals, new language, new voice). Generation
> is done by third-party models on our backend; the client just sends a lightweight command and
> plays the result — so watching *and* creating live in one screen with no friction.

**Why did you pick this idea? Domain expertise? How do you know people need it?**
> Generation got cheap this year — Suno makes songs, Sora makes clips — but they all hand you a
> *file to download*. There is no **place to enjoy AI video-with-sound**, and no consumption +
> distribution layer. I've solo-built the whole platform (layered audio/video pipeline,
> civilization-aware generation, in-cinema creation, self-healing infra), so I know exactly where
> the friction and the moat are. People already resort to stitching Suno + a video tool by hand;
> we remove that entirely and make the result watchable and shareable like TikTok, but with sound
> and creation built in.

**What's new about what you're making? What do people use instead today?**
> New: **layered, separable output** (lyrics/audio/video never burned together) + a **zero-gesture
> audible cinema feed** + **in-cinema creation** in one surface. Substitutes today: Suno/Udio for
> audio, Sora/Kling/Runway for silent clips, then manual editing to combine — no one delivers a
> place to *watch* the finished, sounded result, let alone re-voice it into any language in one tap.

**Who are your competitors? What do you understand that they don't?**
> Suno/Udio (audio-only), Sora/Kling/Runway (video-only, silent), TikTok-style feeds (human-made).
> What they miss: the durable consumer value is in **owning the consumption + distribution layer**,
> not the model — and the way to own it is to **keep the layers separate**, which turns every work
> into an infinitely re-languageable, tradeable asset. It's an architecture + surface choice, not a
> model you can copy by fine-tuning.

**How do or will you make money? How much could you make?**
> Revenue surfaces are already wired: pay-per-generation credits, a paid background-generation
> queue, an in-panel works **marketplace** (works are tradeable assets), a per-work **"add a
> language" upsell**, and subscription (priority queue, higher cover/frame pools). Future:
> ad-supported free tier, creator rev-share, and IP licensing of long-form. Path to scale: MV →
> short-drama (微短剧, a proven multi-billion market) → series → multi-thread 3D film, each rung
> reusing the same layered pipeline and expanding TAM.

**How far along are you? What's built?**
> **Product-complete, pre-launch.** Built and live: zero-gesture audible autoplay (survives muting
> the picture, works on car/Tesla browsers), audio↔video separation at scale, multi-language/voice
> capsule on every work, civilization-aware generation, an in-cinema AI assistant, a self-healing
> error→fix pipeline (human-gated deploys), and a structured multi-part pipeline built for
> 50-act / 1,500-piece works. Native apps shipping across iPhone, Apple TV, Apple Watch, and
> Vision Pro (spatial cinema).

**Real usage / traction so far (live DB, as of 2026-07-08):**
> Built-product depth: **2,327** user works + **536** persona MVs; **147** works in the last 30 days;
> **~1,200** independent audio stems (audio_track_1+2) + **1,274** language tracks; **70,155**
> slideshow frames; **5,376** credit/generation events; **31** registered users; **26** billing accounts.
> **Commerce — pre-revenue, stated honestly:** **66** payment *attempts* (real intent-to-pay), but
> checkout conversion is ~0 so far — turning that funnel on is a first post-raise milestone, **not a
> claim of revenue.**
> **Honest gap:** ~31 registered users — public user acquisition hasn't started; that's what this raise is for.

**Are people using it? (yes/no):** Yes — small but real; pre-marketing.

**How will you get users?**
> Launch the shareable loop: every work exports a **watchable, sounded social clip** (og:video) that
> links back into the app (the Face-on-Face / MV share cards already do this) → organic TikTok/X/
> Reddit distribution. Seed with civilization/legend content that travels across languages. Creator
> outreach (the "add a language" funnel gives creators a reason to bring their audience). Product
> Hunt + AI-community launch. Paid tests only after organic loop is measured.

**Have you incorporated? Where?** Yes — **CSS Studio LLC**, Washington, DC (USA).

**Founders (name, %, role, technical?):** **Jing Du — 100% — solo founder/CEO, writes all the code.**

**Founder bio (Jing Du, based in Washington, DC — can meet in person):**
> I'm a software engineer and lifelong music lover — the exact combination this product needs. I
> realized no platform or app takes a story the whole way — lyrics → music → video → triptych →
> opera → short-drama → series → film — in one place, so I built the first one that does, **solo**:
> every line of the frontend, backend, and native apps (iPhone, Apple TV, Watch, Vision Pro) is
> mine. An engineer's speed plus a musician's ear is how CSS Studio got this deep in 7 months.

**Are the founders full-time?** Yes.

**How long have you worked on this?** 7 months full-time, solo.

**Anything else we should know? (optional):**
> Solo-built a platform this deep and self-healing at this speed. I'd use YC to launch, prove
> D1/D7/D30 retention + monetization, and ship one long-form format (short-drama) end-to-end.

---

# PART 2 — Product Hunt Launch Kit

> PH rewards: a crisp tagline, a great gallery (video first), a strong **maker's first comment**,
> and rallying your network in the first 2–3 hours. Launch **Tue–Thu, 12:01am PT.**

**Name:** CSS Studio

**Tagline (≤60 chars) — pick one:**
- `Open the app — a music video plays, with sound` (46)
- `Watch + create AI music videos, instantly` (41)
- `The audible cinema for AI music videos` (38)

**Topics/tags:** Artificial Intelligence · Music · Video · Design Tools · Entertainment

**Short description (the one-liner under the tagline):**
> Suno makes the song, Sora makes the clip — CSS Studio is where you actually **watch** it: open
> the app and a full music video plays with sound, then create your own in the same screen.
> Every work is re-voiceable into any language in one tap.

**Maker's first comment (post it the second you launch):**
> Hey Product Hunt 👋 I'm Jing, solo maker of CSS Studio.
>
> I kept hitting the same wall: AI can make a *song* (Suno) or a *silent clip* (Sora), but there was
> nowhere to just **watch** a finished, sounded music video — and nowhere to make one without
> juggling three tools. So I built the missing layer.
>
> Open CSS Studio → a fully-produced music video plays instantly, full-screen, **with sound**, zero
> gestures. Type one line → it generates and plays in the *same* cinema. And because I never burn
> lyrics/audio/video into one file, **any work re-voices into any language with one tap** — same
> visuals, new voice.
>
> It's native on iPhone, Apple TV, Apple Watch, and Vision Pro (spatial cinema). It's early and
> pre-launch — I'd love your brutally honest take on the *watch-then-create* loop. AMA! 🎬
>
> 👉 https://cssstudio.app  ·  60-sec demo: https://youtu.be/g-9L4zG5lKI

**Gallery (order matters — video/GIF FIRST):**
1. **Autoplaying MV loop** (10–15s, audible if PH allows, else captioned) — the "it just plays" wow.
2. GIF: type a line → it generates → plays in the same panel (the in-cinema create loop).
3. One-tap **"add a language"** → same visuals, new language/voice (the moat, visually).
4. The **emotion-subtitle burst** signature (a striking still).
5. Multi-device shot: iPhone + Apple TV + Vision Pro spatial cinema.
6. A clean feature/benefit summary card (dark cinematic theme).

**Launch-day cadence:**
- 12:01am PT Tue/Wed/Thu — post + maker comment immediately.
- First 2h: DM your warm network (don't ask for "upvote" — ask "would love your feedback"), share
  in relevant Slacks/Discords/X. Reply to **every** comment within minutes.
- Have 1–2 supporters ready to leave substantive first comments (not "congrats").
- Cross-post to X/Reddit r/artificial, r/SideProject with the demo clip.
- **Consider a known hunter** for reach (optional; self-launch is fine).

---

# PART 3 — Finalized Investor Emails (fill `[brackets]`, then send yourself)

> Best path = **warm intro**. Use A first with your network; B for warm; C only if no intro.
> Keep them <120 words. One ask, one link. The live demo converts — lead people to it.

## A. Warm-intro REQUEST (to someone who knows the investor)
**Subject:** Quick intro to [Investor name]?

Hi [Friend], hope you're well! I've been heads-down building **CSS Studio** — open the app and a
music video plays, *with sound*, instantly; then you create your own in the same screen. It's the
"watch + create" layer for AI video that Suno (audio-only) and Sora (video-only) don't do.

I'm raising a small pre-seed and would love a warm intro to **[Investor]** — feels aligned with
their thesis on [consumer AI / creator tools / media]. 60-sec demo: https://youtu.be/g-9L4zG5lKI

No worries if it's not a fit — thank you either way!
— Jing

## B. Direct to investor — WARM (you were introduced)
**Subject:** CSS Studio — the audible, in-cinema "watch + create" layer for AI video

Hi [Investor], thanks [Referrer] for connecting us.

**CSS Studio:** open the app → a fully-produced music video plays *with sound*; type one line → it
generates and plays in the same full-screen cinema. Suno is audio-only, Sora is video-only — we own
the experience, keeping lyrics/audio/video as separate layers, so any work is instantly re-voiceable
into any language.

Product is built and live; we're pre-launch, raising a small pre-seed to launch and prove retention.
60-sec demo: https://youtu.be/g-9L4zG5lKI · Deck: `[deck link]`.

Could I show you a live 15-min demo next week?
— Jing · `[phone]` · `[calendar link]`

## C. Direct to investor — COLD (personalize line 1)
**Subject:** Open the app, a music video plays — with sound

Hi [Investor], reaching out because of your [investment in X / post on AI consumer apps] — this is
squarely in that lane. **CSS Studio** is the first zero-friction "watch + create" platform for AI
music videos: audible full-screen feed, and you create your own without leaving the cinema. The
wedge competitors miss: never burning audio/video together, so every work is multi-language &
multi-voice.

Built and live; pre-launch; raising a small pre-seed. 60-sec demo: https://youtu.be/g-9L4zG5lKI

Worth a 15-minute look?
— Jing · https://cssstudio.app

### Follow-up (if no reply after 5–7 days — send ONCE)
**Subject:** Re: [original subject]
> Hi [Name] — quick bump in case this slipped. 60-sec demo if useful: https://youtu.be/g-9L4zG5lKI · Happy to be told
> it's not a fit. Thanks!

---

## The ONE thing that makes all of this work
Record a killer **60-second screen demo** (open → it plays with sound → type a line → it plays in
the same panel → one-tap re-language). Every asset above points to it. **The demo is the pitch.**
