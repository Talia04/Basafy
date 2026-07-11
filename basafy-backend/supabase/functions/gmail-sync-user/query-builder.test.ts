import { buildGmailQueryBuckets } from './query-builder.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('builds targeted Gmail query buckets without excluding whole platforms', () => {
  const buckets = buildGmailQueryBuckets({
    isInitialImport: true,
    lookbackMonths: 3,
    priorityDomains: ['careers.example.com'],
  });
  const names = buckets.map((bucket) => bucket.name);

  assert(buckets.length === 9, 'Expected all nine retrieval buckets.');
  assert(names.includes('application_confirmation'), 'Expected the application bucket.');
  assert(names.includes('platform_updates'), 'Expected the platform bucket.');
  assert(buckets.every((bucket) => bucket.query.includes('after:')), 'Expected a date boundary on every bucket.');
  assert(buckets.every((bucket) => !bucket.query.includes('-from:noreply@indeed.com')), 'Platform senders must not be globally excluded.');
  assert(buckets.some((bucket) => bucket.query.includes('careers.example.com')), 'Expected priority domains in retrieval.');

  const platformBucket = buckets.find((bucket) => bucket.name === 'platform_updates');
  assert(platformBucket?.query.includes('from:(linkedin.com'), 'Expected platform sender domains in the platform bucket.');
  assert(platformBucket?.query.includes('subject:"your application"'), 'Expected platform retrieval to require lifecycle subject terms.');
  assert(platformBucket?.query.includes('subject:interview'), 'Expected platform retrieval to retain interview updates.');
  assert(platformBucket?.query.includes('subject:assessment'), 'Expected platform retrieval to retain assessment updates.');
});
