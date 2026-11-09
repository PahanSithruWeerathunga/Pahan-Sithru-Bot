const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const respondedUsers = new Set();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('සම්බන්ධතාවය විසන්ධි විය, නැවත සම්බන්ධ වෙමින්...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('WhatsApp Bot සාර්ථකව සක්‍රීය විය!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe || msg.key.remoteJid.endsWith('@g.us')) continue;

            const senderJid = msg.key.remoteJid;
            const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

            try {
                if (!respondedUsers.has(senderJid)) {
                    respondedUsers.add(senderJid);
                    const welcomeMsg = "හායි! මම පහන් සිත්රූ. මේ වෙලාවේ මට කෙලින්ම Phone එකට සම්බන්ධ වෙන්න විදිහක් නෑ. ඔබ එවපු Message එකට ස්තූතියි! ඔබට අවශ්‍ය දේ තබන්න, මගේ AI සහායකයා ඔබට පිළිතුරු දෙනු ඇත.";
                    await sock.sendMessage(senderJid, { text: welcomeMsg });
                }

                if (!textMessage) continue;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: textMessage,
                    config: {
                        systemInstruction: "ඔබ පහන් සිත්රූ ගේ AI සහායකයා වේ. පැමිණෙන පණිවිඩ වලට ඉතා සුහදශීලීව, කෙටියෙන් සහ පැහැදිලිව සිංහලෙන් හෝ ඉංග්‍රීසියෙන් පිළිතුරු දෙන්න. කිසිදු වෙනත් App එකක, Brand එකක හෝ AI එකක නමක් සඳහන් නොකරන්න."
                    }
                });

                const replyText = response.text;
                await sock.sendMessage(senderJid, { text: replyText });

            } catch (err) {
                console.error('AI Error:', err);
            }
        }
    });
}

startBot();
