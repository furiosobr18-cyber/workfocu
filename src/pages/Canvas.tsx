import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import SidebarNav from "@/components/SidebarNav";
import { useAuth } from "@/hooks/useAuth";

const Canvas = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
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
      <main className="flex-1 relative">
        <div className="absolute inset-0">
          <Tldraw />
        </div>
      </main>
    </div>
  );
};

export default Canvas;
