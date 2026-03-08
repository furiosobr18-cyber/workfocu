import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { Brain } from "lucide-react";

const FortyPercentRule = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-auto flex items-center justify-center">
        <div className="max-w-lg mx-auto text-center space-y-8 p-6">
          {/* Brain at 40% visualization */}
          <div className="relative w-48 h-48 mx-auto">
            {/* Outer ring */}
            <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
              {/* Background track */}
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="8"
              />
              {/* 40% filled arc */}
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="hsl(var(--foreground))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 88 * 0.4} ${2 * Math.PI * 88 * 0.6}`}
                className="transition-all duration-1000"
              />
            </svg>
            {/* Brain icon centered */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Brain className="w-14 h-14 text-foreground mb-1" />
              <span className="text-2xl font-bold text-foreground">40%</span>
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              The 40% Rule
            </h1>
            <div className="border border-border rounded-lg bg-card p-6 space-y-4">
              <p className="text-foreground leading-relaxed">
                Quando você acha que chegou no seu limite, você está apenas a{" "}
                <span className="font-bold text-foreground">40%</span> do seu potencial.
              </p>
              <div className="w-12 border-t border-border mx-auto" />
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "A mente desiste muito antes do corpo. Quando tudo em você diz para parar,
                lembre-se: ainda restam 60% de capacidade inexplorada. Vá além do que sua mente
                permite."
              </p>
            </div>
          </div>

          {/* Visual bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Limite percebido</span>
              <span>Potencial real</span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-1000"
                style={{ width: "40%" }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-foreground font-medium">40%</span>
              <span className="text-muted-foreground">100%</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FortyPercentRule;
