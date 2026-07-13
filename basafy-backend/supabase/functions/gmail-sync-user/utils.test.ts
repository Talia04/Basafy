import { areSameRole } from './utils.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('role matching rejects conflicting seniority levels', () => {
  assert(!areSameRole('Software Engineering Intern', 'Senior Software Engineer'), 'Intern and senior roles must not match.');
  assert(!areSameRole('Entry-Level Software Engineer', 'Staff Software Engineer'), 'Entry and staff roles must not match.');
  assert(!areSameRole('Junior Product Designer', 'Design Manager'), 'Junior and manager roles must not match.');
});

Deno.test('role matching allows same-level wording variants', () => {
  assert(areSameRole('New Grad Software Engineer', 'Software Engineer, University Grad'), 'New-grad wording variants should match.');
  assert(areSameRole('Senior Frontend Engineer', 'Sr Frontend Engineer'), 'Senior abbreviation variants should match.');
});
