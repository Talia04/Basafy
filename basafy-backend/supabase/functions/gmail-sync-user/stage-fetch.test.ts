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
