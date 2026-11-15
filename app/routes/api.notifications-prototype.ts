// PROTOTYPE: triggers one of each catalogue Notification to the current user via Knock.
import { data } from "react-router";
import type { Route } from "./+types/api.notifications-prototype";
import { getCurrentUserId } from "~/lib/session";
import { triggerSamples } from "~/lib/knock-prototype.server";

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel", { status: 401 });
  return { results: await triggerSamples(userId) };
}
