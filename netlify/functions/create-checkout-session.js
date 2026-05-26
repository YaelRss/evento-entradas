const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Solo permitir peticiones POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  try {
    const { ticketIds, email, quantity } = JSON.parse(event.body);

    if (!ticketIds || !email || !quantity) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan parámetros requeridos' }),
      };
    }

    // Usar la URL de la variable de entorno de Netlify o fallback local para desarrollo
    const siteUrl = process.env.URL || 'http://localhost:8888';

    // Crear la sesión de Stripe Checkout con desglose transparente
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: 'Boleto de Acceso - Derramamiento',
              description: 'Acceso general al evento del 2 y 3 de Octubre del 2026',
            },
            unit_amount: 25000, // $250.00 MXN en centavos
          },
          quantity: quantity,
        },
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: 'Cargo por Servicio (Comisión)',
              description: 'Comisión por procesamiento bancario',
            },
            unit_amount: 1500, // $15.00 MXN en centavos
          },
          quantity: quantity,
        },
      ],
      mode: 'payment',
      success_url: `${siteUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
      metadata: {
        ticket_ids: Array.isArray(ticketIds) ? ticketIds.join(',') : ticketIds,
        owner_email: email,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error('Error al crear sesión de Stripe Checkout:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
