import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const DEFAULT_MESSAGE = {
  text: "👋 Hello Anurag! How can I help you?",
  sender: "bot",
  time: new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }),
};

function Chat() {
  const [typing, setTyping] = useState(false);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "dark"
  );
  const [search, setSearch] = useState("");
  const [currentChatId, setCurrentChatId] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

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

    return [DEFAULT_MESSAGE];
  });

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

  // -----------------------------
  // Save data
  // -----------------------------

  useEffect(() => {
    localStorage.setItem(
      "chatHistory",
      JSON.stringify(chatHistory)
    );
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

  // -----------------------------
  // Auto scroll
  // -----------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, typing]);

  // -----------------------------
  // Helpers
  // -----------------------------

  const getTime = () =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const createDefaultMessage = () => ({
    ...DEFAULT_MESSAGE,
    time: getTime(),
  });

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

  // -----------------------------
  // Send message
  // -----------------------------

  const sendToAI = async (conversation) => {
    abortControllerRef.current = new AbortController();

    const response = await fetch(
      "http://localhost:5000/chat",
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
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.reply) {
      throw new Error("AI returned empty response");
    }

    return data.reply;
  };

  const handleSend = async () => {
    if (!message.trim() || typing) return;

    const text = message.trim();

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

      // First message = create new chat
      if (!currentChatId) {
        const newId = Date.now();

        setCurrentChatId(newId);

        setChatHistory((prev) => [
          {
            id: newId,
            title:
              text.length > 35
                ? `${text.substring(0, 35)}...`
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
        console.log("Generation stopped.");
        return;
      }

      console.error("CHAT ERROR:", error);

      const errorMessage = {
        text: "❌ Unable to connect to AI. Please check whether the server is running.",
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

  // -----------------------------
  // Stop generating
  // -----------------------------

  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setTyping(false);
  };

  // -----------------------------
  // New Chat
  // -----------------------------

  const newChat = () => {
    stopGenerating();

    setCurrentChatId(null);
    setMessages([createDefaultMessage()]);
    setMessage("");
    setEditingIndex(null);

    localStorage.removeItem("currentMessages");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // -----------------------------
  // Open old chat
  // -----------------------------

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
  };

  // -----------------------------
  // Delete chat
  // -----------------------------

  const deleteChat = (id) => {
    setChatHistory((prev) =>
      prev.filter((chat) => chat.id !== id)
    );

    if (id === currentChatId) {
      newChat();
    }
  };

  // -----------------------------
  // Clear current chat
  // -----------------------------

  const clearChat = () => {
    const defaultMessage = [createDefaultMessage()];

    setMessages(defaultMessage);
    setMessage("");
    setEditingIndex(null);

    if (currentChatId) {
      setChatHistory((prev) =>
        prev.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: defaultMessage,
              }
            : chat
        )
      );
    }

    localStorage.setItem(
      "currentMessages",
      JSON.stringify(defaultMessage)
    );
  };

  // -----------------------------
  // Copy message
  // -----------------------------

  const copyMessage = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied!");
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  // -----------------------------
  // Edit user message
  // -----------------------------

  const editMessage = (index) => {
    const msg = messages[index];

    if (!msg || msg.sender !== "user") return;

    setMessage(msg.text);
    setEditingIndex(index);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // -----------------------------
  // Regenerate AI response
  // -----------------------------

  const regenerateResponse = async () => {
    if (typing) return;

    if (
      messages.length < 2 ||
      messages[messages.length - 1]?.sender !== "bot"
    ) {
      return;
    }

    const withoutLastBot = messages.slice(0, -1);

    setMessages(withoutLastBot);
    setTyping(true);

    try {
      const reply = await sendToAI(withoutLastBot);

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

      if (currentChatId) {
        saveCurrentChat(finalMessages);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Regenerate error:", error);
      }
    } finally {
      setTyping(false);
      abortControllerRef.current = null;
    }
  };

  // -----------------------------
  // Export chat
  // -----------------------------

  const exportChat = () => {
    if (!messages.length) return;

    const text = messages
      .map((msg) => {
        const sender =
          msg.sender === "user"
            ? "Anurag"
            : "Anurag's AI";

        return `${sender} [${msg.time || ""}]\n${msg.text}\n`;
      })
      .join("\n--------------------\n\n");

    const blob = new Blob([text], {
      type: "text/plain",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "anurag-ai-chat.txt";

    a.click();

    URL.revokeObjectURL(url);
  };

  // -----------------------------
  // Search
  // -----------------------------

  const filteredChats = chatHistory.filter((chat) =>
    chat.title
      ?.toLowerCase()
      .includes(search.toLowerCase())
  );

  // -----------------------------
  // Keyboard shortcut
  // -----------------------------

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`app-layout ${theme}`}>

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="sidebar-top">

          <div className="brand">
            <div className="brand-icon">🧠</div>

            <div>
              <h2>Anurag's AI</h2>
              <span>Personal AI Assistant</span>
            </div>
          </div>

          <button
            className="new-chat-btn"
            onClick={newChat}
          >
            ＋ New Chat
          </button>

          <input
            className="chat-search"
            type="text"
            placeholder="🔍 Search chats..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <h3>Recent Chats</h3>

          <div className="history-list">

            {filteredChats.length === 0 ? (
              <div className="empty-history">
                <span>💬</span>
                <p>No conversations yet</p>
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
                  onClick={() => openChat(chat)}
                >
                  <span className="chat-title">
                    💬 {chat.title}
                  </span>

                  <button
                    className="delete-chat"
                    title="Delete chat"
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
            {theme === "dark"
              ? "☀️ Light Mode"
              : "🌙 Dark Mode"}
          </button>

          <button
            className="side-action"
            onClick={exportChat}
          >
            📥 Export Chat
          </button>

        </div>

      </aside>


      {/* MAIN CHAT */}

      <main className="chat-container">

        {/* HEADER */}

        <header className="chat-header">

          <div>
            <h1>🧠 Anurag's AI</h1>
            <p>
              Your Personal AI Assistant
            </p>
          </div>

          <div className="online-status">
            <span></span>
            AI Online
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

                  <span className="sender-name">
                    {msg.sender === "user"
                      ? "You"
                      : "🧠 Anurag's AI"}
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
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(
                              /\n$/,
                              ""
                            )}
                          </SyntaxHighlighter>
                        ) : (
                          <code
                            className={className}
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


                {/* MESSAGE ACTIONS */}

                <div className="message-actions">

                  <button
                    onClick={() =>
                      copyMessage(msg.text)
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

                </div>

              </div>

            </div>

          ))}


          {/* TYPING */}

          {typing && (
            <div className="message-row bot-row">

              <div className="bot-message typing-box">

                <span className="typing-label">
                  Anurag's AI is thinking
                </span>

                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

              </div>

            </div>
          )}

          <div ref={messagesEndRef}></div>

        </section>


        {/* INPUT */}

        <section className="composer">

          {editingIndex !== null && (
            <div className="editing-bar">

              <span>
                ✏️ Editing message
              </span>

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
                editingIndex !== null
                  ? "Edit your message..."
                  : "Message Anurag's AI..."
              }
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              onKeyDown={handleKeyDown}
              disabled={typing}
            />

            <span className="character-count">
              {message.length}/4000
            </span>

            {typing ? (
              <button
                className="stop-btn"
                onClick={stopGenerating}
              >
                ⏹ Stop
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!message.trim()}
              >
                {editingIndex !== null
                  ? "↗ Update"
                  : "➤ Send"}
              </button>
            )}

          </div>

          <div className="composer-footer">

            <span>
              Anurag's AI can make mistakes. Verify
              important information.
            </span>

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