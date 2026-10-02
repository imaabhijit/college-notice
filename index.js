const express = require('express');
const { default: makeWASocket, DisconnectReason, BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');
const axios = require('axios');
const pino = require('pino');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 10000;

// Tomar Firebase config (JSON theke dewa)
const serviceAccount = {
  "type": "service_account",
  "project_id": "collegenoticebot-f205f",
  "private_key_id": "a7955f48a845014dbb1feea68f0f09aeda85fe6a",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCsJlCXjp2F+lit\nkNK/hcceFEK1BKwK5W5h9BqmuggoCJ9MkDI31jaiCJDYvGR8rPonBFa7/WGdrZ8w\nkEjSCIp13yi7M95pIFP4+CFba9PLdhy06dZvkNASMM+Ww9bpVo0HdphnaCUfksqx\n8gzuELgOx+63kM8gd1u9XR8ZFi99ZYcYKXdxSObXrjH/HRylBCFITHkkGNqdvSg2\nDLjgjmi+99RBu4d9CUqQ8N+1lx0/wyeznzkFvllOdzXxlxQ0Cjw7ebNDigGp5bTw\nbScG8KtTtrfoCvepvZW6lWqIuFNwTM6Q/aBdKzz7bZmAauMZ7pNfc+GFke8XDsiV\nWLeL43ezAgMBAAECggEAGmC8lJx7sp3LnLzGLiaXfhpopkgS/JBvO38l3ko/GbNI\nhXjK2Rdvw6BAYZVsaFYw9m2JxMBshral39Eb92LrpGgPW6/08nLLqyiKI/H/v/tX\nJrl17B5qY38rL9TOR27FqVEYxS+GELJzcJTAOnJBYbJs95+uvTDM09VDAJsPp8z4\nU/6+nak0HL2F84VlMrZRMQX/DDCo4NE561bmCu45wOEmPOLm4IpjiKa7nPS4Xb1x\ntfr5VK8DLbcoA3AMB4ChqZOPhYAGdPaZb93GzJBbXu+Z96+QMaiTJwlPLNkMCwSj\nrV09spZdLWikV0u8cccJFPTuMX+Gs0bi45jv84qi4QKBgQDfJbU/VzATWMcAKzbO\nrjar8tOGo1DiyQNaUEJyw27jiB5f14hzBf/UGJVp1mi0HReNhClTqGeEoszG/8yf\nyUEVBhbdHexXxR16H0Y4bIyI/nVf0mno/Jl21ioqc1PY1h+OqV8wlB7wzFi8Xrkq\nmpm94Ns8mg98YIaZD5AyU7LuOQKBgQDFfokopJREyahcyD2S8filVBDIBu6wqwRG\nniJXmzROHxEnX9ICRvnb9Nuh1F0hiiAedRb6VBocL2eZCy4lTG6sryj9lTxIIOsl\nFcyRcXiUw2kxJkMyB4T5HySUGrB54wSlrCVegWlNQqooIiawWh/9nt64b8Ym+oG0\nyYxEQFUVSwKBgBbs29MXFQRX0ZIN3oKbWViPCPZDHxM9jY+gwULjGyhbGqvEC+ut\nSRw0Ll2CPp2Kg5nxYwGKQqBYzWsAarhbx8juKDktUtOtl5qtTdyMImAMrGhcyK68\nDNQtqoVT9eBIF1PjyLjH7unURKWNob5jxbnBOSTfuwmPLSTaeXkCKlbZAoGBAIds\nNAsNh6n/iZZNrIM1ryVXFsbCkivMqPrvdmcSQvSKsw2H1A7BspVUOsKmR1I3T7zy\n11XCE8Fd9DDqjLMAzSdWWMpB6fsfr35Xi1X0NBX2RQxxy0PkChd1dnSkNHzv4YDl\nIR7DqHxVCS7J9DObKTKVHO3lnz+dKRHZ3nfykSUvAoGBAI8nipoyKS2NxkC3F5xF\ngPGTPTWZuLqifEyMLGD9rw+YYcatIdUMNhI5Q+ZFCM8VQpGTiALAc2o6cDqUoiG0\nR3sFb7lICr+kDIlIVD5WzNGWwUjn2Qk6H8reQYNtPRvS1361IWaC96Ruswo9wWN1\nnn4jjEbTOzLMlyHiB9Mk01Xe\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@collegenoticebot-f205f.iam.gserviceaccount.com",
  "client_id": "111735900932376339895",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40collegenoticebot-f205f.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

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

// Firebase Memory System
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
        logger: pino({ level: 'silent' }) 
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
