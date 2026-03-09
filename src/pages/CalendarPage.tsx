import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  created_at: string;
}

const CalendarPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<CalendarEvent[]>(() => { try { const r = localStorage.getItem("calendar_cache"); return r ? JSON.parse(r) : []; } catch { return []; } });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Fetch events
  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('event_date', { ascending: true });
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os eventos.",
        variant: "destructive"
      });
      return;
    }
    
    setEvents(data || []);
    try { localStorage.setItem("calendar_cache", JSON.stringify(data || [])); } catch {}
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !user) return;
    
    setIsCreating(true);
    
    const { error } = await supabase.from('calendar_events').insert({
      user_id: user.id,
      title: newEventTitle.trim(),
      event_date: format(selectedDate, 'yyyy-MM-dd'),
      event_time: newEventTime || null
    });
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o evento.",
        variant: "destructive"
      });
    } else {
      setNewEventTitle("");
      setNewEventTime("");
      fetchEvents();
      toast({
        title: "Evento criado!",
        description: "Seu novo evento foi adicionado."
      });
    }
    
    setIsCreating(false);
  };

  const deleteEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);
    
    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o evento.",
        variant: "destructive"
      });
      return;
    }
    
    setEvents(events.filter(e => e.id !== eventId));
    toast({
      title: "Evento excluído",
      description: "O evento foi removido."
    });
  };

  // Get events for selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const eventsForSelectedDate = events.filter(e => e.event_date === selectedDateStr);

  // Get dates that have events
  const eventDates = events.map(e => new Date(e.event_date + 'T12:00:00'));

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
          <h1 className="text-3xl font-bold text-foreground">Calendário</h1>
          <p className="text-muted-foreground">{events.length} eventos agendados</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calendar */}
          <div className="stat-card">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={ptBR}
              className="rounded-md"
              modifiers={{
                hasEvent: eventDates
              }}
              modifiersStyles={{
                hasEvent: {
                  backgroundColor: 'hsl(var(--primary) / 0.2)',
                  borderRadius: '50%'
                }
              }}
            />
          </div>

          {/* Events for Selected Date */}
          <div className="stat-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h2>

            {/* Add Event Form */}
            <form onSubmit={createEvent} className="flex flex-col gap-2 mb-6">
              <Input
                placeholder="Título do evento..."
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="w-32"
                />
                <Button type="submit" disabled={isCreating || !newEventTitle.trim()} className="flex-1">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </form>

            {/* Events List */}
            <div className="space-y-2">
              {eventsForSelectedDate.length === 0 ? (
                <p className="text-muted-foreground">Nenhum evento para este dia</p>
              ) : (
                eventsForSelectedDate.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                  >
                    {event.event_time && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">{event.event_time.slice(0, 5)}</span>
                      </div>
                    )}
                    <span className="flex-1 text-foreground">{event.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEvent(event.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CalendarPage;
