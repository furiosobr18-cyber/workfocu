import { Focus } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const Logo = ({ size = "md", showText = true }: LogoProps) => {
  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const textSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-primary text-primary-foreground p-3 rounded-xl">
        <Focus className={iconSizes[size]} strokeWidth={1.5} />
      </div>
      {showText && (
        <h1 className={`${textSizes[size]} font-semibold tracking-tight text-foreground`}>
          WorkFocus
        </h1>
      )}
    </div>
  );
};

export default Logo;
