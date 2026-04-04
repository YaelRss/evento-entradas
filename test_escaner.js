        // Inicializar Supabase (Reemplazar con las reales!)
        const supabaseUrl = 'https://kefumnhetasvwhfkgmab.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZnVtbmhldGFzdndoZmtnbWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDE4MzUsImV4cCI6MjA5MDgxNzgzNX0.5VCYnoiT2hOMt6L5TLoRn6Xq1NleQ8-uzEN1WxitVZQ';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

        let html5QrcodeScanner;
        let isProcessing = false;

        function startScanner() {
            document.getElementById('startBtn').style.display = 'none';

            html5QrcodeScanner = new Html5Qrcode("reader");
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
                .catch(err => {
                    alert("Error al acceder a la cámara: " + err);
                    document.getElementById('startBtn').style.display = 'block';
                });
        }

        async function onScanSuccess(decodedText, decodedResult) {
            if (isProcessing) return; // Evitar escaneos dobles rápidos
            isProcessing = true;

            // Pausar lector mientras verificamos
            if (html5QrcodeScanner) {
                html5QrcodeScanner.pause(true);
            }

            await verifyTicket(decodedText);
        }

        function onScanFailure(error) {
            // Se ejecuta constantemente mientras enfoca, lo ignoramos
        }

        async function verifyTicket(ticketId) {
            const box = document.getElementById('result-box');
            const title = document.getElementById('result-title');
            const details = document.getElementById('result-details');

            box.style.display = 'block';
            box.className = '';
            title.textContent = 'Verificando en base de datos...';
            details.innerHTML = '';

            // Si el texto es una URL (porque el QR nuevo trae la URL completa), extraer sólo el ID
            if (ticketId.includes('?id=')) {
                ticketId = ticketId.split('?id=')[1].split('&')[0];
            }

            try {
                // Prevenir que escaneen cualquier QR (debe ser un UUID válido para buscar en bd)
                if (!ticketId || ticketId.length < 30) throw new Error("QR no es nuestro formato");

                const { data, error } = await supabase
                    .from('tickets')
                    .select('*')
                    .eq('id', ticketId)
                    .single();

                if (error || !data) {
                    throw new Error("Boleto no encontrado");
                }

                if (data.used === true) {
                    box.classList.add('status-used');
                    title.textContent = '❌ BOLETO YA UTILIZADO';
                    details.innerHTML = `El boleto #${data.serial_number} ya fue ingresado anteriormente.<br>A nombre de: ${data.owner_name}`;
                } else {
                    // Marcar como usado
                    const { error: updateError } = await supabase
                        .from('tickets')
                        .update({ used: true })
                        .eq('id', ticketId);

                    if (updateError) {
                        box.classList.add('status-invalid');
                        title.textContent = '⚠️ Error actualizando base de datos';
                    } else {
                        box.classList.add('status-valid');
                        title.textContent = '✅ ACCESO AUTORIZADO';
                        details.innerHTML = `Boleto N° ${data.serial_number}<br>A nombre de: <b>${data.owner_name}</b>`;
                    }
                }
            } catch (err) {
                box.classList.add('status-invalid');
                title.textContent = '🚫 BOLETO INVÁLIDO';
                details.innerHTML = 'Este código QR no pertenece a este evento o no está registrado.';
            }

            // Reactivar el escaner después de 4 segundos
            setTimeout(() => {
                box.style.display = 'none';
                isProcessing = false;
                if (html5QrcodeScanner) {
                    html5QrcodeScanner.resume();
                } else {
                    // Si entraron directo por URL y ya se validó, ofrecer abrir camara para el siguiente
                    document.getElementById('startBtn').style.display = 'block';
                }
            }, 4000);
        }

        // Ejecutar revisión automática si el personal de staff escaneó el QR con la app de Cámara nativa del celular
        window.addEventListener('load', () => {
            const params = new URLSearchParams(window.location.search);
            const id = params.get('id');
            if (id) {
                document.getElementById('startBtn').style.display = 'none';
                verifyTicket(id);
                // Limpiar la URL para evitar una validación repetida si el usuario recarga la página
                window.history.replaceState(null, '', window.location.pathname);
            }
        });
