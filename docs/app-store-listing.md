# cssOS Studio — App Store Connect Listing (Wave 118)

This document mirrors what you'll paste into App Store Connect when you
submit the iOS native build. Keep in sync with the actual product.

---

## App Information

| Field | Value |
|---|---|
| **App Name** | cssOS Studio |
| **Subtitle** | AI Music Videos from Civilization |
| **Bundle ID** | `app.cssstudio.studio` |
| **SKU** | `cssos-studio-v1` |
| **Primary Category** | Music |
| **Secondary Category** | Entertainment |
| **Content Rating** | 12+ (mild references to historical conflict, music with mature themes possible) |
| **Privacy Policy URL** | https://cssstudio.app/privacy.html |
| **Terms of Use URL** | https://cssstudio.app/terms.html |
| **Support URL** | https://cssstudio.app/business.html |
| **Marketing URL** | https://cssstudio.app |

---

## App Privacy (matches privacy.html §9 exactly — do not diverge)

### Data Linked to User

- **Contact Info → Email Address**
  - Purposes: App Functionality, Account Management
  - Not used for tracking
- **Identifiers → User ID**
  - Purposes: App Functionality, Analytics
  - Not used for tracking
- **Identifiers → Device ID** (APNs token only)
  - Purposes: App Functionality (push notifications)
  - Not used for tracking
- **User Content → Other User Content** (lyrics, prompts, MVs)
  - Purposes: App Functionality
  - Not used for tracking
- **Usage Data → Product Interaction**
  - Purposes: Analytics, App Functionality
  - Not used for tracking
- **Diagnostics → Crash Data**
  - Purposes: App Functionality
  - Not used for tracking
- **Diagnostics → Performance Data**
  - Purposes: App Functionality
  - Not used for tracking

### Data NOT Collected
- Precise/Coarse Location
- Health & Fitness
- Financial Info (beyond Apple-handled receipts)
- Sensitive Info
- Contacts
- Photos or Videos (we do not request photo library access)
- Audio Data (we do not request microphone access)
- Browsing/Search History
- Other Data

### Third-Party Partners
- Apple — Sign in with Apple (Identifiers)
- Stripe — Payment processing (we do not store card details)
- OpenAI / Anthropic — AI inference (User Content sent for processing, not retained beyond inference)
- ACRCloud — Audio fingerprinting (audio of works tagged Public + creator opt-in only)

---

## Description (English — paste into "Description")

cssOS Studio turns a few words into a complete music video.

Pick a historical figure (Beethoven, 孔子, Napoleon), a place (Musikverein, 杏坛, Arc de Triomphe), or a mythological pairing (孙悟空 × 凌霄宝殿). Our AI orchestrates lyrics, cover art, music, video, and subtitles into a finished MV — usually in under 5 minutes.

Features:
• Over 70 curated historical figures + 60 landmarks across Chinese, Greek, Roman, Egyptian, Persian, Indian, Japanese, and European civilizations
• Mythological and literary realms — Sun Wukong, Zeus, Harry Potter, Sherlock Holmes
• Cross-realm Dialogue MV: pair anyone with anywhere
• Six work types: single, triptych, opera, short play, TV series, film cue
• Conversational AI assistant — describe what you want, the agent builds the seed
• Full lyrics control — paste your own or have AI write them in any language
• Bring-your-own audio: upload an .mp3 and we generate the visuals
• Provenance fingerprint — every MV is auto-fingerprinted; anyone can verify origin at cssstudio.app/verify
• Marketplace — license your works (listen pass / buyout / tip) directly with creators

Subscription tiers unlock higher quotas, premium engines (Suno, Kling, Runway), and longer videos. Free tier always available.

---

## What's New (v1.0)

Initial release.

---

## Keywords (100 chars max, comma-separated)

`AI music,music video,MV,creator,lyrics,Chinese history,Confucius,Napoleon,Beethoven,opera`

---

## Promotional Text (170 chars — appears above description, can change without resubmission)

Compose an opera about Confucius. Generate a Beethoven × Musikverein triptych. Make an MV from any historical pairing — in under 5 minutes.

---

## In-App Purchases — Product IDs to Create in App Store Connect

Match these IDs **exactly** (case-sensitive) with `IAP_PRODUCT_CATALOG` in `src/index.ts`:

### Auto-Renewable Subscriptions
| Product ID | Reference Name | Subscription Group | Duration | Price (USD) |
|---|---|---|---|---|
| `app.cssstudio.studio.starter.monthly` | Starter Monthly | cssOS Studio | 1 Month | $4.99 |
| `app.cssstudio.studio.pro.monthly` | Pro Monthly | cssOS Studio | 1 Month | $14.99 |
| `app.cssstudio.studio.studio.monthly` | Studio Monthly | cssOS Studio | 1 Month | $49.99 |
| `app.cssstudio.studio.starter.annual` | Starter Annual | cssOS Studio | 1 Year | $49.90 |
| `app.cssstudio.studio.pro.annual` | Pro Annual | cssOS Studio | 1 Year | $149.90 |
| `app.cssstudio.studio.studio.annual` | Studio Annual | cssOS Studio | 1 Year | $499.90 |

### Consumable Credit Packs
| Product ID | Reference Name | Credits | Price (USD) |
|---|---|---|---|
| `app.cssstudio.studio.credits.100` | 100 Credits | 100 | $0.99 |
| `app.cssstudio.studio.credits.500` | 500 Credits | 500 | $4.99 |
| `app.cssstudio.studio.credits.2000` | 2000 Credits | 2000 | $14.99 |
| `app.cssstudio.studio.credits.10000` | 10000 Credits | 10000 | $49.99 |

---

## App Store Server Notifications V2

Configure in App Store Connect → My Apps → cssOS Studio → App Information → App Store Server Notifications:

- **Production Server URL**: `https://cssstudio.app/api/iap/apple/notifications`
- **Sandbox Server URL**: `https://cssstudio.app/api/iap/apple/notifications` (same; server identifies environment from JWS payload)
- **Version**: Version 2 (JWS)

---

## Required ENV vars on api-vm before submitting

```bash
# App Store Connect → My Apps → cssOS Studio → App Information →
#   App-Specific Shared Secret → Generate
ssh api-vm 'sudo bash -c "echo APPLE_IAP_SHARED_SECRET=<hex-from-app-store-connect> >> /etc/cssos.env && echo APPLE_IAP_BUNDLE_ID=app.cssstudio.studio >> /etc/cssos.env && systemctl restart cssOS.service"'

# Apple Developer → Certificates → Merchant IDs → cssOS →
#   Apple Pay Payment Processing → "Add Domain" cssstudio.app →
#   Download Domain Verification File → paste contents (single line):
ssh api-vm 'sudo bash -c "echo APPLE_PAY_DOMAIN_ASSOCIATION=<paste-file-contents> >> /etc/cssos.env && systemctl restart cssOS.service"'
```

---

## Pre-Submission Checklist (Wave 118 finale)

- [ ] All 10 IAP products created in App Store Connect (status: "Ready to Submit")
- [ ] App-Specific Shared Secret pasted into `/etc/cssos.env` as `APPLE_IAP_SHARED_SECRET`
- [ ] Server Notifications URL configured (production + sandbox both)
- [ ] Domain Verification File contents pasted as `APPLE_PAY_DOMAIN_ASSOCIATION`
- [ ] Sign in with Apple capability enabled in Xcode (entitlements + cap)
- [ ] Push Notifications capability enabled in Xcode
- [ ] App icons (1024×1024 + asset catalog) added
- [ ] Screenshots taken on iPhone 6.7" + iPad 13" (3-10 per device)
- [ ] Privacy Policy URL reachable (curl https://cssstudio.app/privacy.html → 200)
- [ ] Terms of Use URL reachable
- [ ] TestFlight internal build distributed to 1+ tester, all 10 IAP products purchased in sandbox successfully
- [ ] At least one full purchase → verify → grant cycle smoke-tested end-to-end
- [ ] App Review Information filled (test account credentials + notes about agent / fingerprint features)
- [ ] Export Compliance — uses standard encryption (HTTPS only); no custom crypto

---

## Reviewer Notes (paste into "Notes for App Review")

Demo account:
- Email: `apple-review@cssstudio.app`
- Password: `<set this in App Store Connect at submission time>`

This account is pre-provisioned to Pro tier, so reviewers can exercise every feature without making real purchases. To test the purchase flow, reviewers can use Apple's sandbox tester account on a fresh user.

Key features to review:
1. Open 💬 in bottom-right → ask "Create a Confucius opera" → agent proposes seed → tap "Create this MV"
2. Open Person MV panel → tap any S-tier figure → tap a notable event → MV pipeline runs
3. Open Works Center → see all generated MVs with 🔐 fingerprint badge
4. Tap 🔐 on any card → opens /verify in browser → can drop the MP3 back in to verify provenance

All payment buttons in iOS native build route exclusively to Apple StoreKit (per Guideline 3.1.1). The WeChat / Alipay buttons visible on the web build are hidden in native via `app.ios-native-gate.js`.

The cssOS Studio brand and all curated historical/landmark data is created and maintained by us; no scraped commercial content is included.
