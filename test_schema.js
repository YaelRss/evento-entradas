const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const dbClient = createClient('https://kefumnhetasvwhfkgmab.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZnVtbmhldGFzdndoZmtnbWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDE4MzUsImV4cCI6MjA5MDgxNzgzNX0.5VCYnoiT2hOMt6L5TLoRn6Xq1NleQ8-uzEN1WxitVZQ', {
    auth: { persistSession: false },
    realtime: {
        transport: ws
    }
});

async function check() {
    // Intentar insertar un ticket con serial_number manual a ver si falla
    const { data, error } = await dbClient.from('tickets').insert({
        owner_name: 'Test Schema',
        owner_email: 'test@schema.com',
        serial_number: 9999,
        status: 'pending'
    }).select();
    
    console.log("Insert result:", error || data);
    
    if (data) {
        await dbClient.from('tickets').delete().eq('id', data[0].id);
    }
}
check();
