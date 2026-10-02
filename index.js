const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const port = process.env.PORT || 10000;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let currentQR = '';

client.on('qr', (qr) => {
    currentQR = qr;
    qrcode.generate(qr, { small: true });
    console.log('Web theke clear QR scan korte jao tomar app er /qr link e!');
});

client.on('ready', () => {
    currentQR = '';
    console.log('WhatsApp Bot Ready hoye geche!');
});

client.on('message', async msg => {
    if (msg.body === '!id') {
        console.log('Ei chat er ID holo:', msg.from);
        msg.reply(`Ei chat er ID: ${msg.from}`);
    }
});

client.initialize();

// QR code dekhar web link
app.get('/qr', (req, res) => {
    if (currentQR) {
        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
                <h2>WhatsApp Bot Log In</h2>
                <p>Nicher QR Code ta WhatsApp theke scan koro:</p>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}" alt="WhatsApp QR" />
                <p>Nijetheke refresh hobe na, scan na hole page ta ekbar reload koro.</p>
            </div>
        `);
    } else {
        res.send('<h2 style="text-align:center; margin-top:50px;">QR Code ekhono toiri hoyni ba Bot already Log In hoye aache. Render Logs check koro.</h2>');
    }
});

// API jeta InfinityFree theke call kora hobe
app.get('/send-notice', async (req, res) => {
    const { message, secret, media_url } = req.query;

    if (secret !== 'rampurhat123') {
        return res.status(403).json({ error: 'Unauthorized Access' });
    }

    if (!message) {
        return res.status(400).json({ error: 'Message missing' });
    }

    try {
        // Ekhane tomar asol group ID gulo koma (,) diye likhte hobe
        const groupIds = [
            'YOUR_GROUP_ID_1@g.us',
            'YOUR_GROUP_ID_2@g.us'
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
        
        res.json({ success: true, info: 'Sob group e message pathano hoyeche' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.listen(port, () => {
    console.log(`Express API server running on port ${port}`);
});
