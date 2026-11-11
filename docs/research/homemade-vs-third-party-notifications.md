# What a home-made Notification feature can do vs what needs a third party

Research for issue #4 (map: #1 "Notifications"). Researched 2026-11-11.

This note lists facts. It does not decide build vs buy, or which channels to use. Those calls belong to later grilling tickets.

Terms follow `GLOSSARY.md`. A **Notification** is a message telling one **Recipient** that something new has happened. When something concerns many people, each of them gets their own Notification.

## Cadence's starting point (from the repo)

- React Router 8.3 framework mode with SSR, started with `react-router-serve` as **one Node process** (`package.json`).
- One SQLite file through `better-sqlite3` and Drizzle (ADR 0006). The ADR records the consequences: "one writer at a time" and "cannot run on more than one machine against the same data."
- No job queue. Nothing in `app/` uses `EventSource`, `text/event-stream`, service workers or websockets today.
- Email goes through `app/lib/mailer.server.ts`. It sends plain-text email to Postmark's `/email` endpoint on the `outbound` (default transactional) stream when `POSTMARK_SERVER_TOKEN` is set, and writes JSON files to `.outbox/` otherwise. It sets no custom headers, so there is no `List-Unsubscribe` today.

## Summary table

Effort is a rough guess for this stack and team. It assumes one kind of Notification with no types and no preferences (ADR 0013). S is about a day or two, M is under a week, L is more than a week. These are estimates, not measurements.

| Channel | Home-made feasible with the current stack? | Rough effort here | Hard third-party dependency? |
| --- | --- | --- | --- |
| In-app Notification list (bell, unread count, mark read) | Yes, fully. It needs a Drizzle table, loaders and actions, and UI. | S–M | **No.** |
| Live in-app updates (SSE) | Yes, because there is one process: an in-memory pub/sub plus a resource route that streams `text/event-stream`. It stops working unchanged if Cadence ever runs more than one process (ADR 0006 already rules that out). | S–M | **No.** |
| Email via Postmark (today) | Yes. The sending code exists. It would need `List-Unsubscribe` headers, an unsubscribe route, and possibly a Broadcast stream. | S–M | **Yes: Postmark** (already adopted). |
| Email, truly self-hosted (own MTA) | Technically yes (for example Postfix), but outside the Node app. Delivery to Gmail and Yahoo depends on DNS, PTR, port 25 and IP reputation. | L, plus ongoing operations | **Partly.** No vendor contract is needed, but the hosting provider must allow outbound port 25 and the mailbox providers decide whether mail lands. |
| Web push (Push API + VAPID + service worker) | The server side, client side and storage can all be home-made (for example with the open-source `web-push` npm package). Delivery always goes through the browser vendor's push service. | M | **Yes, unavoidably:** the browser's push service (Google's for Chrome, Mozilla's for Firefox, Apple's `*.push.apple.com` for Safari). No account or fee is needed. iOS only supports it for web apps added to the Home Screen. |
| Mobile push (native) | **No.** Cadence has no mobile app, and native push needs one. | L+ (the cost of building a mobile app) | **Yes:** APNs (Apple Developer account, app entitlement) and FCM (Firebase project) for Android. |
| SMS | **No.** A web app cannot send SMS without a carrier connection. | S to integrate, plus registration and compliance work | **Yes:** an SMS provider or aggregator (for example Twilio) and carrier registration such as US A2P 10DLC. |

## Channel by channel

### 1. In-app Notification list

Everything needed is already in the stack: a `notifications` table (Recipient id, message, link, created at, read at), a loader for the bell and unread count, and actions for "mark read" and "mark all read". No external service is involved.

What a provider would add here is a ready-made inbox widget (Novu `<Inbox />`, Knock feed components, Courier Inbox; see §7). These are UI and API shortcuts, not capabilities Cadence lacks.

### 2. Live in-app updates (SSE from one React Router process)

- A React Router **resource route** is a route module that exports a `loader` or `action` and no default component. Its loader can return any `Response` ([React Router: Resource Routes](https://reactrouter.com/how-to/resource-routes)). A `Response` whose body is a `ReadableStream` with `Content-Type: text/event-stream` is the standard way to serve SSE. The React Router docs give no SSE example, so this step comes from the Fetch/Streams standards and was not tested in Cadence.
- The SSE wire format is plain UTF-8 text: `data:`, `event:`, `id:` and `retry:` fields, with messages separated by blank lines. `EventSource` reconnects automatically ([MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)).
- Since Cadence is one process (ADR 0006), an in-memory `EventEmitter` keyed by Recipient is enough to push "you have a new Notification" to open tabs. No Redis or broker is needed. This holds only while there is one process.
- Limit: over HTTP/1.1, browsers allow only **6 connections per browser and domain**, shared across tabs. Over HTTP/2, the limit is negotiated (100 by default) ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)). Whether Cadence's deployment serves HTTP/2 depends on its proxy, which is not in the repo.
- Fallback without SSE: revalidating the bell loader on focus or on an interval needs no new infrastructure at all. #1 says live updates are nice to have, not required.

### 3. Email

**Through Postmark (current).** Postmark is itself a third party. Relevant facts:

- Postmark has **Transactional** streams ("one-to-one emails triggered by a user action") and **Broadcast** streams (one-to-many: announcements, newsletters), and recommends keeping them separate ([Postmark: message streams](https://postmarkapp.com/support/article/1207-how-to-create-and-send-through-message-streams)). Cadence sends on `outbound`, the default transactional stream.
- On Broadcast streams, Postmark "will also automatically add the one-click List-Unsubscribe-Post and List-Unsubscribe headers … compliant with RFC 8058". On transactional streams those headers are "not required", but if Cadence adds them Postmark includes them in the send ([Postmark: List-Unsubscribe header](https://postmarkapp.com/support/article/1299-how-to-include-a-list-unsubscribe-header)).
- `/email/batch` "accepts up to 500 messages per API call" (50 MB max), and custom headers go in a `Headers` array of `{Name, Value}` ([Postmark Email API](https://postmarkapp.com/developer/api/email-api)).
- Pricing: the free plan is 100 emails/month. Basic is $15/month for 10,000 emails, then $1.80 per 1,000 ([Postmark pricing](https://postmarkapp.com/pricing)).

**What "truly self-hosted" email would mean.** It means running Cadence's own MTA (for example Postfix) to deliver straight to recipients' mail servers on port 25. The mailbox providers' rules apply no matter who sends:

- Gmail requires these of all senders: SPF or DKIM, valid forward and reverse DNS (PTR), TLS, and a spam rate below 0.3%. PTR means "the public IP address of a sending SMTP server must have a corresponding PTR record" ([Gmail sender guidelines](https://support.google.com/a/answer/81126)).
- Cloud hosts often block the port. For example, "Google Cloud blocks egress packets sent to TCP destination port 25 of an external IP address" by default ([Google Cloud VPC firewall docs](https://docs.cloud.google.com/vpc/docs/firewalls)).
- So self-hosted email removes the vendor contract, but not the dependency on DNS, the hosting provider's network policy, or the mailbox providers' reputation systems. Relaying through any SMTP service (ports 465/587) is a third party again.

### 4. Web push (Push API, VAPID, service worker)

- Receiving push requires "an active service worker". The browser's `PushManager.subscribe()` returns a `PushSubscription` with an **endpoint** and encryption keys. "Knowledge of the endpoint is all that is necessary to send a message", so it must be kept secret ([MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)). The Push API has been Baseline across browsers since March 2023 (same page).
- Service workers only work in secure contexts (HTTPS, or `http://localhost` in development) ([MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)).
- Architecture (RFC 8030): the **user agent**, a **push service**, and the **application server**. "User agents are expected to be configured with a URL for a push service." The application server cannot choose the push service. It must send a `TTL`, and the push service "is not obligated to store messages indefinitely" ([RFC 8030](https://www.rfc-editor.org/rfc/rfc8030)). **This is the unavoidable third party:** even a fully home-made sender delivers through Google, Mozilla or Apple infrastructure. There is no account, fee or contract, but there is no control either.
- The push service answers **404 or 410** for expired or invalid subscriptions, and the server should delete them ([web.dev: Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol)).
- The Node `web-push` package handles payload encryption and VAPID signing. `generateVAPIDKeys()` creates the key pair: "create these keys once, store them and use them for all future messages" ([web-push on GitHub](https://github.com/web-push-libs/web-push)).
- Apple: web push works in Safari and in iOS/iPadOS 16.4+ **Home Screen web apps only**. That needs a web app manifest with `display: standalone` or `fullscreen`, and the permission request must come from a user gesture. "You do not need to be a member of the Apple Developer Program to use it." Allow `*.push.apple.com` if outbound traffic is restricted ([WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- Home-made work in Cadence: a service worker file, a manifest, a `push_subscriptions` table (one Recipient can have many), a subscribe action, VAPID keys in env, send-and-prune on 404/410, and a permission UX.

### 5. Mobile push (APNs / FCM)

- APNs needs a **device token** "unique to both the device and your app", received by the app at launch. You must "enable the Push Notifications capability in your Xcode project" and enable push for the App ID in your Apple developer account ([Apple: Registering your app with APNs](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns)).
- FCM is Google's cross-platform service for "Apple, Android, or web (JavaScript) client app[s]" ([Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)). It is listed among Firebase's no-cost products ([Firebase pricing](https://firebase.google.com/pricing)).
- Cadence has no mobile app, so this channel cannot exist until one does. On iOS, web push to a Home Screen web app (§4) is the only route that needs no native app.

### 6. SMS

- A web server cannot send SMS by itself. It needs a carrier connection, which in practice means an SMS API provider.
- In the US, application-to-person SMS over 10-digit numbers needs **A2P 10DLC registration** of a Brand and a Campaign (covering opt-in, opt-out and help). Unregistered traffic gets "additional carrier fees" and more filtering ([Twilio: A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc)). Other countries have their own sender-ID rules, which were not researched here.
- SMS is direct marketing under EU ePrivacy Article 13 when it promotes something (§9), just like email.

### 7. What notification providers add

Providers orchestrate. They **do not remove** the channel dependencies above: they still send through an email provider, APNs/FCM, browser push services and SMS carriers. Novu, for example, connects to Email (20), SMS (37), Push (8) and Chat (13) providers ([Novu README](https://github.com/novuhq/novu)).

Typical additions: a hosted inbox or feed UI component with real-time updates, digests and batching ("5 new lessons"), preference centres, cross-channel workflows (in-app first, email if unread), delivery and engagement logs, and retries and queueing on their side.

| Provider | Free tier (as published, Nov 2026) | Entry paid tier | Notes |
| --- | --- | --- | --- |
| Novu Cloud | 10,000 workflow runs/month, up to 5 workflows, 24-hour activity feed retention, 3 team members | Pro from $30/month (30k+ runs; extra runs $1.20 per 1k) | [Pricing](https://novu.co/pricing). Lists `<Inbox />` and `<Preferences />` components and digests. |
| Novu self-hosted (community) | Free, MIT core. The `enterprise/` folder is under a commercial licence ([repo](https://github.com/novuhq/novu)) | Self-hosted enterprise is part of Enterprise | Needs **MongoDB, Redis (AOF on the queue) and S3-compatible storage**, plus API, Worker, WS and Dashboard services. Single-VM minimum: 4 vCPU and 8 GB RAM. "Some features exclusive to Novu's cloud-managed solution will not be available" ([self-hosting overview](https://docs.novu.co/community/self-hosting-novu/overview)). That is several new services next to Cadence's one process and one SQLite file. |
| Knock | 10,000 messages/month | Starter $250/month, $0.005 per message beyond 50,000 | [Pricing](https://knock.app/pricing). Pre-built feed components, batching, preferences, logs on all plans. 30-day log retention on Free and Starter. |
| Courier | 10,000 sends/month (Developer) | Business $0.005 per send, pay-as-you-go | [Pricing](https://www.courier.com/pricing). Inbox and Preferences are products. **Digest and batching are listed under Enterprise.** |
| OneSignal | Email 10,000/month. Mobile push and in-app unlimited up to 1,000 MAU. Web push up to 10,000 subscribers per send. SMS available, no free quota stated | Growth from $19/month | [Pricing](https://onesignal.com/pricing). Strongest on push. |

Free-tier numbers change often. Check them again before relying on them.

### 8. Fanning one event out to many Recipients without a job queue (SQLite)

Facts that bound the design. How to apply them is a later decision.

- **Writing the Notifications (in-app rows) is cheap and synchronous.** `better-sqlite3`'s `db.transaction(fn)` "creates a function that always runs inside a transaction" and commits on return. It does **not** work with async functions, and keeping a transaction open across event-loop ticks is "a very bad idea" ([better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)). One synchronous transaction inserting one row per Recipient is the natural shape. It blocks the event loop while it runs.
- In WAL mode "readers do not block writers and a writer does not block readers", but "there can only be one writer at a time", and all processes must be on the same host ([SQLite WAL](https://sqlite.org/wal.html)). This matches ADR 0006.
- **External sends (email, push) are the slow part.** Each is a network call that can fail. With no job queue, the options are:
  1. Send inline in the action before responding. This is simplest, but the request waits for every send and a crash loses the rest.
  2. Fire-and-forget after responding. The request stays fast, but there is no retry and pending sends are lost on restart.
  3. A **table as the queue (outbox pattern)**: insert the Notification rows plus "pending delivery" rows in the same transaction, then let an in-process `setInterval` worker claim and send them, mark them sent or failed, and retry later. This survives restarts and needs nothing beyond SQLite and the one Node process. It works only while there is a single process.
- Batching helps the network side: Postmark `/email/batch` takes up to 500 messages per call (§3). Web push has no batch: one HTTP request per subscription.
- Digests ("5 new lessons" as one Notification, still open in #1) are a grouping rule over the same table. A provider sells them as a feature, but they need no new infrastructure.

### 9. Email unsubscribe and consent requirements

**RFC 8058 one-click unsubscribe** ([RFC 8058](https://www.rfc-editor.org/rfc/rfc8058)):

- "The List-Unsubscribe header field MUST contain one HTTPS URI" (a `mailto:` can sit alongside it).
- "The List-Unsubscribe-Post header MUST contain the single key/value pair "List-Unsubscribe=One-Click"."
- Both headers "MUST be covered by the [DKIM] signature".
- The mailbox provider POSTs to the URI. That POST "MUST NOT include cookies, HTTP authorization, or any other context information", so the URI must carry a hard-to-forge token that identifies the Recipient. The sender "MUST NOT return an HTTPS redirect".
- In Cadence this would be a resource route with an `action` that needs **no session** (so not behind the DevUI user selection) and verifies a signed token.

**Gmail** ([guidelines](https://support.google.com/a/answer/81126), [FAQ](https://support.google.com/a/answer/14229414)):

- Bulk senders send more than **5,000 messages/day to personal Gmail accounts**, counted per primary domain. Once a domain crosses the line it is bulk "permanently".
- Bulk senders need SPF, DKIM and DMARC (`p=none` is acceptable), plus From-domain alignment.
- "Marketing messages and subscribed messages must support one-click unsubscribe" with a visible unsubscribe link in the body. "One-click unsubscribe is required only for marketing and promotional messages". Transactional mail such as password resets is excluded.
- Unsubscribes should be honoured within **48 hours**.

**Yahoo** ([sender best practices](https://senders.yahooinc.com/best-practices/)):

- Bulk senders: SPF, DKIM and DMARC, and one-click List-Unsubscribe for marketing and subscribed messages. They must "honor unsubscribes within 2 days", and keep the spam rate below 0.3%. The page does not give a numeric bulk threshold.

**EU (ePrivacy Directive 2002/58/EC, Art. 13)** ([text via legislation.gov.uk](https://www.legislation.gov.uk/eudr/2002/58/article/13)):

- Art. 13(1): electronic mail for direct marketing "may be allowed only in respect of subscribers or users who have given their prior consent."
- Art. 13(2), the existing-customer "soft opt-in": a seller who got the address in the context of a sale may market "its own similar products or services", provided customers get "the opportunity to object, free of charge and in an easy manner", both when the address is collected and in each message.
- The CJEU (C-654/23, *Inteligo Media*, 13 Nov 2025) reportedly held that Art. 13(2) is an exhaustive rule, so no separate GDPR Art. 6 legal basis is needed for such emails. This comes from law-firm summaries; the judgment itself was not read.
- Not legal advice. The open question for Cadence is whether "new content in a course you are enrolled in" counts as a service message (transactional) or as marketing. That classification decides whether consent and unsubscribe rules apply, and it belongs to the email-compliance ticket in #1.

**Practical intersection with Postmark.** Postmark's Broadcast stream adds RFC 8058 headers and manages unsubscribes automatically. On the transactional stream Cadence would add them itself through the `Headers` field (§3).

## Not researched / open

- Whether Cadence's production deployment terminates HTTP/2 (affects the SSE connection limit).
- SMS sender-ID rules outside the US.
- The full text of CJEU C-654/23.
- Pricing for Novu's self-hosted Enterprise, and the exact features cloud has that self-hosted Novu lacks (the comparison page Novu links returned 404).
- Location: the repo had no existing convention for research notes, so this file starts `docs/research/`.
