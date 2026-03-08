import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, CheckSquare, Timer, FileText, Calendar, PenTool, Sun, Moon, LogOut } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "@/hooks/use-toast";

const navItems = [
  { icon: LayoutGrid, label: "Painel", path: "/dashboard" },
  { icon: CheckSquare, label: "Tarefas", path: "/tasks" },
  { icon: Timer, label: "Pomodoro", path: "/pomodoro" },
  { icon: FileText, label: "Notas", path: "/notes" },
  { icon: Calendar, label: "Calendário", path: "/calendar" },
  { icon: PenTool, label: "Canvas", path: "/canvas" },
];

const SidebarNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    const { error } = await signOut();
    
    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao sair. Tente novamente.",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Até logo!",
      description: "Você saiu da sua conta.",
    });
    navigate("/");
  };

  // Truncate email for display
  const displayEmail = user?.email 
    ? user.email.length > 25 
      ? user.email.substring(0, 22) + "..." 
      : user.email
    : "";

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
          {displayEmail}
        </div>
        <button onClick={toggleTheme} className="sidebar-link w-full">
          {theme === 'dark' ? (
            <>
              <Sun className="w-5 h-5" />
              <span>Modo claro</span>
            </>
          ) : (
            <>
              <Moon className="w-5 h-5" />
              <span>Modo escuro</span>
            </>
          )}
        </button>
        <button onClick={handleLogout} className="sidebar-link w-full">
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default SidebarNav;
