import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyToClipboard } from "../utils/copy";

type CopyButtonProps = {
  text: string;
  label?: string;
  compact?: boolean;
  onCopied?: () => void;
};

export function CopyButton({ text, label = "Copiar", compact = false, onCopied }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const showText = Boolean(label);

  async function handleCopy() {
    await copyToClipboard(text);
    setCopied(true);
    onCopied?.();
    window.setTimeout(() => setCopied(false), 1400);
  }

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-[#00c9d2]/22 bg-white/45 font-bold text-[#006465] shadow-sm shadow-[#006465]/5 transition-all duration-300 hover:bg-[#beee3b]/28 ${
        compact ? "h-9 min-w-9 px-3 text-xs" : "h-10 px-4 text-sm"
      }`}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {showText ? <span>{copied ? "Copiado" : label}</span> : null}
    </button>
  );
}
