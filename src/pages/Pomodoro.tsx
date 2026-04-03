import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Pause, RotateCcw, Coffee, Brain, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type SessionType = "work" | "short_break" | "long_break";

const TIMER_CONFIGS = {
  work: { minutes: 25, label: "Foco", icon: Brain },
  short_break: { minutes: 5, label: "Pausa Curta", icon: Coffee },
  long_break: { minutes: 15, label: "Pausa Longa", icon: Coffee },
};

// Create audio context for notification sound
const playNotificationSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Create a pleasant chime sound
  const playTone = (frequency: number, startTime: number, duration: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };
  
  const now = audioContext.currentTime;
  // Play a pleasant three-tone chime
  playTone(523.25, now, 0.3);       // C5
  playTone(659.25, now + 0.15, 0.3); // E5
  playTone(783.99, now + 0.3, 0.5);  // G5
};

const Pomodoro = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [sessionType, setSessionType] = useState<SessionType>("work");
  const [timeLeft, setTimeLeft] = useState(TIMER_CONFIGS.work.minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Fetch today's sessions count
  useEffect(() => {
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      supabase
        .from('pomodoro_sessions')
        .select('id')
        .eq('user_id', user.id)
        .gte('completed_at', `${today}T00:00:00`)
        .lt('completed_at', `${today}T23:59:59`)
        .then(({ data }) => {
          setTodaySessions(data?.length || 0);
        });
    }
  }, [user, sessionsCompleted]);

  const handleSessionComplete = useCallback(async () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
    setIsRunning(false);
    
    // Play notification sound
    if (soundEnabled) {
      playNotificationSound();
    }
    
    if (user && sessionType === "work") {
      // Save completed work session
      await supabase.from('pomodoro_sessions').insert({
        user_id: user.id,
        duration_minutes: TIMER_CONFIGS.work.minutes,
        session_type: sessionType
      });
      
      setSessionsCompleted((prev) => prev + 1);
      
      toast({
        title: "🎉 Sessão concluída!",
        description: "Hora de fazer uma pausa.",
      });
      
      // Auto-switch to break
      const newSessions = sessionsCompleted + 1;
      if (newSessions % 4 === 0) {
        switchSession("long_break");
      } else {
        switchSession("short_break");
      }
    } else {
      toast({
        title: "☕ Pausa finalizada!",
        description: "Pronto para mais uma sessão de foco?",
      });
      switchSession("work");
    }
  }, [user, sessionType, sessionsCompleted, soundEnabled]);

  // Timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleSessionComplete();
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, handleSessionComplete]);

  const switchSession = (type: SessionType) => {
    setSessionType(type);
    setTimeLeft(TIMER_CONFIGS[type].minutes * 60);
    setIsRunning(false);
    hasCompletedRef.current = false;
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setTimeLeft(TIMER_CONFIGS[sessionType].minutes * 60);
    setIsRunning(false);
    hasCompletedRef.current = false;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = (timeLeft / (TIMER_CONFIGS[sessionType].minutes * 60)) * 100;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) return null;

  const CurrentIcon = TIMER_CONFIGS[sessionType].icon;

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pomodoro</h1>
            <p className="text-muted-foreground">Sessões hoje: {todaySessions}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        </div>

        {/* Session Type Tabs */}
        <div className="flex gap-2 mb-8 justify-center">
          {(Object.keys(TIMER_CONFIGS) as SessionType[]).map((type) => (
            <Button
              key={type}
              variant={sessionType === type ? "default" : "outline"}
              onClick={() => switchSession(type)}
              className="min-w-[120px]"
            >
              {TIMER_CONFIGS[type].label}
            </Button>
          ))}
        </div>

        {/* Timer Display */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-72 h-72 mb-8">
            {/* Progress Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="144"
                cy="144"
                r="130"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="144"
                cy="144"
                r="130"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={2 * Math.PI * 130}
                strokeDashoffset={2 * Math.PI * 130 * (1 - progress / 100)}
                className="text-primary transition-all duration-1000"
                strokeLinecap="round"
              />
            </svg>
            
            {/* Timer Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <CurrentIcon className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-6xl font-bold text-foreground">
                {formatTime(timeLeft)}
              </span>
              <span className="text-muted-foreground mt-2">
                {TIMER_CONFIGS[sessionType].label}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-4">
            <Button
              size="lg"
              onClick={toggleTimer}
              className="w-16 h-16 rounded-full"
            >
              {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={resetTimer}
              className="w-16 h-16 rounded-full"
            >
              <RotateCcw className="w-6 h-6" />
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              Sessões de foco completadas: <span className="text-foreground font-semibold">{sessionsCompleted}</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pomodoro;
