import { navItems } from "./Sidebar";

type MobileNavProps = {
  activeSection: string;
  onNavigate: (href: string) => void;
};

export function MobileNav({ activeSection, onNavigate }: MobileNavProps) {
  return (
    <nav className="sticky top-4 z-20 mx-auto mt-4 flex w-fit max-w-[calc(100%-32px)] gap-2 overflow-x-auto rounded-2xl border border-white/42 bg-white/24 p-2 text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_16px_38px_rgba(0,100,101,0.14)] backdrop-blur-xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.href.slice(1);
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => onNavigate(item.href)}
            className={`flex h-11 min-w-max items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition-colors duration-200 ${
              isActive
                ? "bg-white/58 text-[#006465] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(0,100,101,0.1)]"
                : "text-[#006465]/72 hover:bg-white/32 hover:text-[#006465]"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
