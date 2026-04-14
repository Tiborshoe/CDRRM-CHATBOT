const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); // Added for outgoing API calls
const { GoogleGenAI } = require("@google/genai");

const app = express().use(bodyParser.json());
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = "CDRRMO_SECRET_2026";

// FUNCTION: Sends a reply message to the citizen on Messenger
async function sendMessengerReply(psid, text) {
  try {
    await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: psid },
      message: { text: text }
    });
  } catch (e) { console.error("Messenger Reply Error:", e.message); }
}

app.get('/webhook', (req, res) => {
  // ... Keep handshake logic same
});

app.post('/webhook', async (req, res) => {
  let body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry) {
      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id; // The Citizen's ID
      let userText = webhook_event.message?.text || "";
      
      let imageUrl = "No image provided";
      if (webhook_event.message?.attachments) {
        imageUrl = webhook_event.message.attachments[0].payload.url;
      }

      if (userText) {
        try {
          // 1. CALL GEMINI
          const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: userText,
            config: {
              responseMimeType: "application/json",
              systemInstruction: "Extract STATUS, LOCATION, and REPORT (summary) from disaster reports."
            }
          });

          let aiReport = JSON.parse(result.text);
          const finalStrideData = { ...aiReport, "IMAGE": imageUrl };

          console.log("SENDING TO STRIDE:", finalStrideData);

          // 2. SEND TO STRIDE SYSTEM (REPLACE URL WITH YOUR ACTUAL BRIDGE URL)
          // await axios.post('https://your-stride-system.com/api/reports', finalStrideData);

          // 3. REPLY TO CITIZEN
          await sendMessengerReply(sender_psid, "Thank you. We have received your report for " + aiReport.LOCATION + ". Our commander is reviewing it now.");

        } catch (error) { console.error("Process Error:", error.message); }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else { res.sendStatus(404); }
});

// FIX: Render likes port 10000 specifically
app.listen(process.env.PORT || 10000, () => console.log('CDRRMO System is FULLY LIVE!'));