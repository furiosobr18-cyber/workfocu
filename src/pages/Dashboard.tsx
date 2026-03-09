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
  
  const cachedDash = (() => { try { const r = localStorage.getItem("dash_cache"); return r ? JSON.parse(r) : null; } catch { return null; } })();
  
  const [stats, setStats] = useState(cachedDash?.stats ?? { pendingTasks: 0, completedToday: 0, pomodoroSessions: 0, notesCount: 0 });
  const [todayEvents, setTodayEvents] = useState<any[]>(cachedDash?.todayEvents ?? []);
  const [recentTasks, setRecentTasks] = useState<any[]>(cachedDash?.recentTasks ?? []);
  const [isLoading, setIsLoading] = useState(!cachedDash);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    // Execute all queries in parallel for better performance
    const [
      pendingResult,
      completedResult,
      pomodoroResult,
      notesResult,
      eventsResult,
      tasksResult
    ] = await Promise.all([
      // Pending tasks count
      supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', false),
      
      // Completed today count
      supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('updated_at', `${today}T00:00:00`),
      
      // Pomodoro sessions today count
      supabase
        .from('pomodoro_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('completed_at', `${today}T00:00:00`),
      
      // Notes count
      supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      
      // Today's events
      supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('event_date', today)
        .order('event_time', { ascending: true })
        .limit(5),
      
      // Recent tasks
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', false)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    const newStats = {
      pendingTasks: pendingResult.count || 0,
      completedToday: completedResult.count || 0,
      pomodoroSessions: pomodoroResult.count || 0,
      notesCount: notesResult.count || 0
    };
    const newEvents = eventsResult.data || [];
    const newTasks = tasksResult.data || [];
    
    setStats(newStats);
    setTodayEvents(newEvents);
    setRecentTasks(newTasks);
    setIsLoading(false);
    
    try { localStorage.setItem("dash_cache", JSON.stringify({ stats: newStats, todayEvents: newEvents, recentTasks: newTasks })); } catch {}
  };

  // Format current date in Portuguese
  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <SidebarNav />
        <main className="flex-1 p-8">
          <div className="mb-8">
            <div className="h-9 w-32 bg-muted rounded animate-pulse mb-2" />
            <div className="h-5 w-48 bg-muted rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="stat-card">
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 w-12 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </main>
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
