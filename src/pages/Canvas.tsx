import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tldraw, Editor } from "tldraw";
import "tldraw/tldraw.css";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { YouTubeShapeUtil } from "@/components/canvas/YouTubeShape";
import { ImageShapeUtil } from "@/components/canvas/ImageShape";
import { FileShapeUtil } from "@/components/canvas/FileShape";
import { ChatShapeUtil } from "@/components/canvas/ChatShape";
import CanvasToolbar from "@/components/canvas/CanvasToolbar";

const customShapeUtils = [YouTubeShapeUtil, ImageShapeUtil, FileShapeUtil, ChatShapeUtil];

const Canvas = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor);
  }, []);

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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-14 left-2 z-[500] bg-background/80 backdrop-blur-sm shadow-sm border border-border hover:bg-accent"
        >
          {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
        </Button>
        <div className="absolute inset-0">
          <Tldraw shapeUtils={customShapeUtils} onMount={handleMount} />
        </div>
        <CanvasToolbar editor={editor} />
      </main>
    </div>
  );
};

export default Canvas;
