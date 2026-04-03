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
            const scanUrl = encodeURIComponent(`https://ticketsipum.netlify.app/escaner.html?id=${t.id}`);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${scanUrl}`;
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

        const htmlEmail = `
        <div style="font-family: sans-serif; text-align: center; color: #333; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #e11d48; margin-bottom: 5px;">¡Gracias por tu registro!</h1>
                <h3 style="color: #333; margin-top: 0;">Evento: Derramamiento</h3>
                <p style="font-size: 16px;">Hola <strong>${ownerName}</strong>, tu compra ha sido procesada con éxito.</p>
                <p>A continuación encontrarás tus boletos digitales. Puedes presentar este correo directamente desde tu celular en la puerta del evento.</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                ${ticketsHtml}

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="color:#888; font-size: 12px;">Bendiciones.<br>Equipo Organizador</p>
            </div>
        </div>
        `;

        const mailOptions = {
            from: `"Venta de Boletos" <${process.env.GMAIL_USER}>`,
            to: ownerEmail,
            subject: `Tus Boletos para DERRAMAMIENTO - N° ${String(ticketArray[0].serial_number).padStart(4, '0')}`,
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
