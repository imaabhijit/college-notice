const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const axios = require('axios');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 10000;

let sock;
let currentQR = '';

async function connectToWhatsApp() {
    // Login data save korar jaiga
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }) // Faltu log asbe na
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            currentQR = qr;
            console.log('Notun QR code toiri hoyeche! Web theke scan koro.');
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            currentQR = '';
            console.log('🎉 WhatsApp Bot Ready hoye geche! Ebar ar crash korbe na!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Group theke !id ber korar jonno
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (text === '!id') {
            const chatId = msg.key.remoteJid;
            console.log('Ei chat er ID holo:', chatId);
            await sock.sendMessage(chatId, { text: `Ei chat er ID: ${chatId}` });
        }
    });
}

connectToWhatsApp();

// QR dekhar web page
app.get('/qr', (req, res) => {
    if (currentQR) {
        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
                <h2>WhatsApp Bot Log In (Lite Version)</h2>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}" alt="WhatsApp QR" />
                <p>Scan na hole page ta ekbar reload koro.</p>
            </div>
        `);
    } else {
        res.send('<h2 style="text-align:center; margin-top:50px;">QR Code nei ba Bot Login aache. Render Logs check koro.</h2>');
    }
});

// API for InfinityFree
app.get('/send-notice', async (req, res) => {
    const { message, secret, media_url } = req.query;

    if (secret !== 'rampurhat123') return res.status(403).json({ error: 'Unauthorized' });
    if (!message) return res.status(400).json({ error: 'Message missing' });

    try {
        const groupIds = [
            '120363410748058447@g.us' // Asol group ID pore bosabe
        ]; 
        
        let buffer = null;
        let mimeType = '';
        let fileName = '';

        if (media_url) {
            console.log(`Downloading media: ${media_url}`);
            const response = await axios.get(media_url, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data, 'binary');
            
            if(media_url.toLowerCase().endsWith('.pdf')) {
                mimeType = 'application/pdf';
                fileName = 'Notice.pdf';
            } else {
                mimeType = 'image/jpeg';
            }
        }

        for (let id of groupIds) {
            if (buffer) {
                if(mimeType === 'application/pdf') {
                    await sock.sendMessage(id, { document: buffer, mimetype: mimeType, fileName: fileName, caption: message });
                } else {
                    await sock.sendMessage(id, { image: buffer, caption: message });
                }
            } else {
                await sock.sendMessage(id, { text: message });
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to send' });
    }
});

app.listen(port, () => {
    console.log(`API running on port ${port}`);
});
