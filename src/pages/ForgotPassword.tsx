import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import AuthCard from "@/components/AuthCard";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Erro",
        description: "Digite seu email.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar email. Tente novamente.",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }
    
    setEmailSent(true);
    setIsLoading(false);
    toast({
      title: "Email enviado!",
      description: "Verifique sua caixa de entrada.",
    });
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="mb-8">
          <Logo size="md" />
        </div>

        <AuthCard
          title="Verifique seu email"
          description="Enviamos um link para redefinir sua senha"
          footer={
            <Link to="/" className="auth-link flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          }
        >
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <p className="text-center text-muted-foreground">
              Enviamos um email para <strong>{email}</strong> com um link para redefinir sua senha.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Não recebeu? Verifique a pasta de spam ou{" "}
              <button 
                onClick={() => setEmailSent(false)}
                className="text-primary hover:underline"
              >
                tente novamente
              </button>
            </p>
          </div>
        </AuthCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        <Logo size="md" />
        <p className="text-muted-foreground text-center mt-2">Recuperar senha</p>
      </div>

      <AuthCard
        title="Esqueceu a senha?"
        description="Digite seu email para receber um link de recuperação"
        footer={
          <Link to="/" className="auth-link flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="auth-button w-full"
            disabled={isLoading}
          >
            {isLoading ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </form>
      </AuthCard>
    </div>
  );
};

export default ForgotPassword;
