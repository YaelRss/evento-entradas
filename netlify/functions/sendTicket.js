const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
    // Solo aceptar Peticiones POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body);
        const { ticketArray } = body; 

        if (!ticketArray || ticketArray.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: "No tickets provided" }) };
        }

        const ownerEmail = ticketArray[0].owner_email;
        const ownerName = ticketArray[0].owner_name;

        // Configuración de Nodemailer apuntando directamente al host de Brevo
        const transporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false, // false para puerto 587 (STARTTLS)
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS
            }
        });

        // Generar el bloque visual HTML de los tickets con estilo premium idéntico a la web
        const ticketsHtml = ticketArray.map(t => {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${t.id}`;
            const num = String(t.serial_number).padStart(4, '0');
            const flyerUrl = 'https://jovenes.ipumexico.com/flyer.jpg'; // Usar URL absoluta pública para que cargue en correos
            
            return `
                <div style="border: 2px dashed #ff5a55; border-radius: 15px; padding: 25px 20px; text-align: center; margin-bottom: 25px; background-color: #111111; max-width: 350px; margin-left: auto; margin-right: auto; box-shadow: 0 10px 20px rgba(0,0,0,0.3); color: #ffffff; font-family: sans-serif;">
                    <img src="${flyerUrl}" style="width: 100%; max-width: 310px; border-radius: 10px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);" alt="Flyer Derramamiento">
                    <h2 style="margin: 0; color: #ff5a55; font-family: Arial, sans-serif; letter-spacing: 1px; font-size: 20px; text-transform: uppercase;">BOLETO N° ${num}</h2>
                    <p style="color: #3b8b8f; text-transform: uppercase; font-weight: bold; margin-top: 5px; font-size: 13px; letter-spacing: 0.5px;">Titular: ${t.owner_name}</p>
                    <div style="background: white; display: inline-block; padding: 12px; border-radius: 10px; margin-top: 15px; border: 1px solid #ccc;">
                        <img src="${qrUrl}" width="160" height="160" alt="Boleto QR ${num}">
                    </div>
                    <p style="font-size: 11px; color: #aaaaaa; margin-top: 15px; line-height: 1.4;">Este código QR es único. Debes presentarlo en la entrada del evento para ser escaneado.</p>
                </div>
            `;
        }).join('');

        const qty = ticketArray.length;

        const htmlEmail = `
        <div style="font-family: sans-serif; text-align: center; color: #333; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #28a745; margin-bottom: 5px;">¡Pago Confirmado!</h1>
                <h3 style="color: #333; margin-top: 0;">Evento: Derramamiento</h3>
                <p style="font-size: 16px; line-height: 1.5; color: #555;">Hola <strong>${ownerName}</strong>, tu pago por <strong>${qty} boleto(s)</strong> ha sido verificado con éxito y tus accesos ya están activos en el sistema.</p>
                
                <div style="background-color: #f0fff4; border: 1px solid #c6f6d5; padding: 20px; border-radius: 10px; margin: 25px 0; text-align: left;">
                    <h3 style="margin-top: 0; color: #22543d; border-bottom: 1px solid #c6f6d5; padding-bottom: 8px;">📋 Información Importante</h3>
                    <p style="font-size: 13px; color: #2f855a; line-height: 1.5; margin-bottom: 0;">
                        ⚠️ <strong>Identificación requerida:</strong> El día del evento se solicitará una identificación física en la entrada para corroborar que el nombre registrado en cada boleto coincida con el asistente. Cada código QR es individual y válido para un solo acceso. ¡Guarda tus códigos de forma segura!
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <h3 style="color: #4a5568; margin-bottom: 15px;">Tus Boletos Confirmados:</h3>
                ${ticketsHtml}

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="color:#888; font-size: 12px;">Bendiciones.<br>Equipo Organizador</p>
            </div>
        </div>
        `;

        const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER;
        const mailOptions = {
            from: `"Boletos Derramamiento" <${senderEmail}>`,
            to: ownerEmail,
            subject: `Boleto(s) Confirmado(s) - DERRAMAMIENTO - N° ${String(ticketArray[0].serial_number).padStart(4, '0')}`,
            html: htmlEmail
        };

        const info = await transporter.sendMail(mailOptions);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: info.response })
        };
    } catch (err) {
        console.error("Nodemailer Error:", err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
}
