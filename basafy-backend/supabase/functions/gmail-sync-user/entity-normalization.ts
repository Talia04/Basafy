import { normalizeCompanyForKey, normalizeRoleForKey } from './utils.ts';

const COMPANY_ALIASES: Record<string, string> = {
  facebook: 'Meta',
  'facebook careers': 'Meta',
  'meta careers': 'Meta',
  'meta platforms': 'Meta',
  'meta platforms inc': 'Meta',
  alphabet: 'Google',
  'google careers': 'Google',
  'amazon jobs': 'Amazon',
  'microsoft careers': 'Microsoft',
};

const DOMAIN_COMPANIES: Record<string, string> = {
  'facebook.com': 'Meta',
  'meta.com': 'Meta',
  'google.com': 'Google',
  'amazon.com': 'Amazon',
  'microsoft.com': 'Microsoft',
};

export interface NormalizedCompany {
  canonicalName: string | null;
  normalizedKey: string;
  alias: string | null;
  domain: string | null;
}

export interface NormalizedRole {
  canonicalTitle: string | null;
  normalizedKey: string;
  family: string | null;
  level: 'intern' | 'entry' | 'mid' | 'senior' | 'staff' | 'lead' | 'manager' | null;
}

export function normalizeCompanyEntity(name?: string | null, domain?: string | null): NormalizedCompany {
  const cleanedDomain = domain?.toLowerCase().replace(/^www\./, '').trim() || null;
  const raw = name?.trim() || null;
  const rawKey = raw ? normalizeCompanyForKey(raw) : '';
  const canonicalName = (rawKey && COMPANY_ALIASES[rawKey]) || (cleanedDomain && DOMAIN_COMPANIES[cleanedDomain]) || raw;
  return {
    canonicalName,
    normalizedKey: canonicalName ? normalizeCompanyForKey(canonicalName) : '',
    alias: raw && canonicalName && raw.toLowerCase() !== canonicalName.toLowerCase() ? raw : null,
    domain: cleanedDomain,
  };
}

export function normalizeRoleEntity(title?: string | null): NormalizedRole {
  const raw = title?.trim() || null;
  if (!raw) return { canonicalTitle: null, normalizedKey: '', family: null, level: null };
  const lower = raw.toLowerCase();
  const level: NormalizedRole['level'] = /intern(ship)?/.test(lower)
    ? 'intern'
    : /new grad|university grad|entry[ -]level|junior|\bswe i\b|engineer i\b/.test(lower)
      ? 'entry'
      : /staff|principal/.test(lower)
        ? 'staff'
        : /senior|\bsr\b/.test(lower)
          ? 'senior'
          : /lead/.test(lower)
            ? 'lead'
            : /manager|director/.test(lower)
              ? 'manager'
              : 'mid';
  const family = /software|\bswe\b|developer|full[ -]?stack|frontend|backend/.test(lower)
    ? 'software_engineering'
    : /product design|ux|ui/.test(lower)
      ? 'product_design'
      : /product manager|\bpm\b/.test(lower)
        ? 'product_management'
        : /data|machine learning|\bml\b|analytics/.test(lower)
          ? 'data_and_ml'
          : normalizeRoleForKey(raw).split(' ').slice(0, 3).join('_') || null;
  const canonicalTitle = family === 'software_engineering'
    ? `${level === 'entry' ? 'Entry-Level ' : level === 'senior' ? 'Senior ' : level === 'staff' ? 'Staff ' : ''}Software Engineer`.trim()
    : raw;
  return { canonicalTitle, normalizedKey: normalizeRoleForKey(raw), family, level };
}

export function rolesHaveConflictingLevels(a: NormalizedRole['level'], b: NormalizedRole['level']) {
  if (!a || !b || a === b) return false;
  const junior = new Set(['intern', 'entry']);
  const advanced = new Set(['senior', 'staff', 'lead', 'manager']);
  return (junior.has(a) && advanced.has(b)) || (junior.has(b) && advanced.has(a));
}
