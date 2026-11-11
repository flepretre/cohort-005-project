# Send transactional email through Postmark, or to `.outbox/` without a token

Every email goes through `sendEmail` in `app/lib/mailer.server.ts`. When `POSTMARK_SERVER_TOKEN` is set it's sent through Postmark's API. Without a token (local dev, tests) it's written as JSON to `.outbox/`. This replaces writing refund emails to the server log, so learners now actually get the confirmation they were promised. A hosted provider spares us running SPF, DKIM and a sender reputation ourselves.

## Consequences

Changing provider means writing a new `MailTransport`. Callers don't change.
