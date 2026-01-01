import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, TrendingUp, Timer, FileText, Calendar, CheckCircle } from "lucide-react";
import SidebarNav from "@/components/SidebarNav";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({
    pendingTasks: 0,
    completedToday: 0,
    pomodoroSessions: 0,
    notesCount: 0
  });
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchTodayEvents();
      fetchRecentTasks();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Pending tasks
    const { count: pendingCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', false);
    
    // Completed today
    const { count: completedCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('updated_at', `${today}T00:00:00`);
    
    // Pomodoro sessions today
    const { count: pomodoroCount } = await supabase
      .from('pomodoro_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('completed_at', `${today}T00:00:00`);
    
    // Notes count
    const { count: notesCount } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    setStats({
      pendingTasks: pendingCount || 0,
      completedToday: completedCount || 0,
      pomodoroSessions: pomodoroCount || 0,
      notesCount: notesCount || 0
    });
  };

  const fetchTodayEvents = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('event_date', today)
      .order('event_time', { ascending: true })
      .limit(5);
    
    setTodayEvents(data || []);
  };

  const fetchRecentTasks = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(5);
    
    setRecentTasks(data || []);
  };

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
            label="Tarefas Pendentes" 
            value={stats.pendingTasks} 
            icon={CheckSquare} 
          />
          <StatCard 
            label="Concluídas Hoje" 
            value={stats.completedToday} 
            icon={TrendingUp}
            valueColor="success"
          />
          <StatCard 
            label="Sessões Pomodoro" 
            value={stats.pomodoroSessions} 
            icon={Timer} 
          />
          <StatCard 
            label="Notas" 
            value={stats.notesCount} 
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
            {todayEvents.length === 0 ? (
              <p className="text-muted-foreground">Nenhum evento para hoje</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-2 text-sm">
                    {event.event_time && (
                      <span className="text-muted-foreground">{event.event_time.slice(0, 5)}</span>
                    )}
                    <span className="text-foreground">{event.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks Card */}
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Tarefas Recentes</h2>
            </div>
            {recentTasks.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma tarefa criada</p>
            ) : (
              <div className="space-y-2">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-foreground">{task.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
