const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleGenAI } = require("@google/genai");

const app = express().use(bodyParser.json());
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = "CDRRMO_SECRET_2026";

// --- PROFESSIONAL MESSENGER REPLY FUNCTION ---
async function sendMessengerReply(psid, text) {
  try {
    await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: psid },
      message: { text: text }
    });
  } catch (e) { console.error("Reply Error:", e.message); }
}

// --- 1. THE MENU SETUP ROUTE ---
app.get('/setup-menu', async (req, res) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        "persistent_menu": [{
          "locale": "default",
          "composer_input_disabled": false,
          "call_to_actions": [
            {
              "type": "postback",
              "title": "Submit Incident Report",
              "payload": "REPORT_INCIDENT"
            },
            {
              "type": "postback",
              "title": "Emergency Hotlines",
              "payload": "EMERGENCY_HOTLINES"
            },
            {
              "type": "web_url",
              "title": "Official CDRRMO Portal",
              "url": "https://www.butuan.gov.ph/", 
              "webview_height_ratio": "full"
            }
          ]
        }]
      }
    );
    res.send("Menu Configuration Successful.");
  } catch (error) {
    res.status(500).send("Menu Setup Failed: " + error.message);
  }
});

app.get('/webhook', (req, res) => {
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// --- 2. THE MAIN WEBHOOK LOGIC ---
app.post('/webhook', async (req, res) => {
  let body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id;

      // A. HANDLE PERSISTENT MENU BUTTON CLICKS (Postbacks)
      if (webhook_event.postback) {
        let payload = webhook_event.postback.payload;

        if (payload === 'REPORT_INCIDENT') {
          await sendMessengerReply(sender_psid, "Greetings from Butuan City CDRRMO. To process your report efficiently, please send a brief description of the incident, the specific location, and a photo if available. Your safety is our priority.");
        } else if (payload === 'EMERGENCY_HOTLINES') {
          await sendMessengerReply(sender_psid, "For immediate life-threatening emergencies, please call the following hotlines:\n\n📞 Butuan Emergency: 911\n📞 CDRRMO Operations: (085) 123-4567\n📞 BFP Butuan: (085) 987-6543");
        }
      }

      // B. HANDLE TEXT REPORTS (Gemini Logic)
      if (webhook_event.message && webhook_event.message.text) {
        let userText = webhook_event.message.text;
        
        let imageUrl = "No image provided";
        if (webhook_event.message.attachments) {
          imageUrl = webhook_event.message.attachments[0].payload.url;
        }

        try {
          const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: userText,
            config: {
              responseMimeType: "application/json",
              systemInstruction: "You are an official disaster response assistant. Extract STATUS, LOCATION, and REPORT summary from the user's message."
            }
          });

          let aiReport = JSON.parse(result.text);
          const finalStrideData = { ...aiReport, "IMAGE": imageUrl };

          console.log("SENDING TO MOCK SYSTEM:", finalStrideData);
          
          // Reply to the citizen
          await sendMessengerReply(sender_psid, `Thank you. We have acknowledged your report for ${aiReport.LOCATION}. Our dispatch team has been notified. Please stay in a safe area.`);

        } catch (error) { console.error("AI Error:", error.message); }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`CDRRMO System is Live on Port ${PORT}`));