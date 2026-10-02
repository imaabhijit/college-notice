const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
const port = process.env.PORT || 10000;

// WhatsApp Client Setup with Memory Fixes
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

let currentQR = '';

client.on('qr', (qr) => {
    currentQR = qr;
    console.log('Notun QR code toiri hoyeche! Web e giye scan koro.');
});

// -- NOTUN LOGS GULO EKHANE ADD KORA HOLO --
client.on('authenticated', () => {
    console.log('QR Scan successful! Ebar chat history sync hocche (Ete ektu somoy lagte pare, wait koro)...');
});

client.on('auth_failure', msg => {
    console.error('Authentication fail hoyeche:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Bot disconnect hoye geche!', reason);
});
// -----------------------------------------

client.on('ready', () => {
    currentQR = '';
    console.log('WhatsApp Bot Ready hoye geche!');
});

// "message_create" use kora holo jate nijer kora message o bot porte pare
client.on('message_create', async msg => {
    if (msg.body === '!id') {
        const chat = await msg.getChat();
        console.log('Ei chat er ID holo:', chat.id._serialized);
        msg.reply(`Ei chat er ID: ${chat.id._serialized}`);
    }
});

client.initialize();

// QR Code Web Page Route
app.get('/qr', (req, res) => {
    if (currentQR) {
        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
                <h2>WhatsApp Bot Log In</h2>
                <p>Nicher QR Code ta WhatsApp theke scan koro:</p>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}" alt="WhatsApp QR" />
                <p>Scan na hole page ta ekbar reload koro.</p>
            </div>
        `);
    } else {
        res.send('<h2 style="text-align:center; margin-top:50px;">QR Code ekhono toiri hoyni ba Bot already Log In hoye aache. Render Logs check koro.</h2>');
    }
});

// API Endpoint for Sending Notices
app.get('/send-notice', async (req, res) => {
    const { message, secret, media_url } = req.query;

    if (secret !== 'rampurhat123') {
        return res.status(403).json({ error: 'Unauthorized Access' });
    }

    if (!message) {
        return res.status(400).json({ error: 'Message missing' });
    }

    try {
        const groupIds = [
            'YOUR_GROUP_ID@g.us' // Pore ekhane asol group ID bosate hobe
        ]; 
        
        let media = null;
        if (media_url) {
            console.log(`Downloading media from: ${media_url}`);
            media = await MessageMedia.fromUrl(media_url, { unsafeMime: true });
        }

        for (let id of groupIds) {
            if (media) {
                await client.sendMessage(id, media, { caption: message }); 
            } else {
                await client.sendMessage(id, message);
            }
            console.log(`Message sent to group: ${id}`);
        }
        
        res.json({ success: true, info: 'Message pathano hoyeche' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.listen(port, () => {
    console.log(`Express API server running on port ${port}`);
});
