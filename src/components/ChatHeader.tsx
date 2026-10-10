import { ChevronDown, Menu, UserRound } from "lucide-react";
import type { EmployeeRole } from "../../shared/chat";
import { models, roles } from "../data/models";

interface Props {
  role: EmployeeRole;
  modelIndex: number;
  onRole: (role: EmployeeRole) => void;
  onModel: (index: number) => void;
  onMenu: () => void;
}

export function ChatHeader({
  role,
  modelIndex,
  onRole,
  onModel,
  onMenu,
}: Props) {
  return (
    <header className="chat-header">
      <div className="header-left">
        <button
          className="icon-button mobile-menu"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>
        <span className="workspace-name">Workplace assistant</span>
        <span className="header-divider" />
        <label className="select-wrap role-select">
          <UserRound size={15} />
          <select
            aria-label="Employee role"
            value={role}
            onChange={(event) => onRole(event.target.value as EmployeeRole)}
          >
            {roles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
      </div>
      <div className="header-right">
        <span className="prototype-badge">Demo mode</span>
        <label className="select-wrap model-select">
          <span className="model-symbol">✦</span>
          <select
            aria-label="AI model"
            value={modelIndex}
            onChange={(event) => onModel(Number(event.target.value))}
          >
            {models.map((item, index) => (
              <option key={item.provider} value={index}>
                {item.label} · {item.company} (demo)
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
    </header>
  );
}
