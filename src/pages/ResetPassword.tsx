import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import AuthCard from "@/components/AuthCard";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, CheckCircle } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsValidSession(true);
      } else {
        toast({
          title: "Link inválido",
          description: "Este link expirou ou é inválido. Solicite um novo.",
          variant: "destructive"
        });
      }
      setChecking(false);
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    
    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar senha. Tente novamente.",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }
    
    setIsSuccess(true);
    setIsLoading(false);
    toast({
      title: "Senha atualizada!",
      description: "Sua senha foi alterada com sucesso.",
    });

    setTimeout(() => {
      navigate("/dashboard");
    }, 2000);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Verificando...</p>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="mb-8">
          <Logo size="md" />
        </div>

        <AuthCard
          title="Link inválido"
          description="Este link expirou ou é inválido"
        >
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-center text-muted-foreground">
              Solicite um novo link de recuperação de senha.
            </p>
            <Button 
              onClick={() => navigate("/forgot-password")}
              className="w-full"
            >
              Solicitar novo link
            </Button>
          </div>
        </AuthCard>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="mb-8">
          <Logo size="md" />
        </div>

        <AuthCard
          title="Senha atualizada!"
          description="Sua senha foi alterada com sucesso"
        >
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-center text-muted-foreground">
              Redirecionando para o dashboard...
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
        <p className="text-muted-foreground text-center mt-2">Nova senha</p>
      </div>

      <AuthCard
        title="Redefinir senha"
        description="Digite sua nova senha"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="auth-input"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="auth-button w-full"
            disabled={isLoading}
          >
            {isLoading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </AuthCard>
    </div>
  );
};

export default ResetPassword;
