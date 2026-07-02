import { getOpenAiApiKey } from '../_shared/secrets.ts';
import type { ParsedEmailResult } from './types.ts';

const OPENAI_API_KEY = getOpenAiApiKey();
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export interface MatchAdjudication {
  decision: 'match_existing' | 'create_new' | 'needs_review';
  matchedApplicationId: string | null;
  confidence: number;
  reason: string;
}

export async function adjudicateApplicationMatch(
  email: ParsedEmailResult,
  candidates: Array<{ id: string; company: string | null; role: string | null; status: string | null; applied_at?: string | null }>,
): Promise<MatchAdjudication> {
  if (!OPENAI_API_KEY) {
    return { decision: 'needs_review', matchedApplicationId: null, confidence: 0, reason: 'LLM adjudication is unavailable.' };
  }
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: 'Decide whether one job email belongs to an existing application. Never force a match when role identity or timeline is unclear.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              email: {
                company: email.company,
                role: email.role,
                event_type: email.eventType,
                received_at: email.receivedAt,
                sender: email.rawFrom,
                subject: email.rawSubject,
                snippet: email.rawSnippet,
              },
              candidates,
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'application_match_decision',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                decision: { type: 'string', enum: ['match_existing', 'create_new', 'needs_review'] },
                matched_application_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                reason: { type: 'string' },
              },
              required: ['decision', 'matched_application_id', 'confidence', 'reason'],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`OpenAI match adjudication failed: ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI match adjudication returned no content.');
    const parsed = JSON.parse(content);
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const matchedApplicationId = typeof parsed.matched_application_id === 'string' && candidateIds.has(parsed.matched_application_id)
      ? parsed.matched_application_id
      : null;
    if (parsed.decision === 'match_existing' && !matchedApplicationId) {
      return { decision: 'needs_review', matchedApplicationId: null, confidence: 0, reason: 'Adjudicator selected an invalid candidate.' };
    }
    return {
      decision: parsed.decision,
      matchedApplicationId,
      confidence: parsed.confidence,
      reason: parsed.reason,
    };
  } catch (error) {
    return {
      decision: 'needs_review',
      matchedApplicationId: null,
      confidence: 0,
      reason: (error as Error)?.message ?? 'LLM adjudication failed.',
    };
  }
}
