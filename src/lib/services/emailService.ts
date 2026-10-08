/**
 * emailService.ts - Servicio de envío de correos con Brevo (SMTP & REST API v3)
 */

import nodemailer from 'nodemailer';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER;
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASS || BREVO_API_KEY;
const BREVO_SMTP_HOST = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
const BREVO_SMTP_PORT = Number(process.env.BREVO_SMTP_PORT || 587);

const SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL ||
  process.env.RESEND_VERIFIED_SENDER ||
  process.env.SENDER_EMAIL ||
  'soporte@boleteria.co';

const SENDER_NAME =
  process.env.BREVO_SENDER_NAME ||
  process.env.RESEND_VERIFIED_SENDER_NAME ||
  'Boletería.CO';

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
  /**
   * Envía un correo electrónico utilizando la API REST v3 de Brevo o SMTP Nodemailer
   */
  static async sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    // 1. Intentar con Brevo REST API v3 si existe BREVO_API_KEY
    if (BREVO_API_KEY && BREVO_API_KEY !== 'your_brevo_api_key_here') {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text || undefined,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          return { success: true, id: data.messageId || data.id };
        } else {
          console.error('[Brevo API Error]', data);
          return { success: false, error: data.message || JSON.stringify(data) };
        }
      } catch (err: any) {
        console.error('[Brevo API Exception]', err);
        return { success: false, error: err.message || String(err) };
      }
    }

    // 2. Intentar con SMTP Brevo (Nodemailer) si existen credenciales SMTP
    if (BREVO_SMTP_USER && BREVO_SMTP_KEY) {
      try {
        const transporter = nodemailer.createTransport({
          host: BREVO_SMTP_HOST,
          port: BREVO_SMTP_PORT,
          secure: BREVO_SMTP_PORT === 465,
          auth: {
            user: BREVO_SMTP_USER,
            pass: BREVO_SMTP_KEY,
          },
        });

        const info = await transporter.sendMail({
          from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
          to,
          subject,
          html,
          text,
        });

        return { success: true, id: info.messageId };
      } catch (err: any) {
        console.error('[Brevo SMTP Error]', err);
        return { success: false, error: err.message || String(err) };
      }
    }

    // 3. Fallback en desarrollo / sin configuración
    console.log(`[DEV Mock Email] Para: ${to} | Asunto: ${subject}`);
    return { success: true, id: 'dev-mock-' + Date.now() };
  }

  /**
   * Envía un correo con archivo adjunto a través de Brevo REST API v3 o SMTP
   */
  static async sendEmailWithAttachment({ to, subject, html, text, attachment }: SendEmailWithAttachmentOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    const contentBase64 =
      typeof attachment.content === 'string'
        ? Buffer.from(attachment.content).toString('base64')
        : attachment.content.toString('base64');

    // 1. Intentar con Brevo REST API v3
    if (BREVO_API_KEY && BREVO_API_KEY !== 'your_brevo_api_key_here') {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { name: SENDER_NAME, email: SENDER_EMAIL },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text || undefined,
            attachment: [
              {
                name: attachment.filename,
                content: contentBase64,
              },
            ],
          }),
        });

        const data = await response.json();
        if (response.ok) {
          return { success: true, id: data.messageId || data.id };
        } else {
          console.error('[Brevo API Attachment Error]', data);
          return { success: false, error: data.message || JSON.stringify(data) };
        }
      } catch (err: any) {
        console.error('[Brevo API Exception]', err);
        return { success: false, error: err.message || String(err) };
      }
    }

    // 2. Intentar con SMTP
    if (BREVO_SMTP_USER && BREVO_SMTP_KEY) {
      try {
        const transporter = nodemailer.createTransport({
          host: BREVO_SMTP_HOST,
          port: BREVO_SMTP_PORT,
          secure: BREVO_SMTP_PORT === 465,
          auth: {
            user: BREVO_SMTP_USER,
            pass: BREVO_SMTP_KEY,
          },
        });

        const info = await transporter.sendMail({
          from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
          to,
          subject,
          html,
          text,
          attachments: [
            {
              filename: attachment.filename,
              content: attachment.content,
              contentType: attachment.contentType,
            },
          ],
        });

        return { success: true, id: info.messageId };
      } catch (err: any) {
        console.error('[Brevo SMTP Error]', err);
        return { success: false, error: err.message || String(err) };
      }
    }

    console.log(`[DEV Mock Email Attachment] Para: ${to} | Asunto: ${subject}`);
    return { success: true, id: 'dev-mock-' + Date.now() };
  }
}

export const EmailServiceInstance = new EmailService();