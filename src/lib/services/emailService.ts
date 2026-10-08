/**
 * emailService.ts - Servicio de envio de correos con Resend
 *
 * Integracion con Resend (https://resend.com)
 * Plan gratuito: 100 USD de credito = ~3500 correos
 * No requiere tarjeta para crear cuenta
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_VERIFIED_SENDER || 'noreply@tudominio.com';
const FROM_NAME = process.env.RESEND_VERIFIED_SENDER_NAME || 'Boletas';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailWithAttachmentOptions extends SendEmailOptions {
  attachment: {
    filename: string;
    content: string | Buffer;
    contentType?: string;
  };
}

export class EmailService {
  static async sendEmail({ to, subject, html, text }: SendEmailOptions) {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_resend_api_key_here') {
      console.log('[DEV] Email to ' + to);
      return { success: true, id: 'dev-mock-' + Date.now() };
    }
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_NAME + ' <' + FROM_EMAIL + '>',
        to: [to],
        subject,
        html,
        text: text || '',
      });
      if (error) return { success: false, error: error.message };
      return { success: true, id: data?.id };
    } catch (e) { return { success: false, error: String(e) }; }
  }

  static async sendEmailWithAttachment({ to, subject, html, text, attachment }: SendEmailWithAttachmentOptions) {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_resend_api_key_here') {
      console.log('[DEV] Email with attachment to ' + to);
      return { success: true, id: 'dev-mock-' + Date.now() };
    }
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_NAME + ' <' + FROM_EMAIL + '>',
        to: [to],
        subject,
        html,
        text: text || '',
        attachments: [{
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        }],
      });
      if (error) return { success: false, error: error.message };
      return { success: true, id: data?.id };
    } catch (e) { return { success: false, error: String(e) }; }
  }
}

export const EmailServiceInstance = new EmailService();