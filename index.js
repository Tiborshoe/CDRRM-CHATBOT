const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleGenAI } = require("@google/genai");

const app = express().use(bodyParser.json());
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = "CDRRMO_SECRET_2026";

// --- GLOBAL BUFFER: This stores reports temporarily while waiting for images/text ---
const reportBuffers = {};

// --- HELPER: Send FB Messenger Reply ---
async function sendMessengerReply(psid, text) {
  try {
    await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: psid },
      message: { text: text }
    });
  } catch (e) { console.error("Reply Error:", e.message); }
}

// --- HELPER: Download FB image and convert to Base64 for Gemini ---
async function fetchImageAsBase64(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary').toString('base64');
}

// --- ROUTE: Setup the Professional Menu ---
app.get('/setup-menu', async (req, res) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        "get_started": { "payload": "GET_STARTED_CLICKED" },
        "persistent_menu": [{
          "locale": "default",
          "composer_input_disabled": false,
          "call_to_actions": [
            { "type": "postback", "title": "Submit Incident Report", "payload": "REPORT_INCIDENT" },
            { "type": "postback", "title": "Emergency Hotlines", "payload": "EMERGENCY_HOTLINES" }
          ]
        }]
      }
    );
    res.send("Messenger Profile Setup Successful!");
  } catch (error) {
    console.error("META ERROR:", error.response?.data || error.message);
    res.status(500).send("Setup Failed.");
  }
});

// --- ROUTE: Facebook Verification Handshake ---
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else { res.sendStatus(403); }
});

// --- ROUTE: Main Chatbot Logic with Aggregation ---
app.post('/webhook', async (req, res) => {
  let body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id;

      // 1. Initialize buffer for this user if it doesn't exist
      if (!reportBuffers[sender_psid]) {
        reportBuffers[sender_psid] = { text: "", imageUrl: null, timer: null };
      }

      const buffer = reportBuffers[sender_psid];

      // A. HANDLE MENU CLICKS (Instant or Buffered)
      if (webhook_event.postback) {
        let payload = webhook_event.postback.payload;
        if (payload === 'GET_STARTED_CLICKED') {
          await sendMessengerReply(sender_psid, "Welcome to the Butuan City CDRRMO Official Chatbot. Use the menu below to start.");
          delete reportBuffers[sender_psid]; // Clear buffer
          continue;
        } else if (payload === 'EMERGENCY_HOTLINES') {
          await sendMessengerReply(sender_psid, "📞 Butuan Emergency: 911\n📞 CDRRMO: (085) 123-4567\n📞 BFP: (085) 987-6543");
          delete reportBuffers[sender_psid];
          continue;
        } else if (payload === 'REPORT_INCIDENT') {
          await sendMessengerReply(sender_psid, "Greetings. Please send a brief description, location, and a photo of the incident.");
          continue;
        }
      }

      // B. COLLECT DATA FROM MESSAGE
      if (webhook_event.message) {
        if (webhook_event.message.text) {
          buffer.text += " " + webhook_event.message.text;
        }
        if (webhook_event.message.attachments?.[0]?.type === 'image') {
          buffer.imageUrl = webhook_event.message.attachments[0].payload.url;
        }
      }

      // 2. THE TIMER LOGIC: Wait 3 seconds for more data (text or photo)
      if (buffer.timer) clearTimeout(buffer.timer);

      buffer.timer = setTimeout(async () => {
        // --- START CONSOLIDATED PROCESSING ---
        const finalReportData = { text: buffer.text.trim(), imageUrl: buffer.imageUrl };
        delete reportBuffers[sender_psid]; // Clean up memory

        if (!finalReportData.text && !finalReportData.imageUrl) return;

        try {
          console.log(`Aggregated processing for User ${sender_psid}...`);
          let parts = [{ text: `User message: "${finalReportData.text}"` }];
          
          if (finalReportData.imageUrl) {
            const base64Image = await fetchImageAsBase64(finalReportData.imageUrl);
            parts.push({ inlineData: { data: base64Image, mimeType: "image/jpeg" } });
          }

          // 3. The "Security Guard" Brain
          const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: parts }],
            config: {
              responseMimeType: "application/json",
              systemInstruction: "You are a Disaster Dispatcher Security Guard. Verify if the content is disaster-related. If VALID: true, extract STATUS, LOCATION, and REPORT summary."
            }
          });

          let aiResponse = JSON.parse(result.text);

          if (aiResponse.VALID === false) {
            console.log("REJECTED:", aiResponse.REASON);
            await sendMessengerReply(sender_psid, "We could not verify this as a disaster-related report. Please ensure your report is related to a local emergency.");
            return;
          }

          // 4. Final Stride Package
          const finalStrideData = {
            STATUS: aiResponse.STATUS,
            LOCATION: aiResponse.LOCATION || "Unknown",
            REPORT: aiResponse.REPORT,
            IMAGE: finalReportData.imageUrl || "No image provided"
          };

          // THE BRIDGE: Send the consolidated data to Zapier
          try {
            await axios.post('https://hooks.zapier.com/hooks/catch/16350419/u7vs0zv/', finalStrideData);
            console.log("Successfully bridged UNIFIED report to Zapier!");
          } catch (bridgeError) {
            console.error("Bridge Delivery Failed:", bridgeError.message);
          }

          console.log("FINAL JSON FOR STRIDE:", JSON.stringify(finalStrideData, null, 2));
          await sendMessengerReply(sender_psid, `Report for ${finalStrideData.LOCATION} has been forwarded to the command center. Stay safe!`);

        } catch (error) {
          console.error("Processing Error:", error.message);
        }
      },20000); // Wait 3 seconds
    }
    res.status(200).send('EVENT_RECEIVED');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`CDRRMO System is Live on Port ${PORT}`));