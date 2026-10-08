import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL

export async function sendPaymentApprovedSMS(phone: string, orderId: string, customerName: string) {
  try {
    if (!phone || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('SMS sending skipped: missing phone or Twilio number')
      return
    }

    await client.messages.create({
      body: `¡Hola ${customerName}! Tu pago ha sido verificado. Tu orden ${orderId.substring(0, 8).toUpperCase()} está lista. Descarga tus boletas: ${appUrl}/mis-boletas`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone.startsWith('+') ? phone : `+57${phone}`,
    })

    console.log(`SMS sent to ${phone}`)
  } catch (error) {
    console.error('Error sending SMS:', error)
  }
}

export async function sendPaymentRejectedSMS(phone: string, orderId: string, reason?: string) {
  try {
    if (!phone || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('SMS sending skipped: missing phone or Twilio number')
      return
    }

    const message = `Tu pago para la orden ${orderId.substring(0, 8).toUpperCase()} fue rechazado.${
      reason ? ` Motivo: ${reason}.` : ''
    } Intenta nuevamente: ${appUrl}/payment-status`

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone.startsWith('+') ? phone : `+57${phone}`,
    })

    console.log(`SMS sent to ${phone}`)
  } catch (error) {
    console.error('Error sending SMS:', error)
  }
}

export async function sendPaymentPendingSMS(phone: string, amount: number) {
  try {
    if (!phone || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('SMS sending skipped: missing phone or Twilio number')
      return
    }

    await client.messages.create({
      body: `Tu pago de $${amount.toLocaleString('es-CO')} ha sido recibido. Nuestro equipo lo verificará en los próximos minutos. Te notificaremos cuando esté confirmado.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone.startsWith('+') ? phone : `+57${phone}`,
    })

    console.log(`SMS sent to ${phone}`)
  } catch (error) {
    console.error('Error sending SMS:', error)
  }
}

export async function sendPaymentReminderSMS(phone: string, orderId: string, amount: number) {
  try {
    if (!phone || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('SMS sending skipped: missing phone or Twilio number')
      return
    }

    await client.messages.create({
      body: `Recordatorio: Tu pago de $${amount.toLocaleString('es-CO')} para la orden ${orderId.substring(0, 8).toUpperCase()} aún está pendiente. Completa el pago aquí: ${appUrl}/payment-status`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone.startsWith('+') ? phone : `+57${phone}`,
    })

    console.log(`SMS sent to ${phone}`)
  } catch (error) {
    console.error('Error sending SMS:', error)
  }
}

export async function sendOrderConfirmationSMS(phone: string, orderId: string, eventName: string) {
  try {
    if (!phone || !process.env.TWILIO_PHONE_NUMBER) {
      console.warn('SMS sending skipped: missing phone or Twilio number')
      return
    }

    await client.messages.create({
      body: `¡Tu orden para ${eventName} ha sido creada! Orden: ${orderId.substring(0, 8).toUpperCase()}. Completa el pago aquí: ${appUrl}/checkout?orderId=${orderId}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone.startsWith('+') ? phone : `+57${phone}`,
    })

    console.log(`SMS sent to ${phone}`)
  } catch (error) {
    console.error('Error sending SMS:', error)
  }
}
