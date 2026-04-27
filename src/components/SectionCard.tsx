import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { CopyButton } from "./CopyButton";
import { GlassPanel } from "./GlassPanel";

type SectionCardProps = ComponentPropsWithoutRef<"section"> & {
  eyebrow: string;
  title: string;
  copyText: string;
  children: ReactNode;
  onCopied?: () => void;
};

export function SectionCard({
  eyebrow,
  title,
  copyText,
  children,
  className = "",
  onCopied,
  ...props
}: SectionCardProps) {
  return (
    <GlassPanel className={`scroll-mt-36 ${className}`} {...props}>
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#00c9d2]/18 pb-4">
        <div>
          <p className="mb-1 text-[0.7rem] font-black uppercase tracking-[0.09em] text-[#0f928c]">
            {eyebrow}
          </p>
          <h2 className="text-base font-black text-[#484848]">{title}</h2>
        </div>
        <CopyButton text={copyText} compact onCopied={onCopied} />
      </div>
      {children}
    </GlassPanel>
  );
}
