"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import {
    Brain, Send, RefreshCw, User, Loader2, MessageSquare, Sparkles,
    ChevronRight, Clock, Plus, Trash2,
} from "lucide-react";

import {
    aiChatService,
    AiChatRequest,
    AiChatResponse,
    ConversationMessage,
} from "@/services/aiChatService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatEntry {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

// ── Suggested prompts ──────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
    "What assets are currently checked out?",
    "Which assets need maintenance this month?",
    "Show me a summary of our asset portfolio",
    "What are the most expensive assets by department?",
    "Which leases are expiring in the next 30 days?",
    "What is our total maintenance spend this year?",
];

// ── Markdown-like renderer (bold, bullet) ─────────────────────────────────────

function MessageContent({ text }: { text: string }) {
    const lines = text.split("\n");
    return (
        <div className="space-y-1.5 text-sm leading-relaxed">
            {lines.map((line, i) => {
                if (!line.trim()) return <br key={i} />;
                // Bullet list
                if (line.match(/^[\*\-]\s/)) {
                    const content = line.replace(/^[\*\-]\s/, "");
                    return (
                        <div key={i} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0 opacity-60" />
                            <span dangerouslySetInnerHTML={{ __html: renderInline(content) }} />
                        </div>
                    );
                }
                // Numbered list
                const numbered = line.match(/^(\d+)\.\s(.*)/);
                if (numbered) {
                    return (
                        <div key={i} className="flex gap-2">
                            <span className="font-medium shrink-0">{numbered[1]}.</span>
                            <span dangerouslySetInnerHTML={{ __html: renderInline(numbered[2]) }} />
                        </div>
                    );
                }
                // Heading
                if (line.startsWith("### ")) {
                    return <p key={i} className="font-semibold text-base mt-2" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(4)) }} />;
                }
                return <p key={i} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />;
            })}
        </div>
    );
}

function renderInline(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code class='bg-black/10 px-1 rounded text-xs font-mono'>$1</code>");
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AiChatPage() {
    const [messages, setMessages] = useState<ChatEntry[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | undefined>(undefined);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    const handleSend = async (text?: string) => {
        const userMessage = (text ?? input).trim();
        if (!userMessage || isLoading) return;

        const newEntry: ChatEntry = { role: "user", content: userMessage, timestamp: new Date() };
        const updatedMessages = [...messages, newEntry];
        setMessages(updatedMessages);
        setInput("");
        setIsLoading(true);

        // Build history for the API (last 20 turns)
        const history: ConversationMessage[] = updatedMessages
            .slice(-20)
            .map(m => ({ role: m.role, content: m.content }));

        const request: AiChatRequest = {
            message: userMessage,
            conversationId,
            history: history.slice(0, -1), // exclude the current message
        };

        try {
            const response: AiChatResponse = await aiChatService.chat(request);
            if (response.conversationId) setConversationId(response.conversationId);
            setMessages(prev => [
                ...prev,
                { role: "assistant", content: response.message, timestamp: new Date() },
            ]);
        } catch {
            toast.error("Failed to get a response. Please try again.");
            setMessages(prev => prev.slice(0, -1)); // remove the optimistic user message
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const clearConversation = () => {
        setMessages([]);
        setConversationId(undefined);
        setInput("");
    };

    const fmtTime = (d: Date) =>
        d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-6 gap-4">
            <PageHeader
                title="AI Assistant"
                subtitle="Ask anything about your assets, maintenance, budgets, and more — powered by live org data"
                actions={
                    <Button variant="outline" size="sm" onClick={clearConversation} className="gap-2" disabled={messages.length === 0}>
                        <Plus className="h-4 w-4" /> New Conversation
                    </Button>
                }
            />

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4">
                {/* Welcome state */}
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
                                <Brain className="h-8 w-8 text-white" />
                            </div>
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-slate-900">AssetIQ AI Assistant</h2>
                                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                                    Ask me anything about your assets, maintenance schedules, budgets, lease obligations, or team activity.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                            {SUGGESTED_PROMPTS.map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(prompt)}
                                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
                                >
                                    <Sparkles className="h-4 w-4 text-slate-400 group-hover:text-blue-500 shrink-0" />
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message bubbles */}
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        {/* Avatar */}
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === "user" ? "bg-blue-600" : "bg-gradient-to-br from-violet-500 to-blue-600"}`}>
                            {msg.role === "user"
                                ? <User className="h-4 w-4 text-white" />
                                : <Brain className="h-4 w-4 text-white" />
                            }
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === "user"
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm"
                        }`}>
                            {msg.role === "assistant"
                                ? <MessageContent text={msg.content} />
                                : <p className="text-sm leading-relaxed">{msg.content}</p>
                            }
                            <p className={`text-xs mt-1.5 flex items-center gap-1 ${msg.role === "user" ? "text-blue-200 justify-end" : "text-slate-400"}`}>
                                <Clock className="h-3 w-3" />
                                {fmtTime(msg.timestamp)}
                            </p>
                        </div>
                    </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0">
                            <Brain className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                            <span className="flex gap-1">
                                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                            </span>
                            <span className="text-xs text-slate-400">AI is thinking…</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                    <div className="flex gap-2 items-end">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your assets, maintenance, budgets… (Enter to send, Shift+Enter for new line)"
                            rows={1}
                            className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] max-h-[140px] bg-slate-50"
                            style={{ height: "auto" }}
                            onInput={e => {
                                const t = e.currentTarget;
                                t.style.height = "auto";
                                t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
                            }}
                            disabled={isLoading}
                        />
                        <Button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isLoading}
                            className="h-11 w-11 p-0 rounded-lg shrink-0"
                        >
                            {isLoading
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Send className="h-4 w-4" />
                            }
                        </Button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 px-1">
                        Responses are grounded in your live organisational data. Conversation ID: {conversationId ? <span className="font-mono">{conversationId.slice(0, 12)}…</span> : "new session"}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
