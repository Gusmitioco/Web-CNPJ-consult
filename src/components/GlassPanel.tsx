import type { ComponentPropsWithoutRef } from "react";

type GlassPanelProps = ComponentPropsWithoutRef<"section"> & {
  className?: string;
};

export function GlassPanel({ children, className = "", ...props }: GlassPanelProps) {
  return (
    <section
      {...props}
      className={`rounded-2xl border border-white/42 bg-white/28 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_20px_54px_rgba(0,100,101,0.16)] backdrop-blur-xl transition-colors duration-200 ${className}`}
    >
      {children}
    </section>
  );
}
