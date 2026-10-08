/**
 * emailService.ts - Servicio de envío de correos con Resend
 *
 * Integración con Resend (https://resend.com)
 * Instanciación perezosa (lazy) para evitar errores en `next build` si falta la API Key.
 */

import { Resend } from 'resend';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'your_resend_api_key_here') return null;
  try {
    return new Resend(apiKey);
  } catch (err) {
    console.warn('[EmailService] Error instantiating Resend:', err);
    return null;
  }
}

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
    const resend = getResendClient();
    if (!resend) {
      console.log('[DEV] Mock email sent to ' + to);
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
    const resend = getResendClient();
    if (!resend) {
      console.log('[DEV] Mock email with attachment sent to ' + to);
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