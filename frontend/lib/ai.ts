import Anthropic from '@anthropic-ai/sdk';

/**
 * Server-side only. In v1.0 these calls ran from the browser, which is
 * acceptable for a demonstration but exposes the key in production. The
 * acceptance criterion for migration step 5 is that no key appears in any
 * client request, which is why nothing in this file is ever imported from a
 * component marked 'use client'.
 */

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * Returns null on any failure, including a missing key. Every caller shows
 * its documented fallback message and the workflow continues manually.
 * A clinical action is never blocked on an AI response.
 */
export async function complete(
  system: string,
  prompt: string | Turn[],
  maxTokens = 700,
): Promise<string | null> {
  if (!client) return null;
  try {
    const messages = typeof prompt === 'string'
      ? [{ role: 'user' as const, content: prompt }]
      : prompt.map((t) => ({ role: t.role, content: t.content }));

    const r = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages,
    });
    return r.content[0]?.type === 'text' ? r.content[0].text : null;
  } catch {
    return null;
  }
}

/** The exact fallback wording from ai-routes.md, kept in one place. */
export const FALLBACK = {
  draftNote: 'AI unavailable — write the note manually.',
  explainResult: 'AI unavailable — interpret against the reference range shown.',
  explainResultPatient:
    'AI unavailable right now — your care team can walk you through this result.',
  draftClaim: 'AI unavailable — write the justification manually.',
  ops: 'AI unavailable right now — check the dashboards above.',
  symptomCheck:
    "I can't reach the service right now. For urgent symptoms call the emergency line or use Emergency on the home screen.",
} as const;
