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

        // Configuración de Nodemailer utilizando variables de entorno de Netlify
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER, // Tu correo de Gmail, ej: eventotik@gmail.com
                pass: process.env.GMAIL_PASS  // Contraseña de aplicación de Gmail (NO es la contraseña normal)
            }
        });

        // Generar el bloque visual HTML de los tickets
        const ticketsHtml = ticketArray.map(t => {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${t.id}`;
            const num = String(t.serial_number).padStart(4, '0');
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

        const qty = ticketArray.length;
        const totalAmount = qty * 250;

        const htmlEmail = `
        <div style="font-family: sans-serif; text-align: center; color: #333; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #e11d48; margin-bottom: 5px;">¡Reserva Realizada!</h1>
                <h3 style="color: #333; margin-top: 0;">Evento: Derramamiento</h3>
                <p style="font-size: 16px; line-height: 1.5; color: #555;">Hola <strong>${ownerName}</strong>, tu reserva de <strong>${qty} boleto(s)</strong> ha sido registrada con éxito y tus accesos se encuentran apartados.</p>
                
                <div style="background-color: #fff5f5; border: 1px solid #feb2b2; padding: 20px; border-radius: 10px; margin: 25px 0; text-align: left;">
                    <h3 style="margin-top: 0; color: #c53030; border-bottom: 1px solid #feb2b2; padding-bottom: 8px;">💳 Instrucciones de Pago</h3>
                    <p style="font-size: 15px; margin-bottom: 12px; color: #2d3748;">Por favor, realiza tu transferencia o depósito por un total de <strong style="color: #e11d48; font-size: 17px;">$${totalAmount}.00 MXN</strong>:</p>
                    
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #4a5568;">
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold; width: 140px;">Banco:</td>
                            <td style="padding: 6px 0; color: #1a202c;">BBVA</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Número de Tarjeta:</td>
                            <td style="padding: 6px 0; color: #1a202c; letter-spacing: 0.5px;">4152 3137 3308 0290</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Beneficiario:</td>
                            <td style="padding: 6px 0; color: #1a202c;">Ángel Espinoza Salgado</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Concepto:</td>
                            <td style="padding: 6px 0; color: #1a202c;">Boleto ${ownerName.substring(0, 15)}</td>
                        </tr>
                    </table>
                    
                    <p style="font-size: 12px; color: #718096; margin-top: 15px; line-height: 1.4;">⚠️ <strong>Importante:</strong> Una vez realizado el pago, envía tu comprobante a nuestro WhatsApp para activar tus boletos de inmediato. Una vez verificado tu pago, tus boletos QR quedarán activos en el sistema para el acceso al evento.</p>
                </div>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <h3 style="color: #4a5568; margin-bottom: 15px;">Boletos Apartados:</h3>
                ${ticketsHtml}

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="color:#888; font-size: 12px;">Bendiciones.<br>Equipo Organizador</p>
            </div>
        </div>
        `;

        const mailOptions = {
            from: `"Venta de Boletos" <${process.env.GMAIL_USER}>`,
            to: ownerEmail,
            subject: `Reserva de Boleto(s) para DERRAMAMIENTO - N° ${String(ticketArray[0].serial_number).padStart(4, '0')}`,
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
