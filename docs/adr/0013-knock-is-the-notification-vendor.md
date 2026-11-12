# Knock is the notification vendor

Cadence sends Notifications through Knock, a hosted vendor. Its free Developer plan covers 10K messages a month, its feed API requires RS256 signed user tokens in production, it stores preferences by category × channel, and it has a mature headless feed API for the Notification Feed we build ourselves. We picked one vendor and are not running a bake-off.

## Considered Options

- **MagicBell.** It has built-in VAPID web push, but the free plan stops at 1K deliveries a month and the next tier is $249/mo.
- **Courier.** The runner-up: scoped JWTs with expiry, topic × channel preferences, $0.005/send pay-as-you-go. Web push still needs OneSignal or FCM.
- **Novu Cloud.** It has the cheapest paid tier, but feed auth is a static HMAC of the subscriber id with no expiry, and its preferences have no categories.
- **SuprSend.** Vendor-stored preferences aren't on the free plan, and category preferences need the $250/mo Business plan.

## Consequences

- Knock has no first-party web push. If web push is ever added, it needs a Firebase project and FCM as a second service.
- Past 10K messages a month, the next plan is Starter at $250/mo, with nothing in between. This is a known risk.

Research: https://gist.github.com/mattpocock/87be0d1df4945234bba66f775ade6768#file-notification-vendors-md
