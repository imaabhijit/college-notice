// API for InfinityFree
app.get('/send-notice', async (req, res) => {
    // Ekhane 'title' tao receive kora hocche
    const { message, secret, media_url, title } = req.query;

    if (secret !== 'rampurhat123') return res.status(403).json({ error: 'Unauthorized' });
    if (!message) return res.status(400).json({ error: 'Message missing' });

    try {
        const groupIds = [
            '120363410748058447@g.us' // EKHANE TOMAR ASOL GROUP ID TA ABAR BOSIYE DIO!
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
                // Notice er title theke faltu character baad diye clean PDF name toiri kora
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
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to send' });
    }
});

app.listen(port, () => {
    console.log(`API running on port ${port}`);
});
