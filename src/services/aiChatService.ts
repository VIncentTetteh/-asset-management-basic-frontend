import api from "@/lib/axios";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

// ─── Message types ────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Request / Response ───────────────────────────────────────────────────────

export interface AiChatRequest {
  /** The user's current message */
  message: string;
  /**
   * Conversation ID for multi-turn continuity.
   * Returned by the first response — echo it on every subsequent call.
   */
  conversationId?: string;
  /**
   * Recent conversation turns (last 20 max).
   * The backend uses these to maintain dialogue context.
   */
  history: ConversationMessage[];
}

export interface AiChatResponse {
  /** The AI-generated answer grounded in live org data */
  message: string;
  /** Echo this back on the next request */
  conversationId?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/ai/chat
 *
 * Server-side RAG endpoint. The backend fetches all org data (assets,
 * maintenance, users, departments, budgets, AI insights) directly from the
 * database, builds a system prompt, and returns a grounded answer.
 */
export const aiChatService = {
  chat: async (request: AiChatRequest): Promise<AiChatResponse> => {
    const organisationId = getOrganisationIdFromStorage();
    const response = await api.post<AiChatResponse>("/ai/chat", request, {
      params: organisationId ? { organisationId } : undefined,
    });
    return response.data;
  },
};
