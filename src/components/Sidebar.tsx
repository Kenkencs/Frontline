import {
  BookOpen,
  CircleHelp,
  LayoutGrid,
  MessageSquare,
  Plus,
  Settings,
  X,
} from "lucide-react";
import type { Conversation, View } from "../types";
import { Brand } from "./Brand";

interface Props {
  conversations: Conversation[];
  activeId: string;
  view: View;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onView: (view: View) => void;
}

export function Sidebar({
  conversations,
  activeId,
  view,
  open,
  onClose,
  onNew,
  onSelect,
  onView,
}: Props) {
  const navigation = [
    { id: "faq" as const, label: "FAQs", icon: CircleHelp },
    { id: "knowledge" as const, label: "Knowledge Base", icon: BookOpen },
    { id: "manager" as const, label: "Manager Dashboard", icon: LayoutGrid },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];
  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}
      <aside
        className={`sidebar ${open ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="brand">
          <Brand />
          <div>
            <strong>Frontline</strong>
            <span>Workplace assistant</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <button className="new-chat" onClick={onNew}>
          <Plus size={18} /> New conversation
        </button>
        <div className="history-label">
          CONVERSATIONS <span>This session</span>
        </div>
        <nav className="history" aria-label="Previous conversations">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`history-item ${view === "chat" && activeId === conversation.id ? "active" : ""}`}
              onClick={() => onSelect(conversation.id)}
              aria-current={
                view === "chat" && activeId === conversation.id
                  ? "page"
                  : undefined
              }
            >
              <MessageSquare size={16} />
              <span>{conversation.title}</span>
            </button>
          ))}
        </nav>
        <nav className="utility-nav" aria-label="Workspace">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => onView(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="employee-avatar">Y</div>
          <div>
            <strong>Your workspace</strong>
            <span>Sample workplace</span>
          </div>
          <span className="demo-label">DEMO</span>
        </div>
      </aside>
    </>
  );
}
