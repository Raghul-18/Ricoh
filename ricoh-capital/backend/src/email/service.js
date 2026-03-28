import { env } from '../config/env.js';
import { createGmailProvider } from './providers/gmailProvider.js';
import { createOciProvider } from './providers/ociProvider.js';
import { renderEmailTemplate } from './templates.js';

let cachedService;

function createProvider() {
  switch (env.email.provider) {
    case 'gmail':
      return createGmailProvider();
    case 'oci':
      return createOciProvider();
    default:
      throw new Error(`Unsupported email provider: ${env.email.provider}`);
  }
}

function buildMessage(templateName, payload) {
  const rendered = renderEmailTemplate(templateName, payload.variables);
  return {
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    metadata: payload.metadata || {},
  };
}

export function getEmailService() {
  if (cachedService) return cachedService;
  const provider = createProvider();

  cachedService = {
    async sendOnboardingInvite(payload) {
      return provider.send(buildMessage('onboarding-invite', payload));
    },
    async sendDealApproved(payload) {
      return provider.send(buildMessage('deal-approved', payload));
    },
    async sendContractSigned(payload) {
      return provider.send(buildMessage('contract-signed', payload));
    },
    async sendFullyExecuted(payload) {
      return provider.send(buildMessage('fully-executed', payload));
    },
  };

  return cachedService;
}
