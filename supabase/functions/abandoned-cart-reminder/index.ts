import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CartData {
  id: string;
  user_id: string;
  items: any[];
  subtotal: number;
  total: number;
  updated_at: string;
}

interface UserData {
  email: string;
  user_metadata: {
    full_name?: string;
  };
}

async function sendAbandonedCartEmail(userEmail: string, userName: string, cart: CartData) {
  const cartTotal = cart.total || cart.subtotal;
  const itemCount = cart.items?.length || 0;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; }
          .content { margin: 20px 0; }
          .items-summary { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
          .footer { color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¿Olvidaste tu carrito?</h1>
          </div>

          <div class="content">
            <p>Hola ${userName},</p>
            <p>Vimos que dejaste ${itemCount} boleta(s) en tu carrito por un valor de <strong>$${cartTotal.toLocaleString('es-CO')}</strong>.</p>

            <div class="items-summary">
              <p><strong>Resumen:</strong></p>
              <ul>
                <li>Total de items: ${itemCount}</li>
                <li>Monto: $${cartTotal.toLocaleString('es-CO')}</li>
                <li>Última actualización: ${new Date(cart.updated_at).toLocaleDateString('es-CO')}</li>
              </ul>
            </div>

            <p>No dejes pasar esta oportunidad. Completa tu compra antes de que se agoten las boletas.</p>

            <a href="${Deno.env.get('NEXT_PUBLIC_SITE_URL')}/carrito" class="cta-button">Completar mi compra</a>

            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Si no reconoces esta compra o prefieres no recibir más recordatorios,
              <a href="${Deno.env.get('NEXT_PUBLIC_SITE_URL')}/preferences" style="color: #2563eb;">actualiza tus preferencias</a>.
            </p>
          </div>

          <div class="footer">
            <p>© 2026 Boletas. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'noreply@boletas.com',
        to: userEmail,
        subject: `¡No olvides tu carrito! $${cartTotal.toLocaleString('es-CO')} en espera`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      console.error('Error sending email:', await response.text());
      return false;
    }

    console.log(`Email enviado a ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Error en sendAbandonedCartEmail:', error);
    return false;
  }
}

async function processAbandonedCarts() {
  try {
    // Obtener carritos sin procesar en las últimas 24 horas
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: carts, error: cartsError } = await supabase
      .from('shopping_carts')
      .select('id, user_id, items, subtotal, total, updated_at')
      .is('abandoned_at', null)
      .lt('updated_at', oneDayAgo)
      .gt('updated_at', new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString())
      .filter('items', 'cs', '[]', { negate: true });

    if (cartsError) throw cartsError;

    if (!carts || carts.length === 0) {
      console.log('No hay carritos abandonados');
      return { processed: 0, sent: 0, errors: 0 };
    }

    let sent = 0;
    let errors = 0;

    for (const cart of carts as CartData[]) {
      try {
        // Obtener datos del usuario
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
          cart.user_id
        );

        if (userError || !userData?.user?.email) {
          console.error('Error obtaining user data:', userError);
          errors++;
          continue;
        }

        const user = userData.user as UserData;
        const userName = user.user_metadata?.full_name || 'Usuario';

        // Enviar email
        const emailSent = await sendAbandonedCartEmail(user.email, userName, cart);

        if (emailSent) {
          // Marcar carrito como abandonado
          await supabase
            .from('shopping_carts')
            .update({ abandoned_at: new Date().toISOString() })
            .eq('id', cart.id);

          sent++;
        } else {
          errors++;
        }
      } catch (error) {
        console.error('Error processing cart:', error);
        errors++;
      }
    }

    console.log(`Proceso completado: ${sent} enviados, ${errors} errores`);
    return { processed: carts.length, sent, errors };
  } catch (error) {
    console.error('Error en processAbandonedCarts:', error);
    throw error;
  }
}

serve(async (req: Request) => {
  // Verificar token de autorización
  const authHeader = req.headers.get('authorization');
  const expectedToken = Deno.env.get('CRON_SECRET');

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await processAbandonedCarts();

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
