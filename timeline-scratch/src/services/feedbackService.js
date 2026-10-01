/**
 * Public feedback — a note anyone can leave, signed in or not.
 *
 * This is the one write in the app that uses the UNAUTHENTICATED client. Every
 * other write goes through makeSupabaseClient(getToken), which attaches a Clerk
 * JWT; here there is no session to attach, so the anon key carries the request
 * and the row-level policy is the only gate.
 *
 * That policy ("Anyone can submit public feedback") constrains the whole row,
 * not just who may write it: source must be 'public', submitted_by must be
 * null, the status must be the untriaged one, and the resolver fields must be
 * empty. So a hostile caller armed with the anon key — which ships in the
 * client by design — can leave a note and nothing else. It cannot read notes
 * back, attribute one to a signed-in user, or mark anything resolved.
 *
 * Notes land in App_Issues alongside contributor-reported issues, tagged
 * source='public' so the admin view can tell them apart.
 */
import { getSupabase } from '../data/churchHistoryShared.js';

/** Matches the char_length bound in the insert policy. */
export const FEEDBACK_MAX_LENGTH = 4000;

/** The App_Issues.title column is NOT NULL, and the policy bounds it to 120. */
const TITLE_MAX_LENGTH = 120;

const APP_ID = 'ch-timeline-2';

/**
 * A title is required by the schema but not by the reader, who is given one
 * box and told to write in it. Take the first line, or the first sentence's
 * worth, so the admin list is scannable without asking for a second field.
 */
export function deriveTitle(message) {
  const firstLine = message.trim().split('\n')[0].trim();
  if (firstLine.length <= TITLE_MAX_LENGTH) return firstLine;
  const clipped = firstLine.slice(0, TITLE_MAX_LENGTH - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/**
 * Submit a public note. Resolves on success and throws on failure, so the
 * caller can tell the reader their words did not get through rather than
 * showing a thank-you over a dropped request.
 */
export async function submitPublicFeedback(message) {
  const body = (message || '').trim();

  if (!body) throw new Error('Please write something first.');
  if (body.length > FEEDBACK_MAX_LENGTH) {
    throw new Error(`Please keep it under ${FEEDBACK_MAX_LENGTH.toLocaleString()} characters.`);
  }

  const supabase = await getSupabase();

  // Every column the policy pins is sent explicitly. The defaults would satisfy
  // it today, but a future change to a default should break loudly here rather
  // than silently start failing the policy for readers.
  const { error } = await supabase.from('App_Issues').insert({
    app_id: APP_ID,
    title: deriveTitle(body),
    description: body,
    issue_type: 'general',
    status: 'submitted',
    source: 'public',
    submitted_by: null,
  });

  if (error) throw error;
}
