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

function logEmailPreview(templateName, message) {
  console.log('[EmailPreview]', JSON.stringify({
    template: templateName,
    to: message.to,
    cc: message.cc || null,
    bcc: message.bcc || null,
    subject: message.subject,
    text: message.text,
    html: message.html,
    metadata: message.metadata || {},
  }, null, 2));
}

async function sendWithPreview(provider, templateName, payload) {
  const message = buildMessage(templateName, payload);
  logEmailPreview(templateName, message);
  const result = await provider.send(message);
  console.log('[EmailDelivery]', JSON.stringify({
    template: templateName,
    to: message.to,
    result,
  }, null, 2));
  return result;
}

export function getEmailService() {
  if (cachedService) return cachedService;
  const provider = createProvider();

  cachedService = {
    async sendOnboardingInvite(payload) {
      return sendWithPreview(provider, 'onboarding-invite', payload);
    },
    async sendDealApproved(payload) {
      return sendWithPreview(provider, 'deal-approved', payload);
    },
    async sendContractSigned(payload) {
      return sendWithPreview(provider, 'contract-signed', payload);
    },
    async sendFullyExecuted(payload) {
      return sendWithPreview(provider, 'fully-executed', payload);
    },
  };

  return cachedService;
}
