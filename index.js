const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express().use(bodyParser.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const VERIFY_TOKEN = "CDRRMO_SECRET_2026";

app.get('/webhook', (req, res) => {
  // ... (Keep your handshake code the same)
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
          // --- THE GEMINI BRAIN PART ---
          const prompt = `
            You are a Disaster Response Assistant for a CDRRMO in the Philippines.
            Analyze this message (which may be in English, Tagalog, or Bisaya): "${userText}"
            
            Extract the data and return ONLY a valid JSON object with these keys:
            {
              "STATUS": "Critical, Warning, or Information",
              "LOCATION": "Extracted location from text",
              "REPORT": "A short summary in English"
            }
          `;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const jsonReport = response.text();

          console.log("Structured JSON for STRIDE:", jsonReport);
          
          // PHASE 3 will be sending this 'jsonReport' to your STRIDE system!
          
        } catch (error) {
          console.error("Gemini Error:", error);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

app.listen(process.env.PORT || 1337, () => console.log('AI Bot is listening...'));