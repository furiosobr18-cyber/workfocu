import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, TrendingUp, Timer, FileText, Calendar, CheckCircle } from "lucide-react";
import SidebarNav from "@/components/SidebarNav";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Format current date in Portuguese
  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Painel</h1>
          <p className="text-muted-foreground capitalize">{currentDate}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            label="0s Pendentes" 
            value={0} 
            icon={CheckSquare} 
          />
          <StatCard 
            label="Concluídas Hoje" 
            value={0} 
            icon={TrendingUp}
            valueColor="success"
          />
          <StatCard 
            label="Sessões Pomodoro" 
            value={0} 
            icon={Timer} 
          />
          <StatCard 
            label="Notas" 
            value={0} 
            icon={FileText} 
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Events Card */}
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Eventos de Hoje</h2>
            </div>
            <p className="text-muted-foreground">Nenhum evento para hoje</p>
          </div>

          {/* Tasks Card */}
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Tarefas Recentes</h2>
            </div>
            <p className="text-muted-foreground">Nenhuma tarefa criada</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
