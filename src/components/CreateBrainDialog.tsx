import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAIN_COLORS } from "@/hooks/useBrains";
import { Brain as BrainIcon } from "lucide-react";

interface CreateBrainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateBrain: (name: string, color: string) => void;
  initialNoteCount?: number;
}

const CreateBrainDialog = ({
  open,
  onOpenChange,
  onCreateBrain,
  initialNoteCount = 0,
}: CreateBrainDialogProps) => {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");

  const handleCreate = () => {
    if (name.trim()) {
      onCreateBrain(name.trim(), selectedColor);
      setName("");
      setSelectedColor("blue");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrainIcon className="w-5 h-5 text-primary" />
            Criar Segundo Cérebro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {initialNoteCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {initialNoteCount} {initialNoteCount === 1 ? 'nota conectada será adicionada' : 'notas conectadas serão adicionadas'} ao novo cérebro.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="brain-name">Nome do Cérebro</Label>
            <Input
              id="brain-name"
              placeholder="Ex: Projeto Alpha, Estudos, Ideias..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {BRAIN_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.name)}
                  className={`w-8 h-8 rounded-full transition-all ${color.dot} ${
                    selectedColor === color.name
                      ? 'ring-2 ring-offset-2 ring-primary scale-110'
                      : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Criar Cérebro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBrainDialog;
