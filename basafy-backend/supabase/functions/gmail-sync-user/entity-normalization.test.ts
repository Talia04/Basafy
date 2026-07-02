import { normalizeCompanyEntity, normalizeRoleEntity, rolesHaveConflictingLevels } from './entity-normalization.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('normalizes known company aliases and domains', () => {
  assert(normalizeCompanyEntity('Meta Platforms').canonicalName === 'Meta', 'Expected Meta Platforms alias normalization.');
  assert(normalizeCompanyEntity('Facebook Careers').canonicalName === 'Meta', 'Expected Facebook alias normalization.');
  assert(normalizeCompanyEntity(null, 'meta.com').canonicalName === 'Meta', 'Expected domain normalization.');
});

Deno.test('normalizes role family while preserving level distinctions', () => {
  const newGrad = normalizeRoleEntity('Software Engineer, University Grad');
  const senior = normalizeRoleEntity('Senior Software Engineer');
  assert(newGrad.family === senior.family, 'Expected related software engineering families.');
  assert(newGrad.level === 'entry', 'Expected university graduate entry level.');
  assert(rolesHaveConflictingLevels(newGrad.level, senior.level), 'Expected entry and senior levels to conflict.');
});
