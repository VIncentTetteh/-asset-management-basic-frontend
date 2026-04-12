"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  Minus,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  aiChatService,
  AiChatRequest,
  ConversationMessage,
} from "@/services/aiChatService";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant" | "system";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  isError?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "What is the total value of all our assets?",
  "Which assets are overdue for maintenance?",
  "Give me a risk summary for our organisation.",
  "How is our budget utilization across departments?",
  "What are the most critical AI insights right now?",
  "Which departments have the most assets?",
  "What warranties are expiring soon?",
  "Summarise the health of our asset portfolio.",
];

const SYSTEM_GREETING: Message = {
  id: "system-greeting",
  role: "system",
  content:
    "Hi! I'm your AssetIQ AI assistant. I have full visibility into your organisation's assets, maintenance records, users, budgets, and AI-generated insights.\n\nAsk me anything — I'll give you answers grounded in your real live data.",
  timestamp: new Date(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Message Bubbles ──────────────────────────────────────────────────────────

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end mb-3 px-4">
      <div className="flex flex-col items-end max-w-[82%]">
        <div className="bg-teal-600 text-white rounded-3xl rounded-tr-sm px-4 py-2.5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
        <span className="text-[10px] text-slate-400 mt-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-start mb-3 px-4">
      <div className="flex flex-col items-start max-w-[88%]">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center">
            <Bot size={12} className="text-teal-600" />
          </div>
          <span className="text-[11px] font-semibold text-teal-700">
            AssetIQ AI
          </span>
        </div>
        <div
          className={`rounded-3xl rounded-tl-sm border px-4 py-2.5 ${
            message.isError
              ? "border-red-200 bg-red-50"
              : "border-slate-200 bg-white"
          }`}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2 py-0.5">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
              <span className="text-xs text-slate-400">
                Analysing your data…
              </span>
            </div>
          ) : (
            <p
              className={`text-sm leading-relaxed whitespace-pre-wrap ${
                message.isError ? "text-red-700" : "text-slate-800"
              }`}
            >
              {message.content}
            </p>
          )}
        </div>
        <span className="text-[10px] text-slate-400 mt-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function SystemBubble({ message }: { message: Message }) {
  return (
    <div className="mx-4 mb-4 rounded-2xl border border-teal-100 bg-teal-50 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles size={14} className="text-teal-600" />
        <span className="text-xs font-semibold text-teal-700">
          AI Assistant
        </span>
      </div>
      <p className="text-sm leading-relaxed text-teal-800 whitespace-pre-wrap">
        {message.content}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([SYSTEM_GREETING]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      60,
    );
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, isMinimized, scrollToBottom]);

  const apiHistory = useMemo<ConversationMessage[]>(
    () =>
      messages
        .filter((m) => m.role !== "system" && !m.isLoading && !m.isError)
        .slice(-20)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    [messages],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setInputText("");
      setIsLoading(true);

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      const loadingMsg: Message = {
        id: generateId() + "-loading",
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      scrollToBottom();

      try {
        const request: AiChatRequest = {
          message: trimmed,
          conversationId,
          history: apiHistory,
        };
        const data = await aiChatService.chat(request);
        if (data.conversationId) setConversationId(data.conversationId);
        setMessages((prev) => [
          ...prev.filter((m) => !m.isLoading),
          {
            id: generateId(),
            role: "assistant" as const,
            content: data.message,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev.filter((m) => !m.isLoading),
          {
            id: generateId(),
            role: "assistant" as const,
            content:
              error instanceof Error
                ? error.message
                : "Sorry, I couldn't reach the AI service. Please try again.",
            timestamp: new Date(),
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    },
    [isLoading, conversationId, apiHistory, scrollToBottom],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const clearConversation = useCallback(() => {
    setMessages([{ ...SYSTEM_GREETING, timestamp: new Date() }]);
    setConversationId(undefined);
  }, []);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    setIsMinimized(false);
  };

  const hasOnlyGreeting = messages.length === 1;

  return (
    <>
      {/* ── Chat Panel ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`fixed bottom-24 right-5 z-50 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out ${
            isMinimized
              ? "h-14 w-80 overflow-hidden"
              : "h-[580px] w-[380px]"
          }`}
          style={{
            boxShadow:
              "0 25px 50px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-3 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                <Sparkles size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">
                  AssetIQ AI
                </p>
                <p className="text-[10px] text-teal-200">
                  Powered by your live data
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized((p) => !p)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                title="Minimise"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body — hidden when minimized */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto py-3 scroll-smooth">
                {/* Suggested questions — only on empty state */}
                {hasOnlyGreeting && (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Suggested questions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => !isLoading && sendMessage(q)}
                          disabled={isLoading}
                          className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs text-teal-700 hover:bg-teal-100 hover:border-teal-300 transition-colors disabled:opacity-50 text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) =>
                  msg.role === "system" ? (
                    <SystemBubble key={msg.id} message={msg} />
                  ) : msg.role === "user" ? (
                    <UserBubble key={msg.id} message={msg} />
                  ) : (
                    <AssistantBubble key={msg.id} message={msg} />
                  ),
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-slate-100 bg-white px-3 pb-3 pt-2 rounded-b-2xl shrink-0">
                {messages.length > 1 && (
                  <div className="flex justify-end mb-1.5">
                    <button
                      onClick={clearConversation}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <RefreshCw size={10} />
                      Clear conversation
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about your organisation…"
                    disabled={isLoading}
                    rows={1}
                    maxLength={800}
                    className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60 transition-all"
                    style={{ minHeight: 40, maxHeight: 120 }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 120) + "px";
                    }}
                  />
                  <button
                    onClick={() => sendMessage(inputText)}
                    disabled={!inputText.trim() || isLoading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {isLoading ? (
                      <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-slate-300">
                  Press Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Floating Trigger Button ─────────────────────────────────────── */}
      <button
        onClick={toggleOpen}
        aria-label="Open AI Assistant"
        className={`fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 active:scale-95 ${
          isOpen
            ? "bg-slate-700 hover:bg-slate-800 rotate-0"
            : "bg-teal-600 hover:bg-teal-700"
        }`}
        style={{
          boxShadow: isOpen
            ? "0 8px 25px rgba(0,0,0,0.2)"
            : "0 8px 25px rgba(13,148,136,0.4)",
        }}
      >
        {isOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <div className="relative">
            <Sparkles size={22} className="text-white" />
            {/* Pulse ring */}
            <span className="absolute -inset-1 rounded-full bg-teal-400 opacity-30 animate-ping" />
          </div>
        )}
      </button>
    </>
  );
}
