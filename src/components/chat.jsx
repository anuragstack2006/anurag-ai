import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const getTime = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const createWelcomeMessage = () => ({
  text: "✨ Welcome! I'm ready when you are. What would you like to explore?",
  sender: "bot",
  time: getTime(),
});

function Chat() {
  const [typing, setTyping] = useState(false);
  const [message, setMessage] = useState("");

  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "dark"
  );

  const [search, setSearch] = useState("");
  const [currentChatId, setCurrentChatId] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Voice
  const [isListening, setIsListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [voiceEnabled, setVoiceEnabled] = useState(
    localStorage.getItem("voiceEnabled") !== "false"
  );

  // Messages
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("currentMessages");

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("Messages load error:", error);
    }

    return [createWelcomeMessage()];
  });

  // Chat history
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("chatHistory");

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("Chat history load error:", error);
    }

    return [];
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);

  // Used so voice can automatically send the final transcript
  const voiceTranscriptRef = useRef("");

  // --------------------------------------------------
  // SAVE
  // --------------------------------------------------

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem(
      "currentMessages",
      JSON.stringify(messages)
    );
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("voiceEnabled", voiceEnabled);
  }, [voiceEnabled]);

  // --------------------------------------------------
  // AUTO SCROLL
  // --------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, typing]);

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  const createNewWelcome = () => createWelcomeMessage();

  const saveCurrentChat = (updatedMessages) => {
    if (!currentChatId) return;

    setChatHistory((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: updatedMessages,
            }
          : chat
      )
    );
  };

  // --------------------------------------------------
  // TEXT TO SPEECH
  // --------------------------------------------------

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  };

  const speakReply = (text) => {
    if (!voiceEnabled) return;

    if (!("speechSynthesis" in window)) return;

    stopSpeaking();

    const cleanText = text
      .replace(/```[\s\S]*?```/g, " Code omitted. ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_~`#]/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
    };

    utterance.onerror = () => {
      setSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // --------------------------------------------------
  // SPEECH RECOGNITION
  // --------------------------------------------------

  const startListening = () => {
    if (typing) return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );
      return;
    }

    stopSpeaking();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    voiceTranscriptRef.current = "";

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript =
          event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const combined =
        finalTranscript || interimTranscript;

      if (combined) {
        voiceTranscriptRef.current = combined;
        setMessage(combined);
      }
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      setIsListening(false);

      if (event.error === "not-allowed") {
        alert(
          "Microphone permission denied. Please allow microphone access in your browser."
        );
      }
    };

    recognition.onend = () => {
      setIsListening(false);

      const finalVoiceText =
        voiceTranscriptRef.current.trim();

      /*
        IMPORTANT:
        Automatically send after voice recognition ends.
      */
      if (finalVoiceText && !typing) {
        voiceTranscriptRef.current = "";

        setTimeout(() => {
          handleSend(finalVoiceText);
        }, 120);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Voice start error:", error);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    setIsListening(false);
  };

  // --------------------------------------------------
  // SEND TO BACKEND
  // --------------------------------------------------

  const sendToAI = async (conversation) => {
    abortControllerRef.current =
      new AbortController();

    const response = await fetch(
      "https://anurag-ai.onrender.com/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation,
        }),
        signal: abortControllerRef.current.signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Server error: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.reply) {
      throw new Error("AI returned empty response");
    }

    return data.reply;
  };

  // --------------------------------------------------
  // SEND MESSAGE
  // --------------------------------------------------

  const handleSend = async (forcedText = null) => {
    const text = (
      forcedText !== null ? forcedText : message
    ).trim();

    if (!text || typing) return;

    stopListening();

    const userMessage = {
      text,
      sender: "user",
      time: getTime(),
    };

    const baseMessages =
      editingIndex !== null
        ? messages.slice(0, editingIndex)
        : messages;

    const updatedMessages = [
      ...baseMessages,
      userMessage,
    ];

    setMessages(updatedMessages);
    setMessage("");
    setEditingIndex(null);
    setTyping(true);

    try {
      const reply = await sendToAI(updatedMessages);

      const botMessage = {
        text: reply,
        sender: "bot",
        time: getTime(),
      };

      const finalMessages = [
        ...updatedMessages,
        botMessage,
      ];

      setMessages(finalMessages);

      // Speak automatically if Voice is enabled
      speakReply(reply);

      if (!currentChatId) {
        const newId = Date.now();

        setCurrentChatId(newId);

        setChatHistory((prev) => [
          {
            id: newId,
            title:
              text.length > 42
                ? `${text.substring(0, 42)}...`
                : text,
            messages: finalMessages,
          },
          ...prev,
        ]);
      } else {
        saveCurrentChat(finalMessages);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("CHAT ERROR:", error);

      const errorMessage = {
        text:
          "⚠️ I couldn't connect to the AI server right now. Please try again in a moment.",
        sender: "bot",
        time: getTime(),
      };

      const finalMessages = [
        ...updatedMessages,
        errorMessage,
      ];

      setMessages(finalMessages);

      if (currentChatId) {
        saveCurrentChat(finalMessages);
      }
    } finally {
      setTyping(false);
      abortControllerRef.current = null;
    }
  };

  // --------------------------------------------------
  // STOP
  // --------------------------------------------------

  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    stopListening();
    stopSpeaking();

    setTyping(false);
  };

  // --------------------------------------------------
  // NEW CHAT
  // --------------------------------------------------

  const newChat = () => {
    stopGenerating();

    setCurrentChatId(null);
    setMessages([createNewWelcome()]);
    setMessage("");
    setEditingIndex(null);

    localStorage.removeItem("currentMessages");

    // Close mobile sidebar
    setSidebarOpen(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  };

  // --------------------------------------------------
  // OPEN CHAT
  // --------------------------------------------------

  const openChat = (chat) => {
    if (!chat || !Array.isArray(chat.messages)) {
      return;
    }

    stopGenerating();

    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setMessage("");
    setEditingIndex(null);

    localStorage.setItem(
      "currentMessages",
      JSON.stringify(chat.messages)
    );

    // Close mobile sidebar after selection
    setSidebarOpen(false);
  };

  // --------------------------------------------------
  // DELETE CHAT
  // --------------------------------------------------

  const deleteChat = (id) => {
    setChatHistory((prev) =>
      prev.filter((chat) => chat.id !== id)
    );

    if (id === currentChatId) {
      stopGenerating();

      setCurrentChatId(null);
      setMessages([createNewWelcome()]);
      setMessage("");
      setEditingIndex(null);

      localStorage.removeItem("currentMessages");
    }
  };

  // --------------------------------------------------
  // CLEAR
  // --------------------------------------------------

  const clearChat = () => {
    stopSpeaking();

    const defaultMessages = [
      createNewWelcome(),
    ];

    setMessages(defaultMessages);
    setMessage("");
    setEditingIndex(null);

    if (currentChatId) {
      setChatHistory((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: defaultMessages,
              }
            : chat
        )
      );
    }

    localStorage.setItem(
      "currentMessages",
      JSON.stringify(defaultMessages)
    );
  };

  // --------------------------------------------------
  // COPY
  // --------------------------------------------------

  const copyMessage = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  // --------------------------------------------------
  // EDIT
  // --------------------------------------------------

  const editMessage = (index) => {
    const msg = messages[index];

    if (!msg || msg.sender !== "user") return;

    setMessage(msg.text);
    setEditingIndex(index);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // --------------------------------------------------
  // REGENERATE
  // --------------------------------------------------

  const regenerateResponse = async () => {
    if (typing) return;

    if (
      messages.length < 2 ||
      messages[messages.length - 1]?.sender !== "bot"
    ) {
      return;
    }

    stopSpeaking();

    const withoutLastBot = messages.slice(0, -1);

    setMessages(withoutLastBot);
    setTyping(true);

    try {
      const reply =
        await sendToAI(withoutLastBot);

      const botMessage = {
        text: reply,
        sender: "bot",
        time: getTime(),
      };

      const finalMessages = [
        ...withoutLastBot,
        botMessage,
      ];

      setMessages(finalMessages);

      speakReply(reply);

      if (currentChatId) {
        saveCurrentChat(finalMessages);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(
          "Regenerate error:",
          error
        );
      }
    } finally {
      setTyping(false);
      abortControllerRef.current = null;
    }
  };

  // --------------------------------------------------
  // EXPORT
  // --------------------------------------------------

  const exportChat = () => {
    if (!messages.length) return;

    const text = messages
      .map((msg) => {
        const sender =
          msg.sender === "user"
            ? "You"
            : "🧠Anurag AI";

        return `${sender} [${
          msg.time || ""
        }]\n${msg.text}\n`;
      })
      .join(
        "\n------------------------------\n\n"
      );

    const blob = new Blob([text], {
      type: "text/plain",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "ai-chat.txt";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------
  // SEARCH
  // --------------------------------------------------

  const filteredChats = chatHistory.filter(
    (chat) =>
      chat.title
        ?.toLowerCase()
        .includes(search.toLowerCase())
  );

  // --------------------------------------------------
  // KEYBOARD
  // --------------------------------------------------

  const handleKeyDown = (e) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      if (!typing && message.trim()) {
        handleSend();
      }
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div
      className={`app-layout ${theme} ${
        sidebarOpen ? "sidebar-open" : ""
      }`}
    >
      {/* MOBILE OVERLAY */}

      {sidebarOpen && (
        <div
          className="mobile-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* ================= SIDEBAR ================= */}

      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-icon">
              <span>✦</span>
            </div>

            <div className="brand-text">
              <h2>Anurag AI</h2>
              <span>Smart • Fast • Personal</span>
            </div>

            <button
              className="mobile-close"
              onClick={() =>
                setSidebarOpen(false)
              }
              aria-label="Close sidebar"
            >
              ×
            </button>
          </div>

          <button
            className="new-chat-btn"
            onClick={newChat}
          >
            <span className="new-chat-icon">
              ＋
            </span>
            <span>New Chat</span>
          </button>

          <div className="search-wrapper">
            <span>⌕</span>

            <input
              className="chat-search"
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <div className="history-heading">
            <span>RECENT CHATS</span>

            {chatHistory.length > 0 && (
              <span className="history-count">
                {chatHistory.length}
              </span>
            )}
          </div>

          <div className="history-list">
            {filteredChats.length === 0 ? (
              <div className="empty-history">
                <div className="empty-icon">
                  ✦
                </div>

                <strong>
                  No conversations yet
                </strong>

                <p>
                  Start a new chat to see it here.
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div
                  className={`chat-item ${
                    chat.id === currentChatId
                      ? "active"
                      : ""
                  }`}
                  key={chat.id}
                  onClick={() =>
                    openChat(chat)
                  }
                >
                  <div className="chat-item-icon">
                    💬
                  </div>

                  <div className="chat-item-info">
                    <span className="chat-title">
                      {chat.title}
                    </span>

                    <span className="chat-subtitle">
                      Conversation
                    </span>
                  </div>

                  <button
                    className="delete-chat"
                    title="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-bottom">
          <button
            className="side-action"
            onClick={() =>
              setTheme(
                theme === "dark"
                  ? "light"
                  : "dark"
              )
            }
          >
            <span>
              {theme === "dark"
                ? "☀️"
                : "🌙"}
            </span>

            {theme === "dark"
              ? "Light Mode"
              : "Dark Mode"}
          </button>

          <button
            className="side-action"
            onClick={() => {
              setVoiceEnabled((prev) => {
                const next = !prev;

                if (!next) {
                  stopSpeaking();
                }

                return next;
              });
            }}
          >
            <span>
              {voiceEnabled
                ? "🔊"
                : "🔇"}
            </span>

            {voiceEnabled
              ? "Voice On"
              : "Voice Off"}
          </button>

          <button
            className="side-action"
            onClick={exportChat}
          >
            <span>📥</span>
            Export Chat
          </button>

          <div className="sidebar-footer">
            <span className="footer-dot" />
            AI system ready
          </div>
        </div>
      </aside>

      {/* ================= MAIN ================= */}

      <main className="chat-container">
        {/* HEADER */}

        <header className="chat-header">
          <div className="header-left">
            <button
              className="menu-btn"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open chats"
            >
              ☰
            </button>

            <div className="header-brand">
              <div className="header-logo">
                ✦
              </div>

              <div>
                <h1>🧠Anurag AI</h1>

                <p>
                  Your intelligent conversation
                  partner
                </p>
              </div>
            </div>
          </div>

          <div className="header-actions">
            {speaking && (
              <button
                className="stop-speaking-btn"
                onClick={stopSpeaking}
              >
                <span>🔇</span>
                <span className="stop-voice-text">
                  Stop Voice
                </span>
              </button>
            )}

            <div className="online-status">
              <span />
              <label>Online</label>
            </div>
          </div>
        </header>

        {/* MESSAGES */}

        <section className="messages">
          {messages.map((msg, index) => (
            <div
              key={`${index}-${msg.time || ""}`}
              className={`message-row ${
                msg.sender === "user"
                  ? "user-row"
                  : "bot-row"
              }`}
            >
              <div
                className={
                  msg.sender === "user"
                    ? "user-message"
                    : "bot-message"
                }
              >
                <div className="message-top">
                  <div className="sender-avatar">
                    {msg.sender === "user"
                      ? "U"
                      : "✦"}
                  </div>

                  <span className="sender-name">
                    {msg.sender === "user"
                      ? "You"
                      : "Anurag AI"}
                  </span>

                  <span className="message-time">
                    {msg.time}
                  </span>
                </div>

                <div className="message-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({
                        className,
                        children,
                        ...props
                      }) {
                        const match =
                          /language-(\w+)/.exec(
                            className || ""
                          );

                        return match ? (
                          <SyntaxHighlighter
                            style={oneDark}
                            language={
                              match[1]
                            }
                            PreTag="div"
                            {...props}
                          >
                            {String(
                              children
                            ).replace(
                              /\n$/,
                              ""
                            )}
                          </SyntaxHighlighter>
                        ) : (
                          <code
                            className={
                              className
                            }
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>

                {/* ACTIONS */}

                <div className="message-actions">
                  <button
                    onClick={() =>
                      copyMessage(
                        msg.text
                      )
                    }
                    title="Copy"
                  >
                    📋
                  </button>

                  {msg.sender === "user" && (
                    <button
                      onClick={() =>
                        editMessage(index)
                      }
                      title="Edit"
                    >
                      ✏️
                    </button>
                  )}

                  {msg.sender === "bot" &&
                    index ===
                      messages.length - 1 && (
                      <button
                        onClick={
                          regenerateResponse
                        }
                        disabled={typing}
                        title="Regenerate"
                      >
                        🔄
                      </button>
                    )}

                  {msg.sender === "bot" && (
                    <button
                      onClick={() =>
                        speaking
                          ? stopSpeaking()
                          : speakReply(
                              msg.text
                            )
                      }
                      title="Read aloud"
                    >
                      {speaking
                        ? "🔇"
                        : "🔊"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* TYPING */}

          {typing && (
            <div className="message-row bot-row">
              <div className="bot-message typing-box">
                <div className="typing-avatar">
                  ✦
                </div>

                <div className="typing-content">
                  <span className="typing-label">
                    AI is thinking
                  </span>

                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>

        {/* COMPOSER */}

        <section className="composer">
          {editingIndex !== null && (
            <div className="editing-bar">
              <div>
                <span>✏️</span>
                Editing message
              </div>

              <button
                onClick={() => {
                  setEditingIndex(null);
                  setMessage("");
                }}
              >
                Cancel
              </button>
            </div>
          )}

          <div className="input-area">
            <input
              ref={inputRef}
              id="chat-message"
              name="message"
              type="text"
              maxLength={4000}
              placeholder={
                isListening
                  ? "Listening... speak now"
                  : editingIndex !== null
                  ? "Edit your message..."
                  : "Message AI Assistant..."
              }
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              onKeyDown={handleKeyDown}
              disabled={typing}
              autoComplete="off"
            />

            <span className="character-count">
              {message.length}/4000
            </span>

            {/* VOICE */}

            <button
              className={`voice-btn ${
                isListening
                  ? "listening"
                  : ""
              }`}
              onClick={
                isListening
                  ? stopListening
                  : startListening
              }
              disabled={typing}
              title={
                isListening
                  ? "Stop listening"
                  : "Voice input"
              }
            >
              {isListening
                ? "⏹"
                : "🎙️"}
            </button>

            {/* SEND */}

            {typing ? (
              <button
                className="stop-btn"
                onClick={stopGenerating}
              >
                <span>■</span>
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={() =>
                  handleSend()
                }
                disabled={!message.trim()}
                title="Send message"
              >
                <span>
                  {editingIndex !== null
                    ? "↗"
                    : "➤"}
                </span>

                <span className="send-text">
                  {editingIndex !== null
                    ? "Update"
                    : "Send"}
                </span>
              </button>
            )}
          </div>

          <div className="composer-footer">
            <span>
              {isListening
                ? "🎙️ Listening..."
                : voiceEnabled
                ? "🎙️ Voice mode enabled • AI can speak replies"
                : "Anurag AI may make mistakes. Verify important information."}
            </span>

            <div className="footer-brand">
              Developed with ❤️ by <strong>Anurag</strong>
            </div>
            

            <button
              className="clear-btn"
              onClick={clearChat}
            >
              🗑 Clear
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Chat;