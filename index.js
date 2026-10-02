const express = require('express');
const { default: makeWASocket, DisconnectReason, BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');
const axios = require('axios');
const pino = require('pino');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 10000;

// Render er Secret File theke lukiye rakha password neya hocche
const serviceAccount = require('/etc/secrets/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://collegenoticebot-f205f-default-rtdb.firebaseio.com/"
});

const db = admin.database();

// Tomar 3 te ID ekhane set kora aache
const groupIds = [
    '120363410748058447@g.us',
    '253536919093428@lid',
    '120363411869910488@g.us'
];

let sock;
let currentQR = '';

// Firebase Memory System (Bot kokhono log out hobe na)
async function useFirebaseAuthState() {
    const collection = db.ref('whatsapp_auth');

    const writeData = async (data, id) => {
        const informationToStore = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
        await collection.child(id).set(informationToStore);
    };
    const readData = async (id) => {
        try {
            const snapshot = await collection.child(id).once('value');
            const data = snapshot.val();
            return data ? JSON.parse(JSON.stringify(data), BufferJSON.reviver) : null;
        } catch (error) { return null; }
    };
    const removeData = async (id) => {
        try { await collection.child(id).remove(); } catch (error) {}
    };

    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

async function connectToWhatsApp() {
    console.log('Firebase er sathe connect kora hocche...');
    const { state, saveCreds } = await useFirebaseAuthState();
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        keepAliveIntervalMs: 15000, // Protyek 15 sekond e WhatsApp ke ping korbe jate line na kate
        markOnlineOnConnect: true,  // Sarakhon "Online" dekhabe
        syncFullHistory: false      // Taratari connect howar jonno
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            currentQR = qr;
            console.log('Notun QR code toiri hoyeche!');
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('Server restart nichhe kintu login save aache! Abar connect hocche...');
                connectToWhatsApp();
            } else {
                console.log('Log out hoye geche! Firebase clear kora hocche...');
                db.ref('whatsapp_auth').remove().then(() => connectToWhatsApp());
            }
        } else if (connection === 'open') {
            currentQR = '';
            console.log('🎉 WhatsApp Bot Ready ar Memory Firebase e Save hoyeche!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (text === '!id') {
            const chatId = msg.key.remoteJid;
            await sock.sendMessage(chatId, { text: `Ei chat er ID: ${chatId}` });
        }
    });
}

connectToWhatsApp();

app.get('/qr', (req, res) => {
    if (currentQR) {
        res.send(`<div style="text-align: center; margin-top: 50px;"><h2>WhatsApp Bot Log In</h2><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}" alt="WhatsApp QR" /></div>`);
    } else {
        res.send('<h2 style="text-align:center; margin-top:50px;">QR Code nei ba Bot Login aache. Render Logs check koro.</h2>');
    }
});

app.get('/send-notice', async (req, res) => {
    const { message, secret, media_url, title } = req.query;

    if (secret !== 'rampurhat123') return res.status(403).json({ error: 'Unauthorized' });
    if (!message) return res.status(400).json({ error: 'Message missing' });

    try {
        let buffer = null;
        let mimeType = '';
        let fileName = '';

        if (media_url) {
            const response = await axios.get(media_url, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data, 'binary');
            
            if(media_url.toLowerCase().endsWith('.pdf')) {
                mimeType = 'application/pdf';
                let safeTitle = title ? title.replace(/[^a-zA-Z0-9 -]/g, '').trim() : 'Notice';
                fileName = `${safeTitle}.pdf`;
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
        res.status(500).json({ error: 'Failed to send' });
    }
});

app.listen(port, () => {
    console.log(`API running on port ${port}`);
});
          
