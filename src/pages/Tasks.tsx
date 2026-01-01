import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Check, Circle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  due_date: string | null;
  created_at: string;
}

const Tasks = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as tarefas.",
        variant: "destructive"
      });
      return;
    }
    
    setTasks(data || []);
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user) return;
    
    setIsCreating(true);
    
    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: newTaskTitle.trim()
    });
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a tarefa.",
        variant: "destructive"
      });
    } else {
      setNewTaskTitle("");
      fetchTasks();
      toast({
        title: "Tarefa criada!",
        description: "Sua nova tarefa foi adicionada."
      });
    }
    
    setIsCreating(false);
  };

  const toggleTask = async (task: Task) => {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id);
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a tarefa.",
        variant: "destructive"
      });
      return;
    }
    
    setTasks(tasks.map(t => 
      t.id === task.id ? { ...t, completed: !t.completed } : t
    ));
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a tarefa.",
        variant: "destructive"
      });
      return;
    }
    
    setTasks(tasks.filter(t => t.id !== taskId));
    toast({
      title: "Tarefa excluída"
    });
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header with Progress */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-4">Tarefas</h1>
            
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Progresso</p>
                    <p className="text-sm text-muted-foreground">
                      {completedTasks.length} de {totalTasks} tarefas concluídas
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-primary">{progressPercent}%</span>
                </div>
              </div>
              
              <Progress value={progressPercent} className="h-3" />
              
              <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                <span>{pendingTasks.length} pendentes</span>
                <span>{completedTasks.length} concluídas</span>
              </div>
            </Card>
          </div>

          {/* Add Task Form */}
          <form onSubmit={createTask} className="flex gap-2 mb-6">
            <Input
              placeholder="Nova tarefa..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isCreating || !newTaskTitle.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </form>

          {/* Pending Tasks */}
          <div className="space-y-3 mb-8">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Pendentes ({pendingTasks.length})
            </h2>
            {pendingTasks.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">Nenhuma tarefa pendente</p>
                <p className="text-sm text-muted-foreground mt-1">Adicione uma nova tarefa acima</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="p-4 flex items-center gap-4 group hover:bg-accent/50 transition-colors"
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      className="w-6 h-6 rounded-full border-2 border-muted-foreground/50 hover:border-primary hover:bg-primary/10 transition-colors flex items-center justify-center"
                    >
                      <Circle className="w-4 h-4 text-transparent" />
                    </button>
                    <span className="flex-1 text-foreground">{task.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Concluídas ({completedTasks.length})
              </h2>
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="p-4 flex items-center gap-4 group opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <button
                      onClick={() => toggleTask(task)}
                      className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </button>
                    <span className="flex-1 text-foreground line-through">{task.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Tasks;
