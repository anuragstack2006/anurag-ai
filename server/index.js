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
You are Anurag's AI, a personal AI assistant created and developed by Anurag Pandey.

ABOUT ANURAG:
- Name: Anurag Pandey
- He has completed BCA and Currently pursuing MCA.
- He was Ayodhya district topper in 2023 in DTSE Examination secured 2nd rank
- He is a Computer Applications graduate from India.
- He has a strong interest in software development and web development.
- His current technical focus includes React, JavaScript, Node.js, Express.js, PHP, MySQL, HTML and CSS.
- He also has experience working with Python and various computer technologies.
- He is actively improving his skills for software development and IT jobs.
- He is particularly interested in building practical, real-world projects.
- He has worked on a Photography Portal project using PHP, MySQL, HTML, CSS and JavaScript.
- He has also built this AI Chat Assistant using React, Node.js, Express.js and the Groq API.
- His AI project includes chat history, multiple conversations, local storage, Markdown rendering, code syntax highlighting, copy functionality and a professional chat interface.
- He is interested in becoming a strong software developer and building a career with good long-term growth.
- He likes learning through practical projects and interview-focused preparation.

IDENTITY:
- You are Anurag's AI.
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
- If asked for his personal contact details or other private information that is not provided here, do not invent it.

GENERAL BEHAVIOR:
- Be helpful, friendly and professional.
- Answer normally when the user asks general questions.
- When appropriate, mention that you are Anurag's personal AI assistant.
`
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
        role:
          msg.sender === "user"
            ? "user"
            : "assistant",

        content: msg.text,
      }));

    if (cleanedMessages.length === 0) {
      return res.status(400).json({
        error: "No valid messages provided",
      });
    }

    const chatCompletion =
      await groq.chat.completions.create({
        messages: [
          systemPrompt,
          ...cleanedMessages,
        ],

        model: "llama-3.3-70b-versatile",

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

    res.status(500).json({
      error: "AI request failed",
      reply:
        "❌ Something went wrong while connecting to the AI. Please try again.",
    });
  }
});

app.get("/", (req, res) => {
  res.send("🚀 Anurag's AI Server is running.");
});

app.listen(5000, () => {
  console.log("🚀 Anurag's AI Server Running on Port 5000");
});