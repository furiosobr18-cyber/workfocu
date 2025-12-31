import { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

const AuthCard = ({ title, description, children, footer }: AuthCardProps) => {
  return (
    <div className="auth-card w-full max-w-md p-8 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      
      {children}
      
      {footer && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
};

export default AuthCard;
