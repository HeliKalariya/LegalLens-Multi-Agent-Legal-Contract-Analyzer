"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, MessageSquare, Plus, Send, Sparkles } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";

type Conversation = {
  id: number;
  title: string;
  time: string;
};

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

const conversations: Conversation[] = [
  { id: 1, title: "Acme MSA — termination options", time: "2h ago" },
  { id: 2, title: "NDA scope questions", time: "Yesterday" },
  { id: 3, title: "SOW payment terms", time: "Aug 8" },
  { id: 4, title: "Lease renewal clauses", time: "Aug 3" },
];

const suggestions = ["Is this contract safe?", "Can I terminate early?", "Are there hidden fees?", "What should I negotiate?"];

const initialMessages: Message[] = [
  { id: 1, role: "user", text: "Can my landlord increase rent?" },
  {
    id: 2,
    role: "assistant",
    text: "Based on the lease you uploaded, the landlord can increase rent once per calendar year with written notice. Review the price-change clause and notice period before agreeing. If you share the clause you are concerned about, I can explain its risk and suggest negotiation language.",
  },
];

/** A responsive, contract-focused chat workspace. Backend chat persistence can be connected here next. */
export default function AiChatPage() {
  const [activeConversation, setActiveConversation] = useState(1);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");

  const activeTitle = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversation)?.title ?? "New conversation",
    [activeConversation],
  );

  function beginConversation() {
    setActiveConversation(0);
    setMessages([]);
    setDraft("");
  }

  function selectConversation(id: number) {
    setActiveConversation(id);
    setMessages(initialMessages);
  }

  function sendMessage(event?: FormEvent, suggestedQuestion?: string) {
    event?.preventDefault();
    const question = (suggestedQuestion ?? draft).trim();
    if (!question) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: question },
      {
        id: Date.now() + 1,
        role: "assistant",
        text: "I can help you review this clause. This chat interface is ready for your document-grounded AI answer once the chat API is connected.",
      },
    ]);
    setDraft("");
  }

  return (
    <DashboardLayout>
      <section className="-m-4 flex min-h-[calc(100vh-5rem)] overflow-hidden border-t border-black/10 bg-[#F5F1E9] sm:-m-6 lg:-m-8">
        <aside className="hidden w-80 shrink-0 border-r border-black/15 bg-[#F1EDE3] p-5 md:flex md:flex-col lg:w-90">
          <button type="button" onClick={beginConversation} className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-black/15 bg-[#F7F3EA] px-5 text-sm font-semibold text-[#181211] shadow-sm transition hover:bg-white">
            <Plus size={19} /> New conversation
          </button>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#526174]">Recent</p>
          <div className="mt-3 space-y-1">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversation;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${isActive ? "bg-[#F7F3EA] shadow-sm" : "hover:bg-white/60"}`}
                >
                  <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-[#526174]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#181211]">{conversation.title}</span>
                    <span className="mt-0.5 block text-xs text-[#526174]">{conversation.time}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 md:hidden">
            <h1 className="truncate text-base font-bold text-[#181211]">{activeTitle}</h1>
            <button type="button" onClick={beginConversation} aria-label="Start new conversation" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#181211] text-white"><Plus size={19} /></button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-7">
              {messages.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#181211] text-white"><Bot size={24} /></div>
                  <h1 className="mt-4 text-2xl font-bold text-[#181211]">Ask about your contract</h1>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#526174]">Ask a question about an uploaded legal document to get a clear, clause-based answer.</p>
                </div>
              ) : messages.map((message) => (
                <article key={message.id} className={`flex gap-4 ${message.role === "user" ? "justify-end" : "items-start"}`}>
                  {message.role === "assistant" && <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#181211] text-white"><Sparkles size={18} /></div>}
                  <div className={`max-w-2xl rounded-3xl px-5 py-4 text-sm leading-6 sm:text-base ${message.role === "user" ? "rounded-tr-md bg-[#181211] text-white" : "rounded-tl-md border border-black/15 bg-[#EAE6DB] text-[#181211]"}`}>
                    {message.text}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <footer className="border-t border-black/10 bg-[#F5F1E9] px-4 py-4 sm:px-8 lg:px-12">
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => sendMessage(undefined, suggestion)} className="shrink-0 rounded-full border border-black/15 bg-[#EAE6DB] px-4 py-2 text-xs font-medium text-[#181211] transition hover:bg-white sm:text-sm">
                    {suggestion}
                  </button>
                ))}
              </div>
              <form onSubmit={sendMessage} className="flex items-center gap-2 rounded-2xl border border-black/15 bg-[#EAE6DB] p-2 shadow-sm">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask anything about your contract..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[#181211] outline-none placeholder:text-[#67758A]" />
                <button type="submit" disabled={!draft.trim()} aria-label="Send message" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#181211] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"><Send size={18} /></button>
              </form>
              <p className="mt-3 text-center text-xs text-[#67758A]">Answers are grounded in your uploaded contract. Not legal advice.</p>
            </div>
          </footer>
        </div>
      </section>
    </DashboardLayout>
  );
}
