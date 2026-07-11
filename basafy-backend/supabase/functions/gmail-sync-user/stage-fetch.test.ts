import { fetchEmailsByBuckets } from './stage-fetch.ts';
import type { GmailMessage } from './types.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('bucketed retrieval paginates round-robin and deduplicates messages', async () => {
  const pageCalls: string[] = [];
  const result = await fetchEmailsByBuckets('token', {
    buckets: [
      { name: 'application_confirmation', query: 'applications' },
      { name: 'interview', query: 'interviews' },
    ],
    maxResults: 10,
    maxPages: 4,
    listMessagesFn: async (_token, query, _max, pageToken) => {
      pageCalls.push(`${query}:${pageToken ?? 'first'}`);
      if (query === 'applications' && !pageToken) {
        return { messages: [{ id: 'shared' }, { id: 'application' }], nextPageToken: 'app-2', resultSizeEstimate: 3 };
      }
      if (query === 'applications') {
        return { messages: [{ id: 'application-2' }], nextPageToken: undefined, resultSizeEstimate: 3 };
      }
      if (!pageToken) {
        return { messages: [{ id: 'shared' }, { id: 'interview' }], nextPageToken: 'interview-2', resultSizeEstimate: 3 };
      }
      return { messages: [{ id: 'interview-2' }], nextPageToken: undefined, resultSizeEstimate: 3 };
    },
    fetchMessagesFn: async (_token, ids) => ids.map(({ id }): GmailMessage => ({ id, subject: id })),
  });

  assert(result.messages.length === 5, 'Expected duplicate Gmail IDs to be fetched once.');
  const shared = result.messages.find((message) => message.id === 'shared');
  assert(shared?.matchedQueryBuckets?.join(',') === 'application_confirmation,interview', 'Expected all matching buckets on the shared message.');
  assert(pageCalls.join('|') === 'applications:first|interviews:first|applications:app-2|interviews:interview-2', 'Expected round-robin pagination.');
});

Deno.test('bucketed retrieval resumes from a saved cursor and skips prior messages', async () => {
  const calls: Array<string | undefined> = [];
  const result = await fetchEmailsByBuckets('token', {
    buckets: [{ name: 'interview', query: 'interviews' }],
    maxResults: 10,
    maxPages: 1,
    initialPageTokens: { interview: 'page-2' },
    excludedMessageIds: new Set(['already-seen']),
    listMessagesFn: async (_token, _query, _max, pageToken) => {
      calls.push(pageToken);
      return {
        messages: [{ id: 'already-seen' }, { id: 'new-message' }],
        nextPageToken: 'page-3',
        resultSizeEstimate: 3,
      };
    },
    fetchMessagesFn: async (_token, ids) => ids.map(({ id }): GmailMessage => ({ id })),
  });
  assert(calls[0] === 'page-2', 'Expected retrieval to resume from the persisted Gmail cursor.');
  assert(result.messages.length === 1 && result.messages[0].id === 'new-message', 'Expected prior session messages to be skipped.');
  assert(result.pageTokens.interview === 'page-3', 'Expected the next cursor to be returned for persistence.');
});

Deno.test('platform classifier avoids broad candidate and offer false positives', async () => {
  const result = await fetchEmailsByBuckets('token', {
    buckets: [{ name: 'platform_updates', query: 'platform' }],
    maxResults: 10,
    maxPages: 1,
    listMessagesFn: async () => ({
      messages: [
        { id: 'candidate-profile' },
        { id: 'generic-offer' },
        { id: 'application-received' },
        { id: 'interview-scheduled' },
        { id: 'recruiter-message' },
      ],
      nextPageToken: undefined,
      resultSizeEstimate: 5,
    }),
    fetchMessagesFn: async (_token, ids) => ids.map(({ id }): GmailMessage => {
      if (id === 'candidate-profile') {
        return { id, subject: 'Your candidate profile is ready', snippet: 'Complete your profile to get better recommendations.' };
      }
      if (id === 'generic-offer') {
        return { id, subject: 'Limited-time offer for premium career tools', snippet: 'Upgrade today to find more jobs.' };
      }
      if (id === 'application-received') {
        return { id, subject: 'Application received', snippet: 'We received your application for Software Engineer.' };
      }
      if (id === 'interview-scheduled') {
        return { id, subject: 'Interview scheduled', snippet: 'Your technical interview has been scheduled.' };
      }
      return { id, subject: 'New recruiter message', snippet: 'A recruiter sent you a message about a role.' };
    }),
  });

  const types = Object.fromEntries(result.messages.map((message) => [message.id, message.platformEmailType]));
  assert(types['candidate-profile'] === 'unknown', 'Generic candidate profile mail must not become application activity.');
  assert(types['generic-offer'] === 'unknown', 'Generic promotional offers must not become job offers.');
  assert(types['application-received'] === 'application_activity', 'Concrete application confirmations should remain application activity.');
  assert(types['interview-scheduled'] === 'interview_or_assessment', 'Concrete interviews should remain interview activity.');
  assert(types['recruiter-message'] === 'recruiter_message', 'Concrete recruiter messages should remain recruiter activity.');
});
