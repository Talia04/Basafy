import { canCollapseThreadBatch } from './stage-write.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('thread batch collapse allows follow-ups without repeated entities', () => {
  assert(
    canCollapseThreadBatch(
      { companyKey: 'acme', roleKey: 'software engineer' },
      '',
      '',
    ),
    'Entity-light follow-ups can collapse into the existing thread batch.',
  );
});

Deno.test('thread batch collapse rejects conflicting parsed entities', () => {
  assert(
    !canCollapseThreadBatch(
      { companyKey: 'acme', roleKey: 'software engineer' },
      'acme',
      'product designer',
    ),
    'Same-thread messages with a different role must not collapse.',
  );
  assert(
    !canCollapseThreadBatch(
      { companyKey: 'acme', roleKey: 'software engineer' },
      'stripe',
      'software engineer',
    ),
    'Same-thread messages with a different company must not collapse.',
  );
});

Deno.test('thread batch collapse rejects adding entities to an entity-light batch', () => {
  assert(
    !canCollapseThreadBatch(
      { companyKey: '', roleKey: '' },
      'acme',
      'software engineer',
    ),
    'A concrete application should not collapse into an entity-light thread batch.',
  );
});
