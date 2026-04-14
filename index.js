const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenAI } = require("@google/genai");

const app = express().use(bodyParser.json());
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const VERIFY_TOKEN = "CDRRMO_SECRET_2026";

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

app.post('/webhook', async (req, res) => {
  let body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      let webhook_event = entry.messaging[0];
      let userText = webhook_event.message?.text || "";
      
      // 1. EXTRACT IMAGE URL (from the citizen's photo)
      let imageUrl = "No image provided";
      if (webhook_event.message?.attachments) {
        imageUrl = webhook_event.message.attachments[0].payload.url;
      }

      if (userText) {
        console.log("Raw Report:", userText);

        try {
          // 2. CALL GEMINI 3 FLASH
          const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: userText,
            config: {
              responseMimeType: "application/json",
              systemInstruction: `
                You are a Disaster Response Assistant. 
                Analyze the input (Bisaya/Tagalog/English). 
                Return ONLY a JSON object:
                {
                  "STATUS": "Critical, Warning, or Information",
                  "LOCATION": "Street/Barangay name",
                  "REPORT": "English summary"
                }
              `
            }
          });

          // FIX: In 2026 SDK 1.47.0, it's just 'result.text'
          let aiReport = JSON.parse(result.text);

          // 3. ADD THE IMAGE TO THE JSON (Matching your STRIDE schema)
          const finalStrideData = {
            ...aiReport,
            "IMAGE": imageUrl
          };

          console.log("FINAL JSON FOR STRIDE:", JSON.stringify(finalStrideData, null, 2));

          // TODO: axios.post('YOUR_STRIDE_URL', finalStrideData)

        } catch (error) {
          console.error("Gemini/Process Error:", error.message);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

app.listen(process.env.PORT || 1337, () => console.log('CDRRMO Bridge is LIVE!'));