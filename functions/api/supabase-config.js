export async function onRequest({ env }) {
  const url = env.SUPABASE_URL || "";
  const anonKey = env.SUPABASE_ANON_KEY || "";
  const clerkPubKey = env.CLERK_PUBLISHABLE_KEY || "";
  // Public by design, like the anon key above: Turnstile site keys are meant
  // to be in the page. The matching secret stays server-side in feedback.js.
  const turnstileSiteKey = env.TURNSTILE_SITE_KEY || "";
  // Whether the subscriber gate is switched on. Derived from the presence of
  // its secrets — the secrets themselves never leave the server. The client
  // needs this to know whether to ask for an email before the message box.
  const feedbackGate = Boolean(env.RESEND_API_KEY && env.FEEDBACK_SIGNING_SECRET);

  const body = [
    `window.SUPABASE_URL = ${JSON.stringify(url)};`,
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(anonKey)};`,
    `window.CLERK_PUBLISHABLE_KEY = ${JSON.stringify(clerkPubKey)};`,
    `window.TURNSTILE_SITE_KEY = ${JSON.stringify(turnstileSiteKey)};`,
    `window.FEEDBACK_GATE_ENABLED = ${JSON.stringify(feedbackGate)};`,
  ].join('\n') + '\n';

  return new Response(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
