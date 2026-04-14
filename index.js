const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenAI } = require("@google/genai");

const app = express().use(bodyParser.json());

// Initialize the 2026 client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const VERIFY_TOKEN = "CDRRMO_SECRET_2026";

app.get('/webhook', (req, res) => {
  // ... (Keep your handshake code exactly as it is)
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);      
    }
  }
});

app.post('/webhook', async (req, res) => {
  let body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      let webhook_event = entry.messaging[0];
      
      if (webhook_event.message && webhook_event.message.text) {
        let userText = webhook_event.message.text;
        console.log("Raw Citizen Report:", userText);

        try {
          // CALLING GEMINI 3.1 FLASH PREVIEW
          const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview", // Corrected model string
            contents: userText,
            config: {
              // This is the "secret sauce" to get perfect JSON
              responseMimeType: "application/json", 
              systemInstruction: `
                You are a Disaster Response Assistant for a CDRRMO in the Philippines.
                Analyze the input (Bisaya, Tagalog, or English).
                Return ONLY a JSON object with this exact schema:
                {
                  "STATUS": "Critical, Warning, or Information",
                  "LOCATION": "Extracted street or barangay",
                  "REPORT": "English summary"
                }
              `
            }
          });

          // In the 2026 SDK, it's result.response.text
          const jsonReport = result.response.text;
          console.log("Structured JSON for STRIDE:", jsonReport);
          
          // --- NEXT STEP PREVIEW ---
          // This is where you will add: axios.post('STRIDE_URL', JSON.parse(jsonReport))
          
        } catch (error) {
          console.error("Gemini Error:", error.message);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

app.listen(process.env.PORT || 1337, () => console.log('Gemini 3 Bot is fully alive!'));