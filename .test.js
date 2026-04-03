
        // Inicializar Supabase (Credenciales Temporales - REEMPLAZAR CON LAS REALES)
        const supabaseUrl = 'https://kefumnhetasvwhfkgmab.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZnVtbmhldGFzdndoZmtnbWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDE4MzUsImV4cCI6MjA5MDgxNzgzNX0.5VCYnoiT2hOMt6L5TLoRn6Xq1NleQ8-uzEN1WxitVZQ';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

        const MAX_TICKETS = 1200;

        // Lógica simple para abrir/cerrar el modal de compra
        const modal = document.getElementById('ticketModal');

        function openModal() {
            modal.style.display = 'flex';
        }

        function closeModal() {
            modal.style.display = 'none';
        }

        // Cerrar modal si se hace clic fuera del contenido
        window.onclick = function (event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
            const qrModal = document.getElementById('qrResultModal');
            if (event.target == qrModal) {
                qrModal.style.display = "none";
            }
        }

        async function updateTicketDisplay() {
            const { count, error } = await supabase
                .from('tickets')
                .select('*', { count: 'exact', head: true });

            if (!error) {
                const sold = count || 0;
                let left = MAX_TICKETS - sold;
                if (left < 0) left = 0;

                document.getElementById('tickets-left').textContent = left;
                const percentage = (left / MAX_TICKETS) * 100;
                document.getElementById('ticket-progress').style.width = percentage + '%';
            }
        }

        // Escuchar cambios en base de datos en tiempo real para actualizar contador visual a todos los usuarios
        supabase.channel('public:tickets')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, payload => {
                updateTicketDisplay();
            })
            .subscribe();

        async function handlePurchase(e) {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');

            try {
                const qty = parseInt(document.getElementById('quantity').value);
                const name = document.getElementById('fullName').value;
                const email = document.getElementById('email').value;

                btn.textContent = 'Procesando...';
                btn.style.opacity = '0.7';
                btn.disabled = true;

                // Validación rápida de límite
                const { count, error: countError } = await supabase.from('tickets').select('*', { count: 'exact', head: true });

                if (countError) {
                    throw new Error("No se pudo conectar a la tabla de boletos. Revisa Supabase: " + countError.message);
                }

                if (count + qty > MAX_TICKETS) {
                    alert('Lo sentimos, no hay suficientes boletos disponibles para esta cantidad.');
                    resetButton(btn);
                    return;
                }

                // Preparar el array de boletos a insertar
                const ticketsToInsert = [];
                for (let i = 0; i < qty; i++) {
                    ticketsToInsert.push({ owner_name: name, owner_email: email, used: false });
                }

                // Insertar en Supabase
                const { data, error } = await supabase
                    .from('tickets')
                    .insert(ticketsToInsert)
                    .select();

                if (error) {
                    throw new Error("No se pudieron generar los boletos: " + error.message);
                }

                // Generar la interfaz para mostrar los QRs
                showQRTickets(data);
                e.target.reset();
                resetButton(btn);
            } catch (err) {
                console.error("Excepción en handlePurchase:", err);
                alert("✖ ERROR: " + err.message);
                resetButton(btn);
            }
        }

        function resetButton(btn) {
            btn.textContent = 'Finalizar Compra';
            btn.style.opacity = '1';
            btn.disabled = false;
        }

        function showQRTickets(tickets) {
            closeModal(); // Cerrar formulario

            let qrContainer = document.getElementById('qrResultModal');
            if (!qrContainer) {
                qrContainer = document.createElement('div');
                qrContainer.id = 'qrResultModal';
                qrContainer.className = 'modal';
                document.body.appendChild(qrContainer);
            }

            let html = `
                <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
                    <span class="close-btn" onclick="document.getElementById('qrResultModal').style.display='none'">&times;</span>
                    <h2 style="color: var(--accent-fire); margin-bottom: 1rem;">¡Accesos Generados!</h2>
                    <p style="margin-bottom: 2rem;">Toma captura de pantalla a cada Código QR o guárdalo. <strong>Será escaneado en la entrada.</strong></p>
                    <div id="qrs-wrapper" style="display: flex; flex-direction: column; gap: 2rem; align-items: center;"></div>
                </div>
            `;
            qrContainer.innerHTML = html;
            qrContainer.style.display = 'flex';

            const wrapper = document.getElementById('qrs-wrapper');
            tickets.forEach(ticket => {
                const ticketCard = document.createElement('div');

                // --- Diseño premium (Flyer/Boleto Digital) ---
                ticketCard.style = `
                    background: linear-gradient(145deg, #181a20, #0d0e12);
                    border: 1px solid rgba(255, 90, 85, 0.4);
                    border-radius: 15px;
                    color: #fff;
                    text-align: center;
                    width: 300px;
                    overflow: hidden;
                    box-shadow: 0 15px 35px rgba(255, 90, 85, 0.2);
                    position: relative;
                `;

                // Cabecera del boleto
                const header = document.createElement('div');
                header.style = 'background: linear-gradient(90deg, var(--accent-fire), #ff2a25); padding: 1rem; border-bottom: 2px dashed rgba(255,255,255,0.3);';
                header.innerHTML = `<h3 style="margin:0; font-family: 'Anton', sans-serif; font-size: 1.8rem; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">Derramamiento</h3> <p style="margin: 5px 0 0 0; font-size: 0.8rem; font-weight: bold; text-transform: uppercase;">Acceso General</p>`;
                ticketCard.appendChild(header);

                // Cuello del boleto (Sección principal)
                const bodyDiv = document.createElement('div');
                bodyDiv.style = 'padding: 2rem 1.5rem; background: radial-gradient(circle at center, rgba(59, 139, 143, 0.15) 0%, transparent 80%);';

                // Mostrar Número de Serie
                const serial = document.createElement('div');
                serial.innerHTML = `<span style="color: var(--accent-teal); font-weight: 700; font-size: 1.2rem; letter-spacing: 2px;">BOLETO N° ${String(ticket.serial_number).padStart(4, '0')}</span>`;
                serial.style = 'margin-bottom: 1.5rem; padding-bottom: 1rem;';
                bodyDiv.appendChild(serial);

                // Contenedor blanco para el QR para asegurar que pueda escanearse independientemente del fondo oscuro
                const qrBorder = document.createElement('div');
                qrBorder.style = 'background: #fff; padding: 12px; border-radius: 12px; display: inline-block; margin-bottom: 1.5rem; box-shadow: 0 5px 15px rgba(0,0,0,0.5);';

                const qrDiv = document.createElement('div');
                qrBorder.appendChild(qrDiv);
                bodyDiv.appendChild(qrBorder);

                // Generar el código QR con el UUID secreto
                new QRCode(qrDiv, {
                    text: ticket.id,
                    width: 160,
                    height: 160,
                    colorDark: "#050505",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });

                // Datos del titular
                const owner = document.createElement('p');
                owner.innerHTML = `<span style="font-size: 0.75rem; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">Titular del pase</span><br><strong style="font-size: 1.2rem; color: #fff; text-transform: uppercase;">${ticket.owner_name}</strong>`;
                owner.style = 'margin-top: 0.5rem; line-height: 1.4;';
                bodyDiv.appendChild(owner);

                ticketCard.appendChild(bodyDiv);
                wrapper.appendChild(ticketCard);
            });
        }

        // Lógica del aviso de cookies
        function acceptCookies() {
            document.getElementById('cookieBanner').style.display = 'none';
            localStorage.setItem('cookiesAccepted', 'true');
        }

        // Inicializar
        window.onload = function () {
            if (localStorage.getItem('cookiesAccepted') === 'true') {
                document.getElementById('cookieBanner').style.display = 'none';
            }
            updateTicketDisplay();
        }
    