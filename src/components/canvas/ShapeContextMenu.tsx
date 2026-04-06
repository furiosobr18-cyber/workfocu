import { useState, useEffect, useRef } from "react";
import { Editor } from "tldraw";
import { Lock, Unlock } from "lucide-react";

interface ShapeContextMenuProps {
  editor: Editor | null;
}

export default function ShapeContextMenu({ editor }: ShapeContextMenuProps) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const sync = () => {
      const ids = editor.getSelectedShapeIds();
      if (ids.length === 0) {
        setMenuPos(null);
        return;
      }

      const shapes = ids.map(id => editor.getShape(id)).filter(Boolean);
      const allLocked = shapes.length > 0 && shapes.every(s => s!.isLocked);

      // Hide menu if all selected shapes are locked
      if (allLocked) {
        setMenuPos(null);
        setIsLocked(true);
        setSelectedIds([...ids]);
        return;
      }

      setSelectedIds([...ids]);
      setIsLocked(false);

      const bounds = editor.getSelectionRotatedPageBounds();
      if (bounds) {
        const screenPoint = editor.pageToScreen({ x: bounds.maxX, y: bounds.minY });
        setMenuPos({ x: screenPoint.x + 8, y: screenPoint.y - 8 });
      }
    };

    sync();
    const unsub = editor.store.listen(sync);
    return () => unsub();
  }, [editor]);

  const toggleLock = () => {
    if (!editor || selectedIds.length === 0) return;
    
    const newLocked = !isLocked;
    selectedIds.forEach(id => {
      editor.updateShape({ id: id as any, type: editor.getShape(id as any)!.type, isLocked: newLocked });
    });
    setIsLocked(newLocked);
  };

  if (!menuPos || selectedIds.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-[600] flex flex-col items-center gap-1"
      style={{ left: menuPos.x, top: menuPos.y, transform: "translate(0, -100%)" }}
    >
      <button
        onClick={toggleLock}
        title="Fixar elemento"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border shadow-lg text-xs text-foreground hover:bg-accent transition-colors"
      >
        <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
        <span>Fixar</span>
      </button>
    </div>
  );
}
