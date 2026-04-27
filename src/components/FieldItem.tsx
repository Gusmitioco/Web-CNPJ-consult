import type { Field } from "../types";
import { CopyButton } from "./CopyButton";

type FieldItemProps = Field & {
  onCopied?: () => void;
};

export function FieldItem({ label, value, onCopied }: FieldItemProps) {
  return (
    <div className="group min-w-0 rounded-xl border border-white/38 bg-white/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_26px_rgba(0,100,101,0.1)] backdrop-blur-md transition-colors duration-300 hover:border-[#0f928c]/32 hover:bg-white/38">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[0.69rem] font-black uppercase tracking-[0.08em] text-[#006465]">
          {label}
        </span>
        <CopyButton text={`${label}: ${value}`} label="" compact onCopied={onCopied} />
      </div>
      <strong className="block min-w-0 break-words text-sm leading-snug text-[#484848]">{value}</strong>
    </div>
  );
}
