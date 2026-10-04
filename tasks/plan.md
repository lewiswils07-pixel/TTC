# Implementation plan: Sodalis Collective members platform

Status: **DRAFT.** The order may change once Lewis approves the spec.
Spec: `docs/spec/SPEC-members-platform.md` · Intent: `docs/intent/members-platform.md`
Task list: `tasks/todo.md`

## Overview
We have 6 weeks, from Monday 5 October to Friday 13 November 2026. The work is built in vertical
slices: each week ends with something a person can actually use, tested end to end. The riskiest
items go early: row-level security, matching and store accounts. The longest outside waits start
on day one: Apple's D-U-N-S number and app approval.

## Architecture decisions
- **Separate app, same repo.** `app/` is a Vite + React + TypeScript app deployed as its own
  Netlify site. The marketing site stays static and untouched apart from its links.
- **The database enforces the rules.** Limits, blocks, privacy and Sodalis+ access are all checked
  in Postgres row-level security and SQL functions. The app can't get around them, and pgTAP
  tests prove it.
- **One membership record.** Stripe and the app stores both send updates through webhooks into
  one `entitlements` table, with RevenueCat as the go-between for the apps.
- **Secrets stay on the server.** The Claude, Stripe, Twilio and Resend keys live only in Supabase
  Edge Function secrets.
- **Capacitor from week 1.** The app is packaged as an iPhone and Android app from the first week,
  so phone-only problems (keyboard, safe areas, push) show up early, not in week 6.

## Timeline

| Week | Dates | Goal: what works by Friday |
|---|---|---|
| 0 | 3–4 Oct | Lewis opens the accounts (see "Lewis's checklist" in `tasks/todo.md`) |
| 1 | 5–9 Oct | App skeleton is live; members can sign in with an email code, pass the phone check and build a profile |
| 2 | 12–16 Oct | Trips; suggestions in both modes with filters; connection requests, accept and decline, limits |
| 3 | 19–23 Oct | One-to-one chat, block, report, scam guard, moderation page, email nudges, delete and export account |
| 4 | 26–30 Oct | Groups and group chat; trip planner agent and shared plan board; **founding-member beta starts 30 Oct** |
| 5 | 2–6 Nov | Sodalis+ (Stripe and RevenueCat), ID verification, push notifications; **apps submitted by 6 Nov** |
| 6 | 9–13 Nov | Launch check, security review, beta fixes, legal pages final; **go live** |

## Checkpoints (reviewed with Lewis)
- **9 Oct:** Lewis signs in on his phone and builds a profile. pgTAP passes for identity and
  profiles.
- **16 Oct:** two test accounts with overlapping trips see each other in the right order and can
  connect. Limits hold.
- **23 Oct:** a full conversation works, including a scam warning and a report showing on `/admin`.
- **30 Oct:** a group of 3 plans a trip with the agent. Beta invites go out.
- **6 Nov:** Sodalis+ purchase works on web, iPhone and Android sandbox. Both apps are submitted.
- **13 Nov:** every success criterion in spec §14 is green.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Apple company account waits on a D-U-N-S number (1–2 weeks) | High | Start on 3 or 4 October. Fall back to an individual account if it isn't ready by 23 October. |
| App store review rejects or delays the apps | High | Submit by 6 November, leaving a week for fixes. Follow Apple's rules for apps where users post content (block, report, moderation, account deletion), which are all already in scope. The website launches regardless, with "App coming soon". |
| In-app purchase setup (tax forms, agreements, products) is slow | Med | Lewis fills in the Apple and Google tax and bank forms in week 0. RevenueCat products are configured in week 4. |
| Six weeks is tight for this scope | High | Groups and the planner are weeks 4–5. If week 2 or 3 slips, the planner falls back to the hand-picked activity list and the AI version follows within 2 weeks of launch. |
| Row-level security mistakes leak private data | High | pgTAP tests for every policy, run in CI. Security review in week 6. |
| Building iPhone apps needs a Mac | Med | Lewis has a Mac; GitHub's Mac machines are the backup. |
| Trip planner gives wrong or outdated information | Med | Source links on every item, a "check before you go" note, the Collective's own activity lists preferred, and a manual review of 10 sample plans. |
| Cost creep (SMS, AI, ID checks) | Low | Monthly caps in each provider's console and in our usage counters. A weekly cost check during beta. |

## Parallel work (Lewis, alongside the build)
- Marketing plan and building interest, plus recruiting 15–25 founding members for the beta.
- Final privacy policy, terms and cookie notice.
- App store listing text, screenshots (we can generate them) and the support email.
