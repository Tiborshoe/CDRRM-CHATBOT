const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenAI } = require("@google/genai"); // New library import

const app = express().use(bodyParser.json());

// Initialize the new 2026 GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const VERIFY_TOKEN = "CDRRMO_SECRET_2026";

app.get('/webhook', (req, res) => {
  // ... Keep your handshake code the same
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
          // ... (inside your webhook post)
            const response = await ai.models.generateContent({
                model: "gemini-3-flash", // Use the stable 2026 Flash model
                contents: userText,
                config: {
                 systemInstruction: `
                    You are a Disaster Response Assistant for a CDRRMO in the Philippines.
                    Analyze the input (Bisaya, Tagalog, or English).
                    Extract the data into this EXACT JSON format:
                         {
                            "STATUS": "Critical, Warning, or Information",
                             "LOCATION": "Extracted location",
                             "REPORT": "Summary in English"
                        }
                    `
                     }
});
// ...

          // In the new SDK, text is a property, not a function
          const jsonReport = response.text; 
          console.log("Structured JSON for STRIDE:", jsonReport);
          
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

app.listen(process.env.PORT || 1337, () => console.log('Gemini 3 Bot is listening...'));