import crypto from 'node:crypto';

const ONBOARDING_ONLY_PASSWORD_PREFIX = '__onboarding_only__';

export function makeOnboardingOnlyPasswordPlaceholder() {
  return `${ONBOARDING_ONLY_PASSWORD_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
}

export function isOnboardingOnlyPasswordPlaceholder(value) {
  return typeof value === 'string' && value.startsWith(ONBOARDING_ONLY_PASSWORD_PREFIX);
}
