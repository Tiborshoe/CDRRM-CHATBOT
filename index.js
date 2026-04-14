const express = require('express');
const bodyParser = require('body-parser');
const app = express().use(bodyParser.json());

// --- CONFIGURATION ---
const VERIFY_TOKEN = "CDRRMO_SECRET_2026"; // Change this to anything you want!

// 1. THE HANDSHAKE (GET) - This makes the Meta screen turn green
app.get('/webhook', (req, res) => {
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);      
    }
  }
});

// 2. THE LISTENER (POST) - This catches the citizen's reports
app.post('/webhook', (req, res) => {
  let body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(entry => {
      let webhook_event = entry.messaging[0];
      console.log("New Message:", webhook_event.message.text);
      
      // NEXT PHASE: This is where we will send data to Gemini!
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

app.listen(process.env.PORT || 1337, () => console.log('Bot is listening...'));