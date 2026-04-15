const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleGenAI } = require("@google/genai");

const app = express().use(bodyParser.json());
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = "CDRRMO_SECRET_2026";

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
        "get_started": {
          "payload": "GET_STARTED_CLICKED"
        },
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
            }
          ]
        }]
      }
    );
    res.send("Messenger Profile (Get Started & Menu) Setup Successful!");
  } catch (error) {
    console.error("META ERROR DATA:", error.response?.data || error.message);
    res.status(500).send("Setup Failed. See Render logs for details.");
  }
});

// --- ROUTE: Facebook Verification Handshake ---
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

// --- ROUTE: Main Chatbot Logic ---
app.post('/webhook', async (req, res) => {
  let body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id;

      // A. HANDLE MENU CLICKS (POSTBACKS)
      if (webhook_event.postback) {
        let payload = webhook_event.postback.payload;

        if (payload === 'GET_STARTED_CLICKED') {
          await sendMessengerReply(sender_psid, "Welcome to the Butuan City CDRRMO Official Chatbot. We are here to assist you with disaster reporting and emergency information. Please use the menu below to start.");
        } else if (payload === 'REPORT_INCIDENT') {
          await sendMessengerReply(sender_psid, "Greetings from Butuan City CDRRMO. To process your report efficiently, please send a brief description of the incident, the specific location, and a photo if available. Your safety is our priority.");
        } else if (payload === 'EMERGENCY_HOTLINES') {
          await sendMessengerReply(sender_psid, "For immediate life-threatening emergencies, please call the following hotlines:\n\n📞 Butuan Emergency: 911\n📞 CDRRMO Operations: (085) 123-4567\n📞 BFP Butuan: (085) 987-6543");
        }
      }

      // B. HANDLE USER MESSAGES (TEXT & PHOTOS)
      let userText = webhook_event.message?.text || "";
      let imageUrl = webhook_event.message?.attachments?.[0]?.payload?.url || null;

      if (userText || imageUrl) {
        try {
          // 1. Construct the request payload for Gemini
          let parts = [{ text: `User message: "${userText}"` }];
          
          if (imageUrl) {
            try {
              // Fetch image from FB and convert it to pixels Gemini can "see" directly
              const base64Image = await fetchImageAsBase64(imageUrl);
              parts.push({
                inlineData: {
                  data: base64Image,
                  mimeType: "image/jpeg"
                }
              });
            } catch (imgError) {
              console.error("Image Fetch Error:", imgError.message);
            }
          }

          // 2. The "Security Guard" Prompt
          const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: parts }],
            config: {
              responseMimeType: "application/json",
              systemInstruction: `
                You are a Disaster Dispatcher Security Guard. 
                Your first task is to verify the image and text.
                
                CRITERIA:
                1. If an image is provided, is it related to a disaster (flood, fire, accident, etc.)?
                2. Is the content appropriate for a government emergency system? (No selfies, food, or spam).
                
                OUTPUT RULES:
                - If the report is valid: Return JSON with { "VALID": true, "STATUS": "...", "LOCATION": "...", "REPORT": "..." }.
                - If the report is invalid or unrelated: Return JSON with { "VALID": false, "REASON": "Brief reason why" }.
              `
            }
          });

          let aiResponse = JSON.parse(result.text);

          // 3. Rejection Logic (Gatekeeper stops spam)
          if (aiResponse.VALID === false) {
            console.log("REPORT REJECTED:", aiResponse.REASON);
            await sendMessengerReply(sender_psid, "We could not verify this as a disaster-related report. Please ensure your photo and description are related to a local emergency. Thank you.");
            return; // Stops here, doesn't go to STRIDE
          }

          // 4. Success Logic (Ready for STRIDE)
          const finalStrideData = {
            STATUS: aiResponse.STATUS,
            LOCATION: aiResponse.LOCATION || "Unknown",
            REPORT: aiResponse.REPORT,
            IMAGE: imageUrl || "No image provided" // We pass the URL to STRIDE so the Commander can view it
          };

          console.log("FINAL VALIDATED JSON FOR STRIDE:", JSON.stringify(finalStrideData, null, 2));

          // Acknowledge the valid report
          await sendMessengerReply(sender_psid, `Report for ${finalStrideData.LOCATION} is being forwarded to the command center. Stay safe!`);

        } catch (error) { 
          console.error("Processing Error:", error.message);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`CDRRMO System is Live on Port ${PORT}`));