🏛️ CDRRMO Smart Dispatch Bridge (Powered by Gemini 3 Flash)
Project Overview
The CDRRMO Smart Dispatch Bridge is an automated emergency response tool designed to bridge the gap between citizens reporting incidents via Facebook Messenger and the STRIDE (System for Tracking & Response to Incident Data Emergencies) system.

Unlike standard chatbots, this system utilizes Multimodal Generative AI (Gemini 3 Flash) to verify, translate, and structure disaster reports in real-time, ensuring that only verified, actionable data reaches the CDRRMO Command Center.

🧠 Core Logic: The "Gatekeeper Protocol"
I implemented a Verification-First logic approach to ensure system integrity. This method was chosen to solve two major challenges in emergency dispatching:

Noise Reduction: By using Gemini 3's vision capabilities, the AI acts as a "Security Guard," automatically rejecting non-emergency photos (selfies, food, spam) before they ever reach the STRIDE database.

Dialect-Aware Parsing: The AI is programmed to understand Bisaya, Tagalog, and English, converting messy local-language reports into standardized English JSON objects.

🚀 Key Features
Multimodal Verification: Processes both text and images simultaneously to confirm the legitimacy of a report.

Automated Structuring: Extracts STATUS (Severity), LOCATION (Barangay/Street), and a concise REPORT summary.

Secure Image Handling: Converts Facebook image attachments into Base64 data to allow the AI to "see" and verify the proof of incident.

Professional Dispatch UI: Includes a persistent menu for one-click access to emergency hotlines and incident reporting.

🛠️ Technical Stack
Language: Node.js (Express)

Intelligence: Google Gemini 3 Flash API (2026 Preview)

Interface: Meta Graph API (Messenger Webhooks)

Hosting: Render (24/7 Live Web Service)

Data Delivery: Axios (POSTing to STRIDE/Zapier endpoints)

🌊 System Flow
Citizen Input: Citizen sends a photo and text (e.g., "Baha na kaayo sa Libertad") via Messenger.

Data Processing: The server downloads the photo, converts it to Base64, and sends it with the text to Gemini 3.

AI Verification: Gemini verifies if the content is disaster-related.

If Valid: AI structures the data into a clean JSON object.

If Invalid: AI triggers a polite rejection to the user; no data is sent to the bridge.

Dispatch Delivery: The validated JSON is sent to the STRIDE system for the Commander's review.

📍 Roadmap
[x] Phase 1: Connectivity & Webhook Handshake

[x] Phase 2: Gemini 3 Flash Integration & Dialect Parsing

[x] Phase 3: "Gatekeeper" Security & Multimodal Image Processing

[ ] Phase 4: Final STRIDE Endpoint Integration

[ ] Phase 5: Meta Official App Review for Public Launch

How to Use this Repo
Clone the repository.

Add your GEMINI_API_KEY and PAGE_ACCESS_TOKEN to your environment variables.

Run npm install and npm start.

Trigger the menu setup at /setup-menu.
