import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useCanvasPersistence } from "@/hooks/useCanvasPersistence";
import CustomCanvas from "@/components/custom-canvas/CustomCanvas";
import CanvasToolbar from "@/components/custom-canvas/CanvasToolbar";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function Canvas() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const store = useCanvasStore();

  const { isSaving, lastSaved, saveNow, scheduleSave } = useCanvasPersistence(store);

  const handleChanged = useCallback(() => {
    scheduleSave();
  }, [scheduleSave]);

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveNow]);

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
      {sidebarOpen && <SidebarNav />}
      <main className="flex-1 relative">
        {/* Sidebar toggle */}
        <div className="absolute top-3 left-3 z-[500]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="bg-card/80 backdrop-blur-sm shadow-md border border-border hover:bg-accent rounded-xl"
          >
            {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </Button>
        </div>

        {/* Canvas */}
        <div className="absolute inset-0" data-canvas-root>
          <CustomCanvas store={store} onChanged={handleChanged} />
        </div>

        {/* Toolbar */}
        <CanvasToolbar
          store={store}
          isSaving={isSaving}
          lastSaved={lastSaved}
          onSaveNow={saveNow}
          onChanged={handleChanged}
        />
      </main>
    </div>
  );
}
