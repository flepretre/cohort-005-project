# Every Notification goes to the Feed; only actionable ones also go by email

The Notification Feed is the full record: every Notification lands there, and email is only ever added on top. In v1, email also goes out for Refund Request raised (to every Platform Admin), Refund Request decided (to the buyer) and a new question on a lesson (to the course's Instructor). These are the Notifications someone has to act on or is waiting to hear about. Seat claimed and thread replies stay Feed-only, because they're frequent, nobody has to act on them, and they'd train people to ignore Cadence's emails. Emails go out immediately, one per Notification, with no delay or digest, because these three are low-volume and someone is waiting on them.

## Considered Options

- **Web push as well.** Rejected for v1: through Knock it needs a second service (Firebase/FCM), iOS only gets it after a Home Screen install, and delivery is best-effort.
- **Delay the email and skip it if the Feed item was read, or send digests.** Rejected for now. Both can be added later inside the Knock workflow without changing Cadence code.
