export function renderEmailTemplate(templateName, variables = {}) {
  switch (templateName) {
    case 'onboarding-invite':
      return {
        subject: `Review and sign your ${variables.contractReference || 'contract'}`,
        text: [
          `Hello ${variables.customerName || 'Customer'},`,
          '',
          'Your financing agreement is ready for review and signature.',
          `Open secure link: ${variables.onboardingUrl}`,
          `This link expires on ${variables.expiresAtLabel}.`,
          '',
          'If you did not expect this email, please contact support.',
        ].join('\n'),
        html: `
          <p>Hello ${escapeHtml(variables.customerName || 'Customer')},</p>
          <p>Your financing agreement is ready for review and signature.</p>
          <p><a href="${escapeHtml(variables.onboardingUrl)}">Review &amp; Sign Contract</a></p>
          <p>This secure link expires on ${escapeHtml(variables.expiresAtLabel || '')}.</p>
          <p>If you did not expect this email, please contact support.</p>
        `,
      };
    case 'deal-approved':
      return {
        subject: `Deal approved: ${variables.contractReference || variables.dealReference || 'Contract pending signature'}`,
        text: [
          `Deal for ${variables.customerName || 'customer'} has been approved.`,
          `Contract reference: ${variables.contractReference || 'Pending'}.`,
          `Lifecycle status: ${variables.lifecycleStatus || 'AWAITING_CUSTOMER_SIGNATURE'}.`,
        ].join('\n'),
        html: `
          <p>Deal for <strong>${escapeHtml(variables.customerName || 'customer')}</strong> has been approved.</p>
          <p>Contract reference: <strong>${escapeHtml(variables.contractReference || 'Pending')}</strong></p>
          <p>Lifecycle status: <strong>${escapeHtml(variables.lifecycleStatus || 'AWAITING_CUSTOMER_SIGNATURE')}</strong></p>
        `,
      };
    case 'contract-signed':
      return {
        subject: `Contract signed: ${variables.contractReference || 'Contract update'}`,
        text: [
          `${variables.signerRole || 'A party'} signed contract ${variables.contractReference || ''}.`,
          `Current lifecycle status: ${variables.lifecycleStatus || 'In progress'}.`,
        ].join('\n'),
        html: `
          <p>${escapeHtml(variables.signerRole || 'A party')} signed contract <strong>${escapeHtml(variables.contractReference || '')}</strong>.</p>
          <p>Current lifecycle status: <strong>${escapeHtml(variables.lifecycleStatus || 'In progress')}</strong>.</p>
        `,
      };
    case 'fully-executed':
      return {
        subject: `Contract active: ${variables.contractReference || 'Agreement active'}`,
        text: [
          `Contract ${variables.contractReference || ''} is now fully executed and active.`,
          `Customer: ${variables.customerName || 'customer'}.`,
        ].join('\n'),
        html: `
          <p>Contract <strong>${escapeHtml(variables.contractReference || '')}</strong> is now fully executed and active.</p>
          <p>Customer: <strong>${escapeHtml(variables.customerName || 'customer')}</strong>.</p>
        `,
      };
    default:
      throw new Error(`Unknown email template: ${templateName}`);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
