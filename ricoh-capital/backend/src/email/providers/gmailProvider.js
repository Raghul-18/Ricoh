import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

export function createGmailProvider() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    connectionTimeout: env.email.timeouts.connectionMs,
    greetingTimeout: env.email.timeouts.greetingMs,
    socketTimeout: env.email.timeouts.socketMs,
    auth: {
      user: env.email.gmail.user,
      pass: env.email.gmail.appPassword,
    },
  });

  return {
    async send(message) {
      const info = await transporter.sendMail({
        from: env.email.fromAddress,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return {
        provider: 'gmail',
        accepted: info.accepted || [],
        rejected: info.rejected || [],
        pending: info.pending || [],
        response: info.response || '',
        messageId: info.messageId || '',
      };
    },
  };
}
