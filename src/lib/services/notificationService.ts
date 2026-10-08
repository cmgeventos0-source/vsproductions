// src/lib/services/notificationService.ts
/**
 * Servicio centralizado para enviar notificaciones por múltiples canales:
 * - Email (Resend, SendGrid, SMTP)
 * - WhatsApp (Twilio, Baileys, WhatsApp Web Scraper - métodos gratuitos)
 * - SMS (alternativa)
 */

import { EmailService } from './emailService';

export type NotificationChannel = 'email' | 'whatsapp' | 'sms';

export interface NotificationPayload {
  to: string; // email o teléfono
  channel: NotificationChannel;
  type: 'payment_confirmed' | 'payment_failed' | 'order_processing' | 'ticket_ready';
  context: Record<string, any>;
}

/**
 * ============================================================
 * MÉTODO 1: WHATSAPP VÍA TWILIO (Sandbox - Gratuito para pruebas)
 * ============================================================
 *
 * Pros:
 * - Totalmente gratuito para development/testing
 * - API muy simple y documentada
 * - Webhooks para confirmación de entrega
 *
 * Contras:
 * - Sandbox: solo envía a números pre-verificados (máx 20)
 * - En producción requiere pago
 *
 * Setup:
 * 1. Crear cuenta en https://www.twilio.com (gratuito)
 * 2. Obtener Account SID, Auth Token, Twilio número
 * 3. En Twilio console: Messaging > Try it out > WhatsApp
 * 4. Seguir instrucciones para conectar WhatsApp Business Account
 * 5. En sandbox, enviar mensaje de prueba y responder con el mensaje código
 */
class TwilioWhatsAppService {
  private accountSid = process.env.TWILIO_ACCOUNT_SID;
  private authToken = process.env.TWILIO_AUTH_TOKEN;
  private twilioPhone = process.env.TWILIO_WHATSAPP_NUMBER; // ej: +1234567890

  async send(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
    if (!this.accountSid || !this.authToken || !this.twilioPhone) {
      return { success: false, error: 'Twilio no configurado' };
    }

    try {
      // Convertir número de teléfono al formato WhatsApp (ej: +57 320 123 4567 → +573201234567)
      const cleanPhone = to.replace(/\D/g, '');
      const whatsappTo = `whatsapp:+${cleanPhone}`;
      const whatsappFrom = `whatsapp:${this.twilioPhone}`;

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: whatsappFrom,
          To: whatsappTo,
          Body: message,
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error Twilio WhatsApp:', error);
        return { success: false, error: error.message };
      }

      const data = await response.json();
      return { success: true, sid: data.sid };
    } catch (error) {
      console.error('Error enviando WhatsApp via Twilio:', error);
      return { success: false, error: String(error) };
    }
  }
}

/**
 * ============================================================
 * MÉTODO 2: WHATSAPP VÍA BAILEYS (WhatsApp Web - Completamente Gratuito)
 * ============================================================
 *
 * Pros:
 * - 100% GRATUITO (sin limits)
 * - No requiere número de teléfono separado
 * - Envía desde tu propio número WhatsApp
 *
 * Contras:
 * - Requiere mantener sesión activa (necesita servidor siempre corriendo)
 * - Puede ser bloqueado por WhatsApp si detecta bot automation
 * - Más complejo de configurar
 *
 * Setup:
 * 1. npm i @whiskeysockets/baileys pino pino-pretty
 * 2. Crear una instancia de bot en un servidor Node.js separado
 * 3. Escanear código QR la primera vez
 * 4. El bot se conecta a través de WhatsApp Web
 *
 * Nota: Esta es una alternativa más robusta si planeas escala.
 */

// Simulación (en producción, usarías un servicio separado)
class BaileysWhatsAppService {
  // Este servicio necesitaría estar en un servidor aparte
  // para mantener la sesión de WhatsApp activa.
  // Aquí solo documentamos cómo se usaría.

  async send(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // En producción: llamar a un servidor que tenga Baileys corriendo
      const baileysServerUrl = process.env.BAILEYS_SERVER_URL; // http://localhost:3001
      if (!baileysServerUrl) {
        return { success: false, error: 'Servidor Baileys no configurado' };
      }

      const response = await fetch(`${baileysServerUrl}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: `${to}@s.whatsapp.net`, // Formato de Baileys
          text: message,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Error: ${response.statusText}` };
      }

      const data = await response.json();
      return { success: true, messageId: data.key.id };
    } catch (error) {
      console.error('Error enviando WhatsApp via Baileys:', error);
      return { success: false, error: String(error) };
    }
  }
}

/**
 * ============================================================
 * MÉTODO 3: WHATSAPP VÍA ULTRAMSG.COM (Freemium - Plan gratuito)
 * ============================================================
 *
 * Pros:
 * - Plan gratuito: 50 mensajes/mes + acceso API
 * - No requiere mantener servidor
 * - Fácil de integrar
 *
 * Contras:
 * - Límite de 50 mensajes/mes en plan free
 * - Después necesitas pagar
 *
 * Setup:
 * 1. Registrarse en https://ultramsg.com
 * 2. Conectar WhatsApp Business Account
 * 3. Obtener Instance ID y Token
 */
class UltraMsgWhatsAppService {
  private instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  private token = process.env.ULTRAMSG_TOKEN;

  async send(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.instanceId || !this.token) {
      return { success: false, error: 'UltraMsg no configurado' };
    }

    try {
      // Limpiar número (ej: +57 320 123 4567 → 573201234567)
      const cleanPhone = to.replace(/\D/g, '');

      const response = await fetch(`https://api.ultramsg.com/${this.instanceId}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.token,
          to: cleanPhone,
          body: message,
          priority: 1, // Alta prioridad
        }),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { success: true, messageId: data.sent };
    } catch (error) {
      console.error('Error enviando WhatsApp via UltraMsg:', error);
      return { success: false, error: String(error) };
    }
  }
}

/**
 * ============================================================
 * MÉTODO 4: WHATSAPP VÍA API.WHATSAPP.COM (Meta - Pero con alternativa gratuita)
 * ============================================================
 *
 * Si ya tienes acceso, úsalo. Si no, las alternativas arriba son mejores.
 */

/**
 * ============================================================
 * SERVICIO PRINCIPAL DE NOTIFICACIONES
 * ============================================================
 */
export class NotificationService {
  private twilioWhatsApp = new TwilioWhatsAppService();
  private baileysWhatsApp = new BaileysWhatsAppService();
  private ultraMsgWhatsApp = new UltraMsgWhatsAppService();

  /**
   * Envía notificación por el canal especificado
   */
  async send(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { to, channel, type, context } = payload;

    try {
      if (channel === 'email') {
        return await this.sendEmail(to, type, context);
      }

      if (channel === 'whatsapp') {
        return await this.sendWhatsApp(to, type, context);
      }

      if (channel === 'sms') {
        return await this.sendSms(to, type, context);
      }

      return { success: false, error: 'Canal no soportado' };
    } catch (error) {
      console.error(`Error enviando notificación (${channel}):`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Envía por múltiples canales a la vez
   */
  async sendMultiple(payload: Omit<NotificationPayload, 'channel'>): Promise<{
    email?: { success: boolean; error?: string };
    whatsapp?: { success: boolean; error?: string };
  }> {
    const results: any = {};

    // Email siempre
    results.email = await this.send({ ...payload, channel: 'email' });

    // WhatsApp si se proporciona teléfono
    if (payload.context.phone) {
      results.whatsapp = await this.send({
        to: payload.context.phone,
        channel: 'whatsapp',
        type: payload.type,
        context: payload.context,
      });
    }

    return results;
  }

  /**
   * ============================================================
   * ENVÍO POR EMAIL
   * ============================================================
   */
  private async sendEmail(to: string, type: string, context: Record<string, any>) {
    const templates: Record<string, { subject: string; html: string }> = {
      payment_confirmed: {
        subject: `✅ Pago confirmado - Pedido #${context.orderId}`,
        html: `
<h1>¡Pago confirmado!</h1>
<p>Hola ${context.customerName},</p>
<p>Tu pago de <strong>$${context.amount.toLocaleString('es-CO')}</strong> ha sido confirmado exitosamente.</p>
<p><strong>Detalles del pedido:</strong></p>
<ul>
  <li>Número de pedido: ${context.orderId}</li>
  <li>Evento: ${context.eventName}</li>
  <li>Fecha del evento: ${new Date(context.eventDate).toLocaleDateString('es-CO')}</li>
  <li>Zona: ${context.zone}</li>
  <li>Cantidad: ${context.quantity} boleta(s)</li>
</ul>
<p>Tu(s) boleta(s) se enviarán a este correo en los próximos minutos.</p>
<p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/ordenes/${context.orderId}" style="background:#2563eb;color:#fff;padding:10px20px;border-radius:5px;text-decoration:none;">Ver pedido</a></p>
        `,
      },
      payment_failed: {
        subject: `❌ Pago no procesado`,
        html: `
<h1>Pago no completado</h1>
<p>Hola ${context.customerName},</p>
<p>Lamentablemente, tu pago no fue procesado exitosamente.</p>
<p><strong>Motivo:</strong> ${context.reason}</p>
<p>Por favor, intenta nuevamente o contacta con soporte.</p>
<p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/carrito" style="background:#ef4444;color:#fff;padding:10px20px;border-radius:5px;text-decoration:none;">Reintentar pago</a></p>
        `,
      },
      order_processing: {
        subject: `⏳ Tu pedido está siendo procesado`,
        html: `
<h1>Pedido en procesamiento</h1>
<p>Hola ${context.customerName},</p>
<p>Tu pedido #${context.orderId} está siendo procesado y pronto recibirás tus boletas.</p>
<p>Tiempo estimado: 5-10 minutos.</p>
        `,
      },
      ticket_ready: {
        subject: `🎫 ¡Tus boletas están listas!`,
        html: `
<h1>¡Boletas listas para descargar!</h1>
<p>Hola ${context.customerName},</p>
<p>Tus boletas para ${context.eventName} están listas.</p>
<p><strong>Instrucciones:</strong></p>
<ol>
  <li>Descarga el PDF adjunto o accede a tu cuenta</li>
  <li>Presenta el código QR en la entrada del evento</li>
  <li>¡Disfruta el evento!</li>
</ol>
<p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/mis-boletas" style="background:#16a34a;color:#fff;padding:10px20px;border-radius:5px;text-decoration:none;">Descargar boletas</a></p>
        `,
      },
    };

    const template = templates[type];
    if (!template) {
      return { success: false, error: `Plantilla ${type} no encontrada` };
    }

    try {
      await EmailService.sendEmail({
        to,
        subject: template.subject,
        html: template.html,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * ============================================================
   * ENVÍO POR WHATSAPP
   * ============================================================
   */
  private async sendWhatsApp(to: string, type: string, context: Record<string, any>) {
    // Seleccionar el proveedor según configuración
    const provider = process.env.WHATSAPP_PROVIDER || 'twilio'; // twilio | baileys | ultramsg

    const message = this.buildWhatsAppMessage(type, context);

    if (provider === 'twilio') {
      return await this.twilioWhatsApp.send(to, message);
    }

    if (provider === 'baileys') {
      return await this.baileysWhatsApp.send(to, message);
    }

    if (provider === 'ultramsg') {
      return await this.ultraMsgWhatsApp.send(to, message);
    }

    return { success: false, error: `Proveedor ${provider} no soportado` };
  }

  /**
   * Construye el mensaje de WhatsApp según el tipo
   */
  private buildWhatsAppMessage(type: string, context: Record<string, any>): string {
    const messages: Record<string, string> = {
      payment_confirmed: `✅ *¡Pago confirmado!*

Pedido: #${context.orderId}
Evento: ${context.eventName}
Monto: $${context.amount.toLocaleString('es-CO')}
Cantidad: ${context.quantity} boleta(s)

Tu(s) boleta(s) se enviarán en los próximos minutos.

Ver pedido: ${process.env.NEXT_PUBLIC_SITE_URL}/ordenes/${context.orderId}`,

      payment_failed: `❌ *Pago no completado*

Pedido: #${context.orderId}
Motivo: ${context.reason}

Intenta nuevamente: ${process.env.NEXT_PUBLIC_SITE_URL}/carrito`,

      order_processing: `⏳ *Tu pedido está siendo procesado*

Pedido: #${context.orderId}
Tiempo estimado: 5-10 minutos

Te notificaremos cuando esté listo.`,

      ticket_ready: `🎫 *¡Tus boletas están listas!*

Evento: ${context.eventName}
Cantidad: ${context.quantity} boleta(s)

Descargar: ${process.env.NEXT_PUBLIC_SITE_URL}/mis-boletas`,
    };

    return messages[type] || 'Notificación desde Boletas';
  }

  /**
   * ============================================================
   * ENVÍO POR SMS (fallback)
   * ============================================================
   */
  private async sendSms(to: string, type: string, context: Record<string, any>) {
    // Implementación similar (Plivo, Vonage, etc.)
    const message = this.buildWhatsAppMessage(type, context).replace(/\*/g, '').slice(0, 160);

    // Si necesitas SMS además de WhatsApp, aquí iría la lógica
    return { success: false, error: 'SMS no implementado aún' };
  }
}

export const notificationService = new NotificationService();
