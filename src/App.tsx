import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, LoaderCircle } from "lucide-react";
import type {
  ActionResponse,
  ChatRequest,
  EmployeeRole,
  Source,
} from "../shared/chat";
import type { Conversation, EscalationDraft, View } from "./types";
import { ActionCard, SourceLinks } from "./components/ActionCard";
import { Brand } from "./components/Brand";
import { ChatHeader } from "./components/ChatHeader";
import { ChatComposer } from "./components/ChatComposer";
import { Sidebar } from "./components/Sidebar";
import { WorkspacePages } from "./components/WorkspacePages";
import { SourceDialog, EscalationDialog } from "./components/WorkspaceDialogs";
import { models, roles } from "./data/models";
import { sendChat } from "./services/chatClient";
import { allergyAction, getMockResponse } from "./services/mockChat";

const initialConversations: Conversation[] = [
  {
    id: "allergy-example",
    title: "Peanut allergy guidance",
    messages: [
      {
        id: "sample-worker",
        author: "worker",
        text: "Customer says she has a severe peanut allergy. Can she eat this cake?",
      },
      {
        id: "sample-assistant",
        author: "assistant",
        response: allergyAction,
        modelLabel: "GPT",
        request: {
          message:
            "Customer says she has a severe peanut allergy. Can she eat this cake?",
          employee_role: "waiter",
          provider: "openai",
          model: "demo-gpt",
        },
      },
    ],
  },
  {
    id: "opening-example",
    title: "Opening shift checklist",
    messages: [
      {
        id: "opening-worker",
        author: "worker",
        text: "What should I check before my shift starts?",
      },
      {
        id: "opening-assistant",
        author: "assistant",
        response: getMockResponse({
          message: "opening shift",
          employee_role: "waiter",
          provider: "openai",
          model: "demo-gpt",
        }),
        modelLabel: "GPT",
        request: {
          message: "What should I check before my shift starts?",
          employee_role: "waiter",
          provider: "openai",
          model: "demo-gpt",
        },
      },
    ],
  },
];

export default function App() {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState("allergy-example");
  const [view, setView] = useState<View>("chat");
  const [role, setRole] = useState<EmployeeRole>("waiter");
  const [modelIndex, setModelIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EscalationDraft[]>([]);
  const [notice, setNotice] = useState("");
  const sendingRef = useRef(false);
  const scrollArea = useRef<HTMLDivElement>(null);
  const lastScrollState = useRef("allergy-example:2:false:chat");
  const conversation = conversations.find((item) => item.id === activeId)!;
  const model = models[modelIndex];

  useEffect(() => {
    const state = `${activeId}:${conversation.messages.length}:${sending}:${view}`;
    if (lastScrollState.current === state) return;
    lastScrollState.current = state;
    if (scrollArea.current)
      scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [conversation.messages.length, sending, activeId, view]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const changeView = (next: View) => {
    setView(next);
    setSidebarOpen(false);
    setError("");
  };
  const newConversation = () => {
    const id = crypto.randomUUID();
    setConversations((items) => [
      { id, title: "New conversation", messages: [] },
      ...items,
    ]);
    setActiveId(id);
    changeView("chat");
  };

  const submitMessage = async (text: string) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    // Capture the conversation and selection so navigation cannot attach a reply to another chat.
    const targetId = activeId;
    const selectedModel = model;
    const request: ChatRequest = {
      message: text,
      employee_role: role,
      provider: selectedModel.provider,
      model: selectedModel.model,
    };
    setConversations((items) =>
      items.map((item) =>
        item.id === targetId
          ? {
              ...item,
              title: item.messages.length ? item.title : text.slice(0, 38),
              messages: [
                ...item.messages,
                { id: crypto.randomUUID(), author: "worker", text },
              ],
            }
          : item,
      ),
    );
    try {
      const response = await sendChat(request);
      setConversations((items) =>
        items.map((item) =>
          item.id === targetId
            ? {
                ...item,
                messages: [
                  ...item.messages,
                  {
                    id: crypto.randomUUID(),
                    author: "assistant",
                    response,
                    modelLabel: selectedModel.label,
                    request,
                  },
                ],
              }
            : item,
        ),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const openEscalation = (response: ActionResponse, request: ChatRequest) => {
    setDraftText(
      `Manager assistance requested\n\nRole: ${roles.find((item) => item.id === request.employee_role)?.label}\nSituation: ${response.summary}\nRisk: ${response.risk.toUpperCase()}\n\nWorker’s question: ${request.message}\n\nRecommended actions:\n${response.actions.map((action, index) => `${index + 1}. ${action}`).join("\n")}\n\nSources (sample policies): ${response.sources.map((item) => `${item.title} ${item.version} ${item.section}`).join(", ")}`,
    );
  };

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        view={view}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNew={newConversation}
        onSelect={(id) => {
          setActiveId(id);
          changeView("chat");
        }}
        onView={changeView}
      />
      <main className="main-panel">
        <ChatHeader
          role={role}
          modelIndex={modelIndex}
          onRole={setRole}
          onModel={setModelIndex}
          onMenu={() => setSidebarOpen(true)}
        />
        {view === "chat" ? (
          <>
            <div className="chat-scroll" ref={scrollArea}>
              <div className="chat-content">
                {conversation.messages.length ? (
                  <>
                    <div className="conversation-heading">
                      <span>CONVERSATION</span>
                      <h1>{conversation.title}</h1>
                    </div>
                    <div className="messages" aria-live="polite">
                      {conversation.messages.map((message) =>
                        message.author === "worker" ? (
                          <div className="worker-message" key={message.id}>
                            <span className="sr-only">You: </span>
                            {message.text}
                          </div>
                        ) : (
                          <div className="assistant-message" key={message.id}>
                            <div className="assistant-byline">
                              <Brand small />
                              <strong>Frontline</strong>
                              <span>{message.modelLabel} · Demo response</span>
                            </div>
                            {message.response.type === "action" ? (
                              <>
                                <p className="assistant-intro">
                                  Here’s how to handle this situation.
                                </p>
                                <ActionCard
                                  response={message.response}
                                  onSource={setSource}
                                  onEscalate={() =>
                                    openEscalation(
                                      message.response as ActionResponse,
                                      message.request,
                                    )
                                  }
                                />
                              </>
                            ) : (
                              <>
                                <p className="plain-message">
                                  {message.response.content}
                                </p>
                                <SourceLinks
                                  sources={message.response.sources}
                                  onSource={setSource}
                                />
                              </>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-chat">
                    <Brand />
                    <h1>What can I help you with?</h1>
                    <p>
                      Ask about a workplace situation, a procedure, or your next
                      step.
                    </p>
                    <div className="empty-hint">
                      <BookOpen size={16} />
                      Start with one of the sample questions below.
                    </div>
                  </div>
                )}
                {sending && (
                  <div className="loading-state" role="status">
                    <LoaderCircle className="spinner" size={17} />
                    Preparing a demo response…
                  </div>
                )}
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </div>
            <ChatComposer
              key={activeId}
              sending={sending}
              onSend={submitMessage}
            />
          </>
        ) : (
          <WorkspacePages
            view={view}
            role={role}
            modelIndex={modelIndex}
            drafts={drafts}
            onSource={setSource}
            onDraft={setDraftText}
            onRole={setRole}
            onModel={setModelIndex}
            onBack={() => changeView("chat")}
          />
        )}
      </main>
      <SourceDialog source={source} onClose={() => setSource(null)} />
      <EscalationDialog
        text={draftText}
        onChange={setDraftText}
        onClose={() => setDraftText(null)}
        onNotice={setNotice}
        onSave={(text) => {
          setDrafts((items) => [{ id: crypto.randomUUID(), text }, ...items]);
          setDraftText(null);
          setNotice("Draft saved to Manager Dashboard for this session.");
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
    </div>
  );
}
