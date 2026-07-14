"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import {
    Brain, Send, User, Loader2, Sparkles, Clock, Plus,
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
import { cn } from "@/lib/utils";

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
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                            <span><InlineContent text={content} /></span>
                        </div>
                    );
                }
                // Numbered list
                const numbered = line.match(/^(\d+)\.\s(.*)/);
                if (numbered) {
                    return (
                        <div key={i} className="flex gap-2">
                            <span className="shrink-0 font-medium">{numbered[1]}.</span>
                            <span><InlineContent text={numbered[2]} /></span>
                        </div>
                    );
                }
                // Heading
                if (line.startsWith("### ")) {
                    return <p key={i} className="mt-2 text-base font-semibold"><InlineContent text={line.slice(4)} /></p>;
                }
                return <p key={i}><InlineContent text={line} /></p>;
            })}
        </div>
    );
}

function InlineContent({ text }: { text: string }) {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={index}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith("*") && part.endsWith("*")) {
                    return <em key={index}>{part.slice(1, -1)}</em>;
                }
                if (part.startsWith("`") && part.endsWith("`")) {
                    return <code key={index} className="data-mono rounded bg-black/10 px-1 text-xs">{part.slice(1, -1)}</code>;
                }
                return <span key={index}>{part}</span>;
            })}
        </>
    );
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
        <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-6">
            <PageHeader
                title="AI Assistant"
                subtitle="Ask anything about your assets, maintenance, budgets, and more — powered by live org data"
                actions={
                    <Button variant="outline" size="sm" onClick={clearConversation} className="gap-2" disabled={messages.length === 0}>
                        <Plus className="h-4 w-4" /> New Conversation
                    </Button>
                }
            />

            <div className="flex-1 space-y-4 overflow-y-auto rounded-panel border border-edge-subtle bg-surface-muted p-4">
                {messages.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center gap-6 py-8">
                        <div className="flex flex-col items-center gap-3">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg">
                                <Brain className="h-8 w-8 text-white" />
                            </div>
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-foreground">AssetIQ AI Assistant</h2>
                                <p className="mt-1 max-w-xs text-sm text-muted-fg">
                                    Ask me anything about your assets, maintenance schedules, budgets, lease obligations, or team activity.
                                </p>
                            </div>
                        </div>

                        <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                            {SUGGESTED_PROMPTS.map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(prompt)}
                                    className="group flex items-center gap-2 rounded-control border border-edge-subtle bg-surface px-4 py-3 text-left text-sm text-muted-fg transition-colors hover:border-brand/40 hover:bg-brand-soft"
                                >
                                    <Sparkles className="h-4 w-4 shrink-0 text-faint-fg group-hover:text-brand" />
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                        <div className={cn(
                            "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            msg.role === "user" ? "bg-brand" : "bg-gradient-to-br from-violet-500 to-blue-600",
                        )}>
                            {msg.role === "user"
                                ? <User className="h-4 w-4 text-white" />
                                : <Brain className="h-4 w-4 text-white" />
                            }
                        </div>

                        <div className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                            msg.role === "user"
                                ? "rounded-tr-sm bg-brand text-white"
                                : "rounded-tl-sm border border-edge-subtle bg-surface text-foreground",
                        )}>
                            {msg.role === "assistant"
                                ? <MessageContent text={msg.content} />
                                : <p className="text-sm leading-relaxed">{msg.content}</p>
                            }
                            <p className={cn(
                                "mt-1.5 flex items-center gap-1 text-xs",
                                msg.role === "user" ? "justify-end text-white/70" : "text-faint-fg",
                            )}>
                                <Clock className="h-3 w-3" />
                                {fmtTime(msg.timestamp)}
                            </p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-600">
                            <Brain className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-edge-subtle bg-surface px-4 py-3 shadow-sm">
                            <span className="flex gap-1">
                                <span className="h-2 w-2 animate-bounce rounded-full bg-faint-fg" style={{ animationDelay: "0ms" }} />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-faint-fg" style={{ animationDelay: "150ms" }} />
                                <span className="h-2 w-2 animate-bounce rounded-full bg-faint-fg" style={{ animationDelay: "300ms" }} />
                            </span>
                            <span className="text-xs text-faint-fg">AI is thinking…</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your assets, maintenance, budgets… (Enter to send, Shift+Enter for new line)"
                            rows={1}
                            className="ea-focus min-h-[44px] max-h-[140px] flex-1 resize-none rounded-control border border-edge bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-faint-fg"
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
                            className="h-11 w-11 shrink-0 rounded-control p-0"
                        >
                            {isLoading
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Send className="h-4 w-4" />
                            }
                        </Button>
                    </div>
                    <p className="mt-2 px-1 text-xs text-faint-fg">
                        Responses are grounded in your live organisational data. Conversation ID: {conversationId ? <span className="data-mono">{conversationId.slice(0, 12)}…</span> : "new session"}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
