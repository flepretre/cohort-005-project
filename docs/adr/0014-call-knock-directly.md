# Call Knock directly, with no vendor-neutral layer

Cadence code fires Notifications through one thin notify module that calls the Knock SDK directly. We deliberately don't build a vendor-neutral notification interface: we're betting we won't switch, and an abstraction designed around a single vendor would only guess at the shape of the others. If the $250/mo jump past Knock's free tier ever forces a switch, we'll rewrite that one module and the Notification Feed's API calls.
