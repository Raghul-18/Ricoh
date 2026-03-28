import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

export function createGmailProvider() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.email.gmail.user,
      pass: env.email.gmail.appPassword,
    },
  });

  return {
    async send(message) {
      await transporter.sendMail({
        from: env.email.fromAddress,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { provider: 'gmail' };
    },
  };
}
