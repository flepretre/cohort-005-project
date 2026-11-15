// PROTOTYPE (wayfinder: "What does the Notification Feed look like in Cadence?").
// Throwaway. Lives on branch prototype/notification-feed only. Not production code:
// no error handling, no tests, raw fetch instead of the Knock SDK.
import { importPKCS8, SignJWT } from "jose";

const KNOCK = "https://api.knock.app/v1";
const WORKFLOW = process.env.KNOCK_PROTOTYPE_WORKFLOW ?? "cadence-prototype";

export function knockUserId(userId: number) {
  return `cadence-user-${userId}`;
}

let signingKey: CryptoKey | null = null;
async function getSigningKey() {
  if (!signingKey) {
    const pem = Buffer.from(process.env.KNOCK_SIGNING_KEY!, "base64").toString();
    signingKey = await importPKCS8(pem, "RS256");
  }
  return signingKey;
}

export async function signUserToken(userId: number) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: knockUserId(userId) })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .sign(await getSigningKey());
}

const identified = new Set<number>();
export async function identifyUser(user: { id: number; name: string; email: string }) {
  if (identified.has(user.id)) return;
  await fetch(`${KNOCK}/users/${knockUserId(user.id)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${process.env.KNOCK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: user.name, email: user.email }),
  });
  identified.add(user.id);
}

export async function feedClientConfig(user: { id: number; name: string; email: string }) {
  await identifyUser(user);
  return {
    publicKey: process.env.KNOCK_PUBLIC_API_KEY!,
    channelId: process.env.KNOCK_FEED_CHANNEL_ID!,
    knockUserId: knockUserId(user.id),
    userToken: await signUserToken(user.id),
  };
}

export type SampleKind =
  | "refund-raised"
  | "refund-decided"
  | "seat-claimed"
  | "question"
  | "reply";

export interface SampleNotification {
  kind: SampleKind;
  actor: { id: string; name: string };
  data: Record<string, string | number | boolean>;
}

// One of each Notification in the v1 catalogue, all sent to the current user so
// every row style can be judged regardless of the DevUI role.
export function sampleNotifications(): SampleNotification[] {
  return [
    {
      kind: "question",
      actor: { id: knockUserId(5), name: "Emma Wilson" },
      data: {
        lessonTitle: "What is TypeScript?",
        courseTitle: "Introduction to TypeScript",
        excerpt: "Is `unknown` always safer than `any`, or are there cases where any is fine?",
        url: "/courses/introduction-to-typescript/lessons/1",
      },
    },
    {
      kind: "reply",
      actor: { id: knockUserId(2), name: "Sarah Chen" },
      data: {
        lessonTitle: "Installing and Configuring TypeScript",
        courseTitle: "Introduction to TypeScript",
        excerpt: "Good catch, `strict: true` turns that on for you.",
        url: "/courses/introduction-to-typescript/lessons/2",
      },
    },
    {
      kind: "seat-claimed",
      actor: { id: knockUserId(7), name: "Olivia Martinez" },
      data: {
        courseTitle: "Design Systems with Tailwind",
        seatsLeft: 3,
        url: "/team",
      },
    },
    {
      kind: "refund-raised",
      actor: { id: knockUserId(6), name: "James Park" },
      data: {
        courseTitle: "Building REST APIs with Node.js",
        reason: "The course covers Express 4 but our team is on Fastify.",
        url: "/admin/refunds",
      },
    },
    {
      kind: "refund-decided",
      actor: { id: knockUserId(1), name: "Alex Rivera" },
      data: {
        courseTitle: "Practical Data Visualisation",
        outcome: "declined",
        note: "You've completed 80% of the lessons, past the refund window.",
        url: "/courses/practical-data-visualisation",
      },
    },
  ];
}

export async function triggerSamples(userId: number) {
  const results = [];
  for (const sample of sampleNotifications()) {
    const res = await fetch(`${KNOCK}/workflows/${WORKFLOW}/trigger`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KNOCK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients: [knockUserId(userId)],
        actor: sample.actor,
        data: { kind: sample.kind, ...sample.data },
      }),
    });
    results.push({ kind: sample.kind, status: res.status, body: res.ok ? null : await res.text() });
  }
  return results;
}
