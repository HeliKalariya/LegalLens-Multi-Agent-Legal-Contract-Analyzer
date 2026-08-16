"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Copy, FileText, MessageSquare, Pencil, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";

type ChatLanguage = "en" | "hi" | "gu" | "es" | "fr";
type DocumentItem = { document_id: string; original_filename: string; analysis_status: string; analysis_language?: ChatLanguage };
type Conversation = { id: string; document_id: string; title: string; created_at: string; updated_at: string };
type Source = { clause_id: string; title: string; page?: number | null; risk_level: string };
type Message = { id: string; role: "user" | "assistant"; message: string; sources: Source[]; created_at: string };

const suggestions = ["Is this contract safe?", "Can I terminate early?", "Are there hidden fees?", "What should I negotiate?"];
const chatLanguages: { value: ChatLanguage; label: string }[] = [
  { value: "en", label: "English" }, { value: "hi", label: "Hindi" }, { value: "gu", label: "Gujarati" }, { value: "es", label: "Spanish" }, { value: "fr", label: "French" },
];

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return payload?.detail ?? fallback;
}

function timeLabel(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Recently";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)}h ago`;
  if (elapsedMinutes < 2_880) return "Yesterday";
  return new Date(value).toLocaleDateString();
}

function AssistantAnswer({ message }: { message: string }) {
  const paragraphs = message.split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph}-${index}`} className="whitespace-pre-wrap">{paragraph}</p>
      ))}
    </div>
  );
}

/** Document-grounded chat backed by the authenticated FastAPI chat endpoints. */
export default function AiChatPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [responseLanguage, setResponseLanguage] = useState<ChatLanguage>("en");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const temporaryMessageNumber = useRef(0);

  const activeConversation = useMemo(() => conversations.find((conversation) => conversation.id === activeConversationId) ?? null, [activeConversationId, conversations]);
  const selectedDocument = useMemo(() => documents.find((document) => document.document_id === selectedDocumentId) ?? null, [documents, selectedDocumentId]);

  const loadMessages = useCallback(async (sessionId: string, signal?: AbortSignal) => {
    setIsLoadingMessages(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/chat/sessions/${sessionId}/messages`, { signal });
      if (!response.ok) throw new Error(await responseError(response, "Could not load messages."));
      const data = await response.json() as Message[];
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not load messages.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const loadSessions = useCallback(async (documentId: string, signal?: AbortSignal) => {
    const response = await authenticatedFetch(`${API_URL}/api/chat/sessions?document_id=${encodeURIComponent(documentId)}`, { signal });
    if (!response.ok) throw new Error(await responseError(response, "Could not load conversations."));
    const data = await response.json() as Conversation[];
    const nextConversations = Array.isArray(data) ? data : [];
    setConversations(nextConversations);
    const firstSession = nextConversations[0];
    setActiveConversationId(firstSession?.id ?? null);
    if (firstSession) await loadMessages(firstSession.id, signal);
    else setMessages([]);
  }, [loadMessages]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadInitialData() {
      try {
        setIsLoading(true);
        const response = await authenticatedFetch(`${API_URL}/api/upload/`, { signal: controller.signal });
        if (!response.ok) throw new Error(await responseError(response, "Could not load documents."));
        const result = await response.json();
        const analyzedDocuments = (Array.isArray(result.data) ? result.data : []).filter((document: DocumentItem) => document.analysis_status === "analyzed");
        setDocuments(analyzedDocuments);
        const firstDocument = analyzedDocuments[0];
        if (firstDocument) {
          setSelectedDocumentId(firstDocument.document_id);
          setResponseLanguage(firstDocument.analysis_language ?? "en");
          await loadSessions(firstDocument.document_id, controller.signal);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        toast.error(error instanceof Error ? error.message : "Could not load chat data.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadInitialData();
    return () => controller.abort();
  }, [loadSessions]);

  async function selectDocument(documentId: string) {
    if (!documentId || documentId === selectedDocumentId) return;
    setSelectedDocumentId(documentId);
    const document = documents.find((item) => item.document_id === documentId);
    setResponseLanguage(document?.analysis_language ?? "en");
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    try { await loadSessions(documentId); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load conversations."); }
  }

  async function selectConversation(sessionId: string) {
    if (sessionId === activeConversationId) return;
    setActiveConversationId(sessionId);
    setMessages([]);
    await loadMessages(sessionId);
  }

  function beginConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setDraft("");
    setEditingConversationId(null);
  }

  function startRenamingConversation(conversation: Conversation) {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  }

  async function saveConversationName(sessionId: string) {
    const title = editingTitle.trim();
    if (!title) {
      toast.error("Enter a conversation name.");
      return;
    }

    setIsSavingConversation(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Could not rename the conversation."));
      const updated = await response.json() as Conversation;
      setConversations((current) => current.map((conversation) => conversation.id === sessionId ? updated : conversation));
      setEditingConversationId(null);
      toast.success("Conversation renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename the conversation.");
    } finally {
      setIsSavingConversation(false);
    }
  }

  async function deleteConversation() {
    if (!conversationToDelete) return;
    const sessionId = conversationToDelete.id;
    setIsDeletingConversation(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "Could not delete the conversation."));
      const remaining = conversations.filter((conversation) => conversation.id !== sessionId);
      setConversations(remaining);
      setConversationToDelete(null);
      if (activeConversationId === sessionId) {
        const nextConversation = remaining[0];
        setActiveConversationId(nextConversation?.id ?? null);
        if (nextConversation) await loadMessages(nextConversation.id);
        else setMessages([]);
      }
      toast.success("Conversation deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the conversation.");
    } finally {
      setIsDeletingConversation(false);
    }
  }

  async function ensureSession(question: string) {
    if (activeConversationId) return activeConversationId;
    if (!selectedDocumentId) throw new Error("Choose an analyzed document before starting chat.");
    const response = await authenticatedFetch(`${API_URL}/api/chat/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: selectedDocumentId, title: question.slice(0, 80) }),
    });
    if (!response.ok) throw new Error(await responseError(response, "Could not create a conversation."));
    const session = await response.json() as Conversation;
    setConversations((current) => [session, ...current]);
    setActiveConversationId(session.id);
    return session.id;
  }

  async function sendMessage(event?: FormEvent, suggestedQuestion?: string) {
    event?.preventDefault();
    const question = (suggestedQuestion ?? draft).trim();
    if (!question || isSending) return;
    const optimisticMessage: Message = { id: `temporary-${temporaryMessageNumber.current++}`, role: "user", message: question, sources: [], created_at: new Date().toISOString() };
    setMessages((current) => [...current, optimisticMessage]);
    setDraft("");
    setIsSending(true);
    try {
      const sessionId = await ensureSession(question);
      const response = await authenticatedFetch(`${API_URL}/api/chat/sessions/${sessionId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question, response_language: responseLanguage }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Could not answer your question."));
      const assistantMessage = await response.json() as Message;
      setMessages((current) => [...current, assistantMessage]);
      setConversations((current) => current.map((conversation) => (
        conversation.id === sessionId ? { ...conversation, title: conversation.title === "New document conversation" ? question.slice(0, 80) : conversation.title, updated_at: assistantMessage.created_at } : conversation
      )).sort((first, second) => new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime()));
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      toast.error(error instanceof Error ? error.message : "Could not answer your question.");
    } finally { setIsSending(false); }
  }

  return (
    <DashboardLayout>
      <section className="-m-4 flex h-[calc(100dvh-5rem)] min-h-0 overflow-hidden border-t border-black/10 bg-[#F5F1E9] sm:-m-6 lg:-m-8">
        <aside className="hidden min-h-0 w-80 shrink-0 border-r border-black/15 bg-[#F1EDE3] p-5 md:flex md:flex-col lg:w-90">
          <button type="button" onClick={beginConversation} disabled={!selectedDocumentId} className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-black/15 bg-[#F7F3EA] px-5 text-sm font-semibold text-[#181211] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"><Plus size={19} /> New conversation</button>
          <label className="mt-5 text-xs font-semibold uppercase tracking-wider text-[#526174]" htmlFor="chat-document">Document</label>
          <select id="chat-document" value={selectedDocumentId} onChange={(event) => void selectDocument(event.target.value)} disabled={isLoading || documents.length === 0} className="mt-2 w-full rounded-xl border border-black/15 bg-[#F7F3EA] px-3 py-2.5 text-sm font-medium text-[#181211] outline-none focus:border-[#0875D1] disabled:cursor-not-allowed disabled:opacity-60">
            {documents.length === 0 ? <option>No analyzed documents</option> : documents.map((document) => <option key={document.document_id} value={document.document_id}>{document.original_filename}</option>)}
          </select>
          <label className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#526174]" htmlFor="chat-response-language">Answer language</label>
          <select id="chat-response-language" value={responseLanguage} onChange={(event) => setResponseLanguage(event.target.value as ChatLanguage)} disabled={isSending} className="mt-2 w-full rounded-xl border border-black/15 bg-[#F7F3EA] px-3 py-2.5 text-sm font-medium text-[#181211] outline-none focus:border-[#0875D1] disabled:cursor-not-allowed disabled:opacity-60">
            {chatLanguages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
          </select>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#526174]">Recent</p>
          <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {conversations.length === 0 && !isLoading && <p className="px-3 py-4 text-sm text-[#67758A]">Start a new conversation for this document.</p>}
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const isEditing = conversation.id === editingConversationId;
              return (
                <div key={conversation.id} className={`group flex items-center gap-2 rounded-xl px-3 py-3 transition ${isActive ? "bg-[#F7F3EA] shadow-sm" : "hover:bg-white/60"}`}>
                  <MessageSquare className="h-5 w-5 shrink-0 text-[#526174]" />
                  {isEditing ? <>
                    <input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveConversationName(conversation.id); if (event.key === "Escape") setEditingConversationId(null); }} className="min-w-0 flex-1 rounded-md border border-[#0875D1] bg-white px-2 py-1 text-sm font-medium text-[#181211] outline-none" aria-label="Conversation name" />
                    <button type="button" onClick={() => void saveConversationName(conversation.id)} disabled={isSavingConversation} aria-label="Save conversation name" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-green-700 transition hover:bg-green-100 disabled:opacity-50"><Check size={16} /></button>
                    <button type="button" onClick={() => setEditingConversationId(null)} aria-label="Cancel renaming" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#526174] transition hover:bg-black/5"><X size={16} /></button>
                  </> : <>
                    <button type="button" onClick={() => void selectConversation(conversation.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold text-[#181211]">{conversation.title}</span><span className="mt-0.5 block text-xs text-[#526174]">{timeLabel(conversation.updated_at)}</span></button>
                    <div className="flex shrink-0 items-center opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      <button type="button" onClick={() => startRenamingConversation(conversation)} aria-label={`Rename ${conversation.title}`} className="grid h-7 w-7 place-items-center rounded-md text-[#526174] transition hover:bg-black/5 hover:text-[#0875D1]"><Pencil size={14} /></button>
                      <button type="button" onClick={() => setConversationToDelete(conversation)} aria-label={`Delete ${conversation.title}`} className="grid h-7 w-7 place-items-center rounded-md text-[#526174] transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </>}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="hidden items-center justify-between border-b border-black/10 bg-[#F7F3EA]/70 px-8 py-4 md:flex lg:px-12">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#181211]">LegalLens AI</p>
              <p className="mt-0.5 truncate text-xs text-[#67758A]">{selectedDocument?.original_filename ?? "Choose an analyzed document to begin"}</p>
            </div>
            <div className="flex items-center gap-2"><span className="rounded-full border border-black/10 bg-[#EAE6DB] px-3 py-1 text-xs font-medium text-[#526174]">Answers in {chatLanguages.find((item) => item.value === responseLanguage)?.label}</span><span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">Document grounded</span></div>
          </header>
          <header className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 md:hidden"><div className="min-w-0"><h1 className="truncate text-base font-bold text-[#181211]">{activeConversation?.title ?? "New conversation"}</h1><p className="truncate text-xs text-[#67758A]">{selectedDocument?.original_filename ?? "Choose an analyzed document"}</p></div><button type="button" onClick={beginConversation} disabled={!selectedDocumentId} aria-label="Start new conversation" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#181211] text-white disabled:opacity-45"><Plus size={19} /></button></header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10 lg:px-12"><div className="mx-auto flex w-full max-w-4xl flex-col gap-7">
            {isLoadingMessages && <p className="text-center text-sm text-[#67758A]">Loading conversation...</p>}
            {!isLoadingMessages && messages.length === 0 && <div className="py-16 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#181211] text-white"><Bot size={24} /></div><h1 className="mt-4 text-2xl font-bold text-[#181211]">Ask about your contract</h1><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#526174]">{selectedDocument ? `Ask a question about ${selectedDocument.original_filename}. Answers are grounded in its analyzed clauses.` : "Analyze a document first, then ask questions about its clauses."}</p></div>}
            {messages.map((message) => (
              <article key={message.id} className={`flex gap-3 sm:gap-4 ${message.role === "user" ? "justify-end" : "items-start"}`}>
                {message.role === "assistant" && <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#181211] text-white"><Sparkles size={16} /></div>}
                <div className={`max-w-2xl ${message.role === "user" ? "max-w-[85%]" : "w-full"}`}>
                  <div className={`text-sm leading-7 sm:text-[15px] ${message.role === "user" ? "rounded-2xl rounded-br-md bg-[#181211] px-4 py-3 text-white shadow-sm" : "rounded-2xl border border-black/10 bg-[#F7F3EA] px-5 py-4 text-[#181211] shadow-sm"}`}>
                    {message.role === "assistant" ? <AssistantAnswer message={message.message} /> : message.message}
                  </div>
                  <div className={`mt-1.5 flex items-center gap-2 text-xs text-[#67758A] ${message.role === "user" ? "justify-end" : ""}`}>
                    <span>{timeLabel(message.created_at)}</span>
                    {message.role === "assistant" && <button type="button" onClick={() => { void navigator.clipboard.writeText(message.message); toast.success("Answer copied"); }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition hover:bg-black/5"><Copy size={12} /> Copy</button>}
                  </div>
                  {message.role === "assistant" && message.sources.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.sources.map((source) => <span key={source.clause_id} className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#EAE6DB] px-2.5 py-1 text-xs text-[#526174]"><FileText size={12} className="text-[#0875D1]" /> {source.title}{source.page ? ` · p.${source.page}` : ""}</span>)}</div>}
                </div>
              </article>
            ))}
            {isSending && <article className="flex items-start gap-3 sm:gap-4"><div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#181211] text-white"><Sparkles size={16} /></div><div className="rounded-2xl border border-black/10 bg-[#F7F3EA] px-5 py-4 text-sm text-[#526174] shadow-sm"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0875D1]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0875D1] [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0875D1] [animation-delay:240ms]" /></span><span className="ml-3">Reading the most relevant clauses…</span></div></article>}
          </div></div>
          <footer className="border-t border-black/10 bg-[#F5F1E9] px-4 py-4 sm:px-8 lg:px-12"><div className="mx-auto w-full max-w-4xl"><div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={!selectedDocumentId || isSending} onClick={() => void sendMessage(undefined, suggestion)} className="shrink-0 rounded-full border border-black/15 bg-[#EAE6DB] px-4 py-2 text-xs font-medium text-[#181211] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm">{suggestion}</button>)}</div><form onSubmit={(event) => void sendMessage(event)} className="flex items-center gap-2 rounded-2xl border border-black/15 bg-[#EAE6DB] p-2 shadow-sm"><input value={draft} disabled={!selectedDocumentId || isSending} onChange={(event) => setDraft(event.target.value)} placeholder={selectedDocumentId ? "Ask anything about your contract..." : "Choose an analyzed document first"} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[#181211] outline-none placeholder:text-[#67758A] disabled:cursor-not-allowed" /><button type="submit" disabled={!draft.trim() || !selectedDocumentId || isSending} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#181211] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"><Send size={18} /></button></form><p className="mt-3 text-center text-xs text-[#67758A]">Answers are grounded in your uploaded contract. Not legal advice.</p></div></footer>
        </div>
      </section>
      {conversationToDelete && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-conversation-title">
        <div className="w-full max-w-md rounded-2xl border border-black/10 bg-[#F7F3EA] p-6 shadow-2xl">
          <h2 id="delete-conversation-title" className="text-lg font-bold text-[#181211]">Delete conversation?</h2>
          <p className="mt-2 text-sm leading-6 text-[#526174]">This removes <span className="font-semibold text-[#181211]">{conversationToDelete.title}</span> and all of its messages. This cannot be undone.</p>
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setConversationToDelete(null)} disabled={isDeletingConversation} className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold text-[#181211] transition hover:bg-white disabled:opacity-50">Cancel</button><button type="button" onClick={() => void deleteConversation()} disabled={isDeletingConversation} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">{isDeletingConversation ? "Deleting…" : "Delete"}</button></div>
        </div>
      </div>}
    </DashboardLayout>
  );
}
