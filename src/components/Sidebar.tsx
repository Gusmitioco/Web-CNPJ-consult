import { Building2, ClipboardList, FileSearch, Landmark, UsersRound } from "lucide-react";

export const navItems = [
  { label: "Consulta", href: "#consulta", icon: FileSearch },
  { label: "Cadastro", href: "#cadastro", icon: Building2 },
  { label: "Fiscal", href: "#fiscal", icon: Landmark },
  { label: "QSA / Historico", href: "#qsa", icon: UsersRound }
];

type SidebarProps = {
  activeSection: string;
  onNavigate: (href: string) => void;
};

export function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 p-5 lg:block">
      <div className="flex h-full flex-col rounded-3xl border border-[#00c9d2]/18 bg-[#484848]/95 p-5 text-white shadow-[0_18px_42px_rgba(0,100,101,0.18)] backdrop-blur-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#beee3b] text-sm font-black text-[#006465]">
            CF
          </div>
          <div>
            <strong className="block text-base">Consulta Fiscal</strong>
            <span className="block text-xs font-semibold text-white/58">CNPJ e cadastros</span>
          </div>
        </div>

        <nav className="grid gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.href.slice(1);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => onNavigate(item.href)}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition-colors duration-200 ${
                  isActive
                    ? "bg-[#beee3b] text-[#006465] shadow-lg shadow-[#beee3b]/15"
                    : "text-white/68 hover:bg-[#00c9d2]/12 hover:text-white"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#00c9d2] transition-opacity duration-200 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-[#00c9d2]/20 bg-[#006465]/34 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#beee3b]">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Fontes futuras
          </div>
          <div className="grid gap-2 text-sm font-bold text-white/82">
            <span>Receita Federal</span>
            <span>SEFAZ estadual</span>
            <span>Sintegra</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
