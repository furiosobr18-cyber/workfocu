import { useState } from "react";
import { ChevronRight, ChevronDown, Brain as BrainIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Brain, BRAIN_COLORS } from "@/hooks/useBrains";

interface BrainTreeProps {
  brains: Brain[];
  getChildBrains: (parentId: string) => Brain[];
  getNotesInBrain: (brainId: string) => string[];
  onSelectBrain: (brain: Brain) => void;
}

interface TreeNodeProps {
  brain: Brain;
  level: number;
  getChildBrains: (parentId: string) => Brain[];
  getNotesInBrain: (brainId: string) => string[];
  onSelectBrain: (brain: Brain) => void;
}

const TreeNode = ({ brain, level, getChildBrains, getNotesInBrain, onSelectBrain }: TreeNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const children = getChildBrains(brain.id);
  const noteCount = getNotesInBrain(brain.id).length;
  const hasChildren = children.length > 0;
  
  const colorConfig = BRAIN_COLORS.find(c => c.name === brain.color) || BRAIN_COLORS[0];
  
  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded transition-colors",
            hasChildren ? "hover:bg-muted" : "invisible"
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </button>
        
        {/* Brain Icon with Color */}
        <div
          className={cn(
            "w-6 h-6 rounded flex items-center justify-center",
            colorConfig.class
          )}
          onClick={() => onSelectBrain(brain)}
        >
          <BrainIcon className={cn("w-3.5 h-3.5", colorConfig.text)} />
        </div>
        
        {/* Name */}
        <span
          className="flex-1 text-sm text-foreground truncate hover:underline"
          onClick={() => onSelectBrain(brain)}
        >
          {brain.name}
        </span>
        
        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {noteCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {noteCount}
            </span>
          )}
          {hasChildren && (
            <span className="flex items-center gap-1">
              <BrainIcon className="w-3 h-3" />
              {children.length}
            </span>
          )}
        </div>
      </div>
      
      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Vertical line connector */}
          <div
            className="absolute left-0 top-0 bottom-2 w-px bg-border"
            style={{ marginLeft: `${level * 16 + 18}px` }}
          />
          {children.map((child) => (
            <TreeNode
              key={child.id}
              brain={child}
              level={level + 1}
              getChildBrains={getChildBrains}
              getNotesInBrain={getNotesInBrain}
              onSelectBrain={onSelectBrain}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const BrainTree = ({ brains, getChildBrains, getNotesInBrain, onSelectBrain }: BrainTreeProps) => {
  const rootBrains = brains.filter(b => !b.parent_brain_id);
  
  if (rootBrains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <BrainIcon className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Nenhum cérebro para exibir</p>
      </div>
    );
  }
  
  return (
    <div className="py-2">
      {rootBrains.map((brain) => (
        <TreeNode
          key={brain.id}
          brain={brain}
          level={0}
          getChildBrains={getChildBrains}
          getNotesInBrain={getNotesInBrain}
          onSelectBrain={onSelectBrain}
        />
      ))}
    </div>
  );
};

export default BrainTree;
