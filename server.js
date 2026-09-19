const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

const SENIOR_SYSTEM_PROMPT = `You are "Sahayak", a warm, patient, and caring AI companion designed specifically for senior citizens in India.

RULES:
- Always respond in simple, clear language. Avoid jargon.
- Be respectful, use polite tone. Address the user warmly.
- Keep responses concise (2-4 sentences max) unless they ask for detail.
- If they seem confused, gently offer to explain further.
- If they mention health emergencies, advise them to call 112 (India emergency) or contact family immediately.
- You can respond in Hindi or English based on what the user writes in.
- Be proactive: suggest helpful next steps when appropriate.
- Never give definitive medical diagnoses. Always say "please consult your doctor".`;

const chatSessions = new Map();

function getChatSession(sessionId) {
  if (!chatSessions.has(sessionId)) {
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "System instructions: " + SENIOR_SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Understood. I am Sahayak, ready to help senior citizens with warmth and patience." }] },
      ],
    });
    chatSessions.set(sessionId, chat);
  }
  return chatSessions.get(sessionId);
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const chat = getChatSession(sessionId);
    const result = await chat.sendMessage(message);
    const response = result.response.text();

    res.json({ reply: response });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

app.post("/api/scam-check", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const prompt = `You are a scam detection expert helping senior citizens in India stay safe.

Analyze this message and determine if it is a SCAM or SAFE.

Message to analyze:
"""
${message}
"""

Respond in this exact JSON format only, no markdown:
{
  "verdict": "SCAM" or "SAFE" or "SUSPICIOUS",
  "confidence": number between 1-100,
  "explanation": "Simple 2-sentence explanation a senior citizen can understand",
  "advice": "What they should do next, in simple words"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const analysis = JSON.parse(text);

    res.json(analysis);
  } catch (err) {
    console.error("Scam check error:", err.message);
    res.status(500).json({ error: "Could not analyze the message. Please try again." });
  }
});

app.post("/api/medicine-info", async (req, res) => {
  try {
    const { medicine } = req.body;
    if (!medicine) return res.status(400).json({ error: "Medicine name is required" });

    const prompt = `You are a helpful medical information assistant for senior citizens. Explain this medicine in very simple language that an elderly person can easily understand.

Medicine: "${medicine}"

Respond in this exact JSON format only, no markdown:
{
  "name": "Medicine name",
  "purpose": "What it is used for in simple words (1-2 sentences)",
  "howToTake": "How and when to take it (1-2 sentences)",
  "sideEffects": "Common side effects in simple words (1-2 sentences)",
  "warnings": "Important warnings in simple words (1-2 sentences)",
  "disclaimer": "Always consult your doctor before starting or stopping any medicine."
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const info = JSON.parse(text);

    res.json(info);
  } catch (err) {
    console.error("Medicine info error:", err.message);
    res.status(500).json({ error: "Could not get medicine information. Please try again." });
  }
});

app.post("/api/daily-tip", async (req, res) => {
  try {
    const { mood } = req.body;

    const prompt = `You are Sahayak, a caring wellness companion for senior citizens in India.
The user is feeling: "${mood || "okay"}"

Give a short, warm, personalized wellness tip based on their mood. Include one simple exercise or activity suggestion.

Respond in this exact JSON format only, no markdown:
{
  "greeting": "A warm personalized greeting based on their mood (1 sentence)",
  "tip": "A helpful wellness tip (1-2 sentences)",
  "activity": "A simple exercise or activity they can do right now (1 sentence)",
  "motivation": "An encouraging closing line (1 sentence)"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const tip = JSON.parse(text);

    res.json(tip);
  } catch (err) {
    console.error("Daily tip error:", err.message);
    res.status(500).json({ error: "Could not generate tip. Please try again." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sahayak server running on http://localhost:${PORT}`);
});
