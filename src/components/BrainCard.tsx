import { Brain, BRAIN_COLORS } from "@/hooks/useBrains";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Brain as BrainIcon, ChevronRight } from "lucide-react";

interface BrainCardProps {
  brain: Brain;
  noteCount: number;
  subBrainCount?: number;
  onClick: () => void;
  onDelete: () => void;
}

const BrainCard = ({ brain, noteCount, subBrainCount = 0, onClick, onDelete }: BrainCardProps) => {
  const colorConfig = BRAIN_COLORS.find(c => c.name === brain.color) || BRAIN_COLORS[0];

  return (
    <Card
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all group border-2 hover:shadow-lg ${colorConfig.class}`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorConfig.dot}/20`}>
          <BrainIcon className={`w-6 h-6 ${colorConfig.text}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-lg truncate">{brain.name}</h3>
          <p className="text-sm text-muted-foreground">
            {noteCount} {noteCount === 1 ? 'nota' : 'notas'}
            {subBrainCount > 0 && (
              <span className="ml-2">
                · {subBrainCount} {subBrainCount === 1 ? 'sub-cérebro' : 'sub-cérebros'}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
};

export default BrainCard;
