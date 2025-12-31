import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, CheckSquare, Timer, FileText, Calendar, Sun, LogOut } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutGrid, label: "Painel", path: "/dashboard" },
  { icon: CheckSquare, label: "0s", path: "/tasks" },
  { icon: Timer, label: "Pomodoro", path: "/pomodoro" },
  { icon: FileText, label: "Notas", path: "/notes" },
  { icon: Calendar, label: "Calendário", path: "/calendar" },
];

const SidebarNav = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-sidebar h-screen flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <img src={logoIcon} alt="Logo" className="w-10 h-10 rounded-lg" />
        <span className="font-semibold text-sidebar-foreground">Foco no Trabalho</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  "sidebar-link",
                  location.pathname === item.path && "sidebar-link-active"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <div className="px-3 py-2 text-sm text-muted-foreground truncate">
          victoriandominussystem@g...
        </div>
        <button className="sidebar-link w-full">
          <Sun className="w-5 h-5" />
          <span>Modo claro</span>
        </button>
        <Link to="/" className="sidebar-link w-full">
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </Link>
      </div>
    </aside>
  );
};

export default SidebarNav;
