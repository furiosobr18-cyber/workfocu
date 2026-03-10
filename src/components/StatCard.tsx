import { memo } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  valueColor?: "default" | "success";
}

const StatCard = memo(({ label, value, icon: Icon, valueColor = "default" }: StatCardProps) => {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <span 
        className={cn(
          "text-3xl font-semibold",
          valueColor === "success" ? "text-success" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
});

StatCard.displayName = "StatCard";

export default StatCard;
