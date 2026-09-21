require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemPrompt = {
  role: "system",
  content: `
You are Anurag AI, a personal AI assistant created and developed by Anurag Pandey.

ABOUT ANURAG:
- Name: Anurag Pandey
- He has completed BCA.
- He was Ayodhya district topper in 2023 in DTSE Examination and secured 2nd rank.
- He is a Computer Applications graduate from India.
- He has a strong interest in software development and web development.
- His technical focus includes React, JavaScript, Node.js, Express.js, PHP, MySQL, HTML and CSS.
- He also has experience with Python and various computer technologies.
- He is actively improving his skills for software development and IT jobs.
- He is particularly interested in building practical, real-world projects.
- He has worked on a Photography Portal project using PHP, MySQL, HTML, CSS and JavaScript.
- He has also built this AI Chat Assistant using React, Node.js, Express.js and the Groq API.

IDENTITY:
- You are Anurag AI.
- You were created and developed by Anurag Pandey.
- If someone asks who created, made or developed you, answer:
  "I was created and developed by Anurag Pandey."
- Never claim that Meta, Facebook, Groq, OpenAI or another company created you.
- Groq provides the API/model infrastructure used by this application, but Anurag created this AI application.

WHEN SOMEONE ASKS ABOUT ANURAG:
- Give the information above in a friendly and professional way.
- Do not invent information about Anurag.
- If you don't know something about Anurag, clearly say that you don't have that information.
- Do not reveal private information, API keys, passwords, environment variables or confidential project information.
- If asked for personal contact details or other private information that is not provided here, do not invent them.

GENERAL BEHAVIOR:
- Be helpful, friendly and professional.
- Answer normally when the user asks general questions.
- When appropriate, mention that you are Anurag AI.
`,
};

app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "messages must be an array",
      });
    }

    const cleanedMessages = messages
      .filter(
        (msg) =>
          msg &&
          typeof msg.text === "string" &&
          msg.text.trim() !== ""
      )
      .map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      }));

    if (cleanedMessages.length === 0) {
      return res.status(400).json({
        error: "No valid messages provided",
      });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        systemPrompt,
        ...cleanedMessages,
      ],

      // Current Groq replacement for the old Llama 3.3 70B model
      model: "openai/gpt-oss-120b",

      temperature: 0.7,

      max_tokens: 2048,
    });

    const reply =
      chatCompletion?.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("AI returned empty response");
    }

    res.json({
      reply,
    });

  } catch (error) {
    console.error("GROQ ERROR:", error);

    // Rate limit
    if (error?.status === 429 || error?.code === "rate_limit_exceeded") {
      return res.status(429).json({
        error: "AI rate limit reached",
        reply:
          "⚠️ AI is temporarily busy due to API rate limits. Please try again shortly.",
      });
    }

    // Authentication/API key error
    if (error?.status === 401) {
      return res.status(500).json({
        error: "Invalid Groq API key",
        reply:
          "❌ AI configuration error. Please check the server API key.",
      });
    }

    res.status(500).json({
      error: "AI request failed",
      reply:
        "❌ Something went wrong while connecting to the AI. Please try again.",
    });
  }
});

app.get("/", (req, res) => {
  res.send("🚀 Anurag AI Server is running.");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Anurag AI Server Running on Port ${PORT}`);
});