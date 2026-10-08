# 📧 GUÍA COMPLETA: EMAIL + WHATSAPP GRATUITO

## 🎯 Resumen de opciones

| Canal | Servicio | Plan Gratuito | Setup | Ideal para |
|-------|----------|---------------|-------|-----------|
| **Email** | Resend | 100 USD crédito (~3500 correos) | ⭐⭐⭐ Muy simple | Producción |
| **Email** | SendGrid | 40,000 correos/mes | ⭐⭐⭐ Simple | Producción |
| **Email** | Gmail SMTP | Ilimitado | ⭐⭐ Moderado | Testing |
| **WhatsApp** | Twilio | $15 crédito (sandbox) | ⭐⭐ Moderado | Testing rápido |
| **WhatsApp** | UltraMsg | 50 mensajes/mes | ⭐⭐⭐ Simple | MVP pequeño |
| **WhatsApp** | Baileys | 100% Gratis | ⭐ Complejo | Escalado sin costo |

---

## 📧 OPCIÓN 1: EMAIL CON RESEND (RECOMENDADO)

### Paso 1: Crear cuenta en Resend

```
1. Ve a: https://resend.com
2. Haz clic en "Sign up"
3. Usa tu email empresarial o personal
4. NO NECESITAS tarjeta de crédito
```

### Paso 2: Obtener API Key

```
1. Dashboard → API Keys
2. Copiar "Default API Key" (empieza con "re_")
3. Guardar en .env.local como:
   RESEND_API_KEY=re_1234567890abcdef
```

### Paso 3: Verificar dominio (OPCIONAL pero RECOMENDADO)

**Si usas un dominio propio (ej: mail@tudominio.com):**

```
1. Dashboard → Domains
2. Añadir dominio → ingresar "tudominio.com"
3. Copiar registros DNS (SPF, DKIM)
4. En tu proveedor de DNS (GoDaddy, Namecheap, Route53):
   - Añadir registro SPF
   - Añadir registro DKIM
5. Esperar 24-48h para propagación
6. En Resend: click "Verify Domain"
```

**Si NO tienes dominio:**
```
Puedes usar el dominio por defecto de Resend:
RESEND_VERIFIED_SENDER=onboarding@resend.dev
(pero solo funciona en testing)
```

### Paso 4: Instalar SDK

```bash
npm i resend
```

### Paso 5: Configurar en `.env.local`

```dotenv
RESEND_API_KEY=re_1234567890abcdef
RESEND_VERIFIED_SENDER=noreply@tudominio.com
RESEND_VERIFIED_SENDER_NAME=Boletas
```

### Paso 6: Probar envío

```bash
# Crear archivo de prueba: test-email.js
node --loader ts-node/esm <<'EOF'
import { EmailService } from './src/lib/services/emailService.js';

await EmailService.sendEmail({
  to: 'tu.email@gmail.com',
  subject: '✅ Test desde Resend',
  html: '<h1>¡Funciona!</h1><p>Este es un correo de prueba.</p>'
});

console.log('✅ Correo enviado exitosamente');
EOF
```

**Monitorear en Resend:**
- Dashboard → Emails → Verás el correo en la lista

---

## 📧 OPCIÓN 2: EMAIL CON SENDGRID (Alternativa)

### Paso 1: Crear cuenta

```
1. Ve a: https://sendgrid.com
2. Sign up (sin tarjeta requerida)
3. Verificar email
```

### Paso 2: Obtener API Key

```
1. Dashboard → Settings → API Keys
2. Create API Key → nombre "Boletas API"
3. Copiar clave (empieza con "SG.")
```

### Paso 3: Instalar SDK

```bash
npm i @sendgrid/mail
```

### Paso 4: Configurar `.env.local`

```dotenv
SENDGRID_API_KEY=SG.1234567890abcdef
SENDGRID_FROM_EMAIL=noreply@tudominio.com
SENDGRID_FROM_NAME=Boletas
```

### Paso 5: Usar en código

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: 'usuario@gmail.com',
  from: process.env.SENDGRID_FROM_EMAIL,
  subject: '✅ Pago confirmado',
  html: '<h1>¡Gracias por tu compra!</h1>'
});
```

**Límites gratuitos:**
- ✅ 40,000 correos/mes
- ✅ Acceso a templates
- ✅ Analytics básico
- ❌ Sin soporte prioritario

---

## 📧 OPCIÓN 3: EMAIL CON GMAIL SMTP (Gratuito local)

> **Úsalo solo para testing local.** Para producción, usa Resend o SendGrid.

### Paso 1: Habilitar "App Passwords" en Gmail

```
1. Ve a: https://myaccount.google.com/security
2. En el panel izquierdo → "Security"
3. Desplázate hasta "App passwords"
   (Si no aparece, habilita 2FA primero)
4. Selecciona:
   - App: Mail
   - Device: Windows Computer (o tu SO)
5. Copiar contraseña generada (16 caracteres)
```

### Paso 2: Configurar `.env.local`

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu.email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # La contraseña de 16 caracteres
SMTP_FROM=tu.email@gmail.com
SMTP_FROM_NAME=Boletas
```

### Paso 3: Instalar Nodemailer

```bash
npm i nodemailer
npm i -D @types/nodemailer
```

### Paso 4: Usar en código

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

await transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: 'usuario@gmail.com',
  subject: '✅ Pago confirmado',
  html: '<h1>¡Gracias!</h1>'
});
```

**⚠️ Limitaciones:**
- Gmail te puede bloquear si envías muchos correos rápido
- Máximo ~100 correos/minuto
- Para producción, NO es recomendado

---

## 💬 WHATSAPP OPCIÓN 1: TWILIO (Recomendado para empezar)

### Paso 1: Crear cuenta en Twilio

```
1. Ve a: https://www.twilio.com
2. Sign up (requiere email, teléfono y tarjeta)
3. Confirmar email
4. Twilio te da $15 USD de crédito gratis
```

### Paso 2: Activar WhatsApp Sandbox

```
1. Dashboard → Messaging → Try it out → Send WhatsApp message
2. Twilio te proporciona un número (ej: +1234567890)
3. Para el SANDBOX:
   - Solo puedes enviar a números pre-verificados (máx 20)
   - Para verificar un número: enviar mensaje "join <código>"
   - Twilio te dará un código en la respuesta
   - El usuario lo envía a tu número y queda verificado
```

### Paso 3: Obtener credenciales

```
1. Dashboard → Account
2. Copiar:
   - Account SID (empieza con "AC")
   - Auth Token
3. Dashboard → Messaging → Services
4. Crear "WhatsApp Messaging Service"
5. Obtener Twilio Phone Number (ej: +1234567890)
```

### Paso 4: Configurar `.env.local`

```dotenv
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+1234567890
```

### Paso 5: Instalar SDK (opcional, se usa HTTP directamente)

```bash
# No es necesario instalar - usamos fetch directamente
# Pero si quieres: npm i twilio
```

### Paso 6: Probar

```bash
# El webhook ya tiene el código de prueba integrado
# Cuando se confirme un pago, se enviará automáticamente
```

**Costos:**
- ✅ $15 USD gratis al crear cuenta
- ✅ En sandbox: números verificados gratis
- 📊 En producción: ~$0.005 USD por mensaje

---

## 💬 WHATSAPP OPCIÓN 2: ULTRAMSG (Freemium simple)

### Paso 1: Crear cuenta

```
1. Ve a: https://ultramsg.com
2. Sign up
3. Conectar WhatsApp Business Account
   (si tienes)
```

### Paso 2: Obtener credenciales

```
1. Dashboard → API Settings
2. Copiar:
   - Instance ID
   - Token
```

### Paso 3: Configurar `.env.local`

```dotenv
WHATSAPP_PROVIDER=ultramsg
ULTRAMSG_INSTANCE_ID=instance_xxxxx
ULTRAMSG_TOKEN=token_xxxxx
```

### Paso 4: Instalar SDK

```bash
# No es necesario - usamos fetch directamente
```

### Paso 5: Probar

```typescript
const response = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: token,
    to: '573201234567',
    body: 'Hola, esto es una prueba',
  })
});
```

**Costos:**
- ✅ 50 mensajes/mes gratis
- 📊 Después: ~$1 USD por 100 mensajes

---

## 💬 WHATSAPP OPCIÓN 3: BAILEYS (Completamente gratuito)

> **Requiere más configuración pero es 100% gratis e ilimitado.**

### ¿Qué es Baileys?

Baileys es una librería que usa **WhatsApp Web** para enviar mensajes. No requiere número de teléfono separada ni pago.

### Paso 1: Crear servidor Baileys separado

```bash
# En una carpeta nueva
mkdir baileys-server && cd baileys-server
npm init -y
npm i @whiskeysockets/baileys pino pino-pretty express
npm i -D typescript ts-node
```

### Paso 2: Crear `index.ts`

```typescript
// baileys-server/index.ts
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import express from 'express';
import { Boom } from '@hapi/boom';

const app = express();
app.use(express.json());

let sock: any;

async function connectWhatsApp() {
  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: true,
  });

  // Cuando se conecta
  sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        connectWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp conectado!');
    }
  });
}

// Endpoint para enviar mensajes
app.post('/send-message', async (req, res) => {
  const { to, text } = req.body;

  try {
    await sock.sendMessage(to, { text });
    res.json({ success: true, message: 'Enviado' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(3001, () => {
  console.log('🚀 Servidor Baileys en puerto 3001');
  connectWhatsApp();
});
```

### Paso 3: Ejecutar servidor

```bash
npx ts-node index.ts
```

**Primera vez:**
- Te aparecerá un código QR en la terminal
- Escanea con tu teléfono WhatsApp (Settings > Linked Devices)
- ✅ Listo, ya está conectado

### Paso 4: Configurar en tu proyecto principal

```dotenv
WHATSAPP_PROVIDER=baileys
BAILEYS_SERVER_URL=http://localhost:3001
```

**Costos:**
- ✅ 100% GRATIS
- ✅ Ilimitado
- ❌ Necesita servidor siempre corriendo
- ⚠️ WhatsApp puede bloquearte si detecta bots (usar con cuidado)

---

## 🚀 GUÍA RÁPIDA DE SETUP (5 minutos)

### Para testing local rápido:

```bash
# 1. Crear cuenta Resend (2 min)
# → https://resend.com → Sign up

# 2. Obtener API Key
# → Dashboard → API Keys → Copiar

# 3. Configurar .env.local
cat > .env.local << 'EOF'
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_VERIFIED_SENDER=noreply@resend.dev
RESEND_VERIFIED_SENDER_NAME=Boletas
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+1234567890
EOF

# 4. Instalar dependencias
npm i resend

# 5. Listo ✅
```

### Para producción:

```bash
# 1. Resend o SendGrid (email)
# 2. Twilio Sandbox → Pasar a cuenta profesional (WhatsApp)
# 3. O usar Baileys (si es aplicación privada)
# 4. Verificar dominio en Resend/SendGrid
# 5. Crear tabla de logs (correr migration)
# 6. Deploy a Vercel
```

---

## 🧪 PRUEBA FINAL: Validar que todo funciona

### Test 1: Enviar correo

```bash
# Crear archivo test.mjs
cat > test.mjs << 'EOF'
import { EmailService } from './src/lib/services/emailService.ts';

try {
  await EmailService.sendEmail({
    to: 'tu.email@gmail.com',
    subject: '✅ Test Email',
    html: '<h1>¡Funciona!</h1>'
  });
  console.log('✅ Correo enviado');
} catch (error) {
  console.error('❌ Error:', error.message);
}
EOF

node test.mjs
```

### Test 2: Enviar WhatsApp (Twilio)

```typescript
// En Twilio console:
// 1. Messaging > Try it out > WhatsApp
// 2. Enviar mensaje: "join smart-fox" (o el código que Twilio muestra)
// 3. Esperar confirmación

// Luego desde tu código:
import { notificationService } from '@/lib/services/notificationService';

await notificationService.send({
  to: '+573201234567', // Tu número
  channel: 'whatsapp',
  type: 'payment_confirmed',
  context: {
    orderId: '#001',
    customerName: 'Juan',
    amount: 50000,
    eventName: 'Concierto',
    eventDate: '2026-09-01',
    zone: 'VIP',
    quantity: 2
  }
});
```

---

## ✅ Checklist Final

- [ ] Crear cuenta en Resend (o SendGrid)
- [ ] Obtener API Key
- [ ] Configurar `.env.local`
- [ ] Instalar dependencias (`npm i resend`)
- [ ] Correr migration en Supabase
- [ ] Probar envío de correo
- [ ] Crear cuenta Twilio (o elegir alternativa)
- [ ] Configurar WhatsApp (Sandbox)
- [ ] Probar envío de WhatsApp
- [ ] Integrar webhook de WOMPI
- [ ] ¡Probar un pago completo!

---

## 📞 Soporte Rápido

| Problema | Solución |
|----------|----------|
| "API Key no válida" | Verifica que copiaste bien en `.env.local` sin espacios |
| "Correo va a SPAM" | Verifica dominio en Resend; espera 24h propagación DNS |
| "WhatsApp no envía" | En Twilio sandbox, el número debe estar pre-verificado |
| "Error 401" | Verifica credenciales de Twilio (Account SID, Auth Token) |
| "Servidor Baileys no conecta" | Verifica QR escaneo en WhatsApp; puede tardar 30s en conectar |

---

¡Listo! Con esta guía deberías tener email + WhatsApp funcionando en menos de 15 minutos. 🚀
