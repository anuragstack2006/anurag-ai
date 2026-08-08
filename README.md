# 🧠 Anurag's AI

A modern personal AI chat assistant built with React, Node.js, Express and Groq API.

Anurag's AI provides a ChatGPT-style conversational experience with persistent chat history, Markdown rendering, code syntax highlighting and a clean responsive interface.

## ✨ Features

- 🤖 AI-powered conversations
- 💬 Real-time chat interface
- 🧠 Personal AI identity — Anurag's AI
- 💾 Chat history using LocalStorage
- 🗂️ Multiple conversations
- 🆕 New Chat functionality
- 🗑️ Delete and clear conversations
- 📋 Copy AI responses
- 📝 Markdown support
- 💻 Code syntax highlighting
- ⏱️ Message timestamps
- ⌨️ Enter-to-send support
- 🔄 Loading / typing animation
- 📱 Responsive UI
- 🔐 API key protected with environment variables

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- JavaScript
- CSS
- React Markdown
- Remark GFM
- React Syntax Highlighter

### Backend

- Node.js
- Express.js
- Groq API

### Storage

- Browser LocalStorage

## 📂 Project Structure

```text
anurag-ai/
│
├── public/
│
├── server/
│   ├── index.js
│   ├── package.json
│   └── package-lock.json
│
├── src/
│   ├── components/
│   │   ├── chat.jsx
│   │   ├── input.jsx
│   │   └── message.jsx
│   │
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
│
├── .gitignore
├── package.json
├── package-lock.json
└── vite.config.js