import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

export function createOciProvider() {
  const transporter = nodemailer.createTransport({
    host: env.email.oci.host,
    port: env.email.oci.port,
    secure: env.email.oci.secure,
    auth: env.email.oci.user
      ? {
        user: env.email.oci.user,
        pass: env.email.oci.password,
      }
      : undefined,
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
      return { provider: 'oci' };
    },
  };
}
