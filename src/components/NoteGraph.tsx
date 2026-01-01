import { useRef, useEffect, useState } from "react";

interface Note {
  id: string;
  title: string;
  color: string | null;
}

interface NoteLink {
  id: string;
  source_note_id: string;
  target_note_id: string;
}

interface GraphNode {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface NoteGraphProps {
  notes: Note[];
  links: NoteLink[];
  onSelectNote: (note: Note) => void;
  selectedNoteId?: string;
}

const COLOR_MAP: Record<string, string> = {
  default: '#888888',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  orange: '#f97316',
  pink: '#ec4899',
};

const NoteGraph = ({ notes, links, onSelectNote, selectedNoteId }: NoteGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animationRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  // Initialize nodes
  useEffect(() => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
    
    nodesRef.current = notes.map((note, i) => {
      const angle = (2 * Math.PI * i) / notes.length;
      const existingNode = nodesRef.current.find(n => n.id === note.id);
      
      return {
        id: note.id,
        title: note.title,
        color: note.color || 'default',
        x: existingNode?.x ?? centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 50,
        y: existingNode?.y ?? centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
      };
    });
  }, [notes, dimensions]);

  // Update dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Force simulation and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const simulate = () => {
      const nodes = nodesRef.current;
      
      // Apply forces
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === draggedNode) continue;
        
        // Center gravity
        const dx = dimensions.width / 2 - nodes[i].x;
        const dy = dimensions.height / 2 - nodes[i].y;
        nodes[i].vx += dx * 0.0005;
        nodes[i].vy += dy * 0.0005;
        
        // Repulsion from other nodes
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);
          nodes[i].vx += (dx / dist) * force;
          nodes[i].vy += (dy / dist) * force;
        }
        
        // Attraction along links
        for (const link of links) {
          const isSource = link.source_note_id === nodes[i].id;
          const isTarget = link.target_note_id === nodes[i].id;
          
          if (isSource || isTarget) {
            const otherId = isSource ? link.target_note_id : link.source_note_id;
            const other = nodes.find(n => n.id === otherId);
            if (other) {
              const dx = other.x - nodes[i].x;
              const dy = other.y - nodes[i].y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const targetDist = 150;
              const force = (dist - targetDist) * 0.01;
              nodes[i].vx += (dx / dist) * force;
              nodes[i].vy += (dy / dist) * force;
            }
          }
        }
        
        // Apply velocity with damping
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;
        nodes[i].vx *= 0.9;
        nodes[i].vy *= 0.9;
        
        // Boundary constraints
        const padding = 40;
        nodes[i].x = Math.max(padding, Math.min(dimensions.width - padding, nodes[i].x));
        nodes[i].y = Math.max(padding, Math.min(dimensions.height - padding, nodes[i].y));
      }
      
      // Render
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      
      // Draw links as dotted lines
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]); // Dotted line pattern
      for (const link of links) {
        const source = nodes.find(n => n.id === link.source_note_id);
        const target = nodes.find(n => n.id === link.target_note_id);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]); // Reset to solid line for nodes
      
      // Draw nodes
      for (const node of nodes) {
        const isSelected = node.id === selectedNoteId;
        const isHovered = node.id === hoveredNode;
        const radius = isSelected ? 20 : isHovered ? 18 : 15;
        
        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = COLOR_MAP[node.color] || COLOR_MAP.default;
        ctx.fill();
        
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        
        // Node label
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = node.title.length > 15 ? node.title.slice(0, 12) + '...' : node.title;
        ctx.fillText(label, node.x, node.y + radius + 5);
      }
      
      animationRef.current = requestAnimationFrame(simulate);
    };
    
    simulate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [links, dimensions, selectedNoteId, hoveredNode, draggedNode]);

  const getNodeAtPosition = (x: number, y: number): GraphNode | null => {
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        return node;
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (draggedNode) {
      const node = nodesRef.current.find(n => n.id === draggedNode);
      if (node) {
        node.x = x;
        node.y = y;
        node.vx = 0;
        node.vy = 0;
      }
    } else {
      const node = getNodeAtPosition(x, y);
      setHoveredNode(node?.id || null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = getNodeAtPosition(x, y);
    
    if (node) {
      setDraggedNode(node.id);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggedNode && !hoveredNode) {
      // Was a drag, not a click
    } else {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const node = getNodeAtPosition(x, y);
      
      if (node) {
        const note = notes.find(n => n.id === node.id);
        if (note) {
          onSelectNote(note);
        }
      }
    }
    
    setDraggedNode(null);
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[500px] bg-card rounded-xl border border-border overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredNode(null);
          setDraggedNode(null);
        }}
        className="cursor-pointer"
        style={{ cursor: draggedNode ? 'grabbing' : hoveredNode ? 'pointer' : 'default' }}
      />
    </div>
  );
};

export default NoteGraph;
