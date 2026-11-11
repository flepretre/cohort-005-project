# An unknown country pays full price; no page waits on a geo lookup

`resolveCountry` reads the dev override, then Cloudflare's `CF-IPCountry` header, and returns null otherwise, which prices at full price. We dropped the ip-api.com fallback because it put a plain-HTTP call, rate-limited to 45 requests a minute, in front of the course list, the purchase page and every lesson page for a discounted purchase.

## Consequences

A learner whose request doesn't come through Cloudflare pays full price, even in a country with a purchasing-power discount. This is the overcharge ADR-0008 tried to avoid. We accepted it to keep pages off the network.
