import { Layers2 } from "lucide-react";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`} aria-hidden="true">
      <Layers2 size={small ? 17 : 22} strokeWidth={2} />
    </span>
  );
}
