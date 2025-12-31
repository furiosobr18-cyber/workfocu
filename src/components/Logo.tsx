import logoIcon from "@/assets/logo-icon.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const Logo = ({ size = "md", showText = true }: LogoProps) => {
  const iconSizes = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-16 h-16",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <img 
        src={logoIcon} 
        alt="Foco no Trabalho" 
        className={`${iconSizes[size]} rounded-xl`}
      />
      {showText && (
        <h1 className={`${textSizes[size]} font-semibold tracking-tight text-foreground`}>
          Foco no Trabalho
        </h1>
      )}
    </div>
  );
};

export default Logo;
