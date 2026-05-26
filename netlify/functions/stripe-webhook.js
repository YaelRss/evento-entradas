const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Usar la Service Role para saltar el RLS
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Verificamos que la petición venga realmente de Stripe
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Error de firma del Webhook de Stripe:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Si el pago fue exitoso
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    
    // Extraemos los IDs de los boletos guardados en los metadatos
    const ticketIdsString = session.metadata && session.metadata.ticket_ids;
    
    if (ticketIdsString) {
      const ticketIds = ticketIdsString.split(',');
      
      console.log(`Procesando pago exitoso para boletos: ${ticketIds.join(', ')}`);

      // Actualizamos específicamente los boletos correspondientes en Supabase
      const { data: updatedTickets, error } = await supabase
        .from('tickets')
        .update({ status: 'paid' })
        .in('id', ticketIds)
        .select();

      if (error) {
        console.error("Error al actualizar estado del boleto en Supabase:", error);
        return { statusCode: 500, body: `Error actualizando DB: ${error.message}` };
      }

      if (updatedTickets && updatedTickets.length > 0) {
        console.log(`Se actualizaron ${updatedTickets.length} boletos a 'paid' en Supabase.`);

        // Disparamos el envío del correo electrónico con los boletos QR
        try {
          const ownerEmail = updatedTickets[0].owner_email;
          const ownerName = updatedTickets[0].owner_name;

          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_PASS
            }
          });

          // Generar el bloque visual HTML de los tickets
          const ticketsHtml = updatedTickets.map(t => {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${t.id}`;
            const num = t.serial_number ? String(t.serial_number).padStart(4, '0') : t.id.substring(0, 4).toUpperCase();
            return `
              <div style="border: 2px dashed #e11d48; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px; background-color: #fce7f3; max-width: 350px; margin-left: auto; margin-right: auto;">
                <h2 style="margin: 0; color: #be123c;">BOLETO N° ${num}</h2>
                <p style="color: #4c1d95; text-transform: uppercase; font-weight: bold; margin-top: 5px;">Titular: ${t.owner_name}</p>
                <div style="background: white; display: inline-block; padding: 15px; border-radius: 10px; margin-top: 10px; border: 1px solid #ccc;">
                  <img src="${qrUrl}" width="200" height="200" alt="Boleto QR ${num}">
                </div>
                <p style="font-size: 12px; color: #666; margin-top: 15px;">Este código QR es único. Debes presentarlo en la entrada del evento para ser escaneado.</p>
              </div>
            `;
          }).join('');

          const htmlEmail = `
          <div style="font-family: sans-serif; text-align: center; color: #333; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h1 style="color: #e11d48; margin-bottom: 5px;">¡Gracias por tu pago!</h1>
              <h3 style="color: #333; margin-top: 0;">Evento: Derramamiento</h3>
              <p style="font-size: 16px;">Hola <strong>${ownerName}</strong>, tu pago a través de tarjeta ha sido acreditado exitosamente.</p>
              <p>A continuación encontrarás tus boletos digitales. Puedes presentar este correo directamente desde tu celular en la puerta del evento.</p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              ${ticketsHtml}

              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color:#888; font-size: 12px;">Bendiciones.<br>Equipo Organizador</p>
            </div>
          </div>
          `;

          const firstSerial = updatedTickets[0].serial_number 
            ? String(updatedTickets[0].serial_number).padStart(4, '0') 
            : updatedTickets[0].id.substring(0, 4).toUpperCase();

          const mailOptions = {
            from: `"Venta de Boletos" <${process.env.GMAIL_USER}>`,
            to: ownerEmail,
            subject: `Tus Boletos para DERRAMAMIENTO - N° ${firstSerial}`,
            html: htmlEmail
          };

          await transporter.sendMail(mailOptions);
          console.log(`Correo enviado exitosamente a: ${ownerEmail}`);

        } catch (mailErr) {
          console.error("Error al enviar correo después del webhook de pago:", mailErr);
        }
      }
    } else {
      console.warn("Se recibió evento checkout.session.completed de Stripe pero no contenía ticket_ids en la metadata.");
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};