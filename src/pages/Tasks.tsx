import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

  // Fetch tasks
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
      title: "Tarefa excluída",
      description: "A tarefa foi removida."
    });
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

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
      
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">{pendingTasks.length} pendentes, {completedTasks.length} concluídas</p>
        </div>

        {/* Add Task Form */}
        <form onSubmit={createTask} className="flex gap-2 mb-8 max-w-xl">
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
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-foreground">Pendentes</h2>
          {pendingTasks.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma tarefa pendente</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="stat-card flex items-center gap-4 group"
                >
                  <button
                    onClick={() => toggleTask(task)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <span className="flex-1 text-foreground">{task.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Concluídas</h2>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="stat-card flex items-center gap-4 group opacity-60"
                >
                  <button
                    onClick={() => toggleTask(task)}
                    className="text-success"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <span className="flex-1 text-foreground line-through">{task.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Tasks;
