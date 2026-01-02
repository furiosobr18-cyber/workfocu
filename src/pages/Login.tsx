import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import AuthCard from "@/components/AuthCard";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Separator } from "@/components/ui/separator";
import { loginSchema } from "@/lib/validation";
import { logSecurityEvent } from "@/lib/security";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate input
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // Check rate limit
    const { rate_limited } = await logSecurityEvent({
      event_type: 'login_attempt',
      email: validation.data.email,
    });

    if (rate_limited) {
      toast({
        title: "Muitas tentativas",
        description: "Aguarde um minuto antes de tentar novamente.",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }
    
    const { error } = await signIn(validation.data.email, validation.data.password);
    
    if (error) {
      await logSecurityEvent({
        event_type: 'login_failure',
        email: validation.data.email,
        metadata: { error_code: error.message }
      });

      let message = "Erro ao fazer login. Tente novamente.";
      
      if (error.message.includes("Invalid login credentials")) {
        message = "Email ou senha incorretos.";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Confirme seu email antes de fazer login.";
      }
      
      toast({
        title: "Erro no login",
        description: message,
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }

    await logSecurityEvent({
      event_type: 'login_success',
      email: validation.data.email,
    });
    
    toast({
      title: "Login bem-sucedido!",
      description: "Redirecionando para o dashboard...",
    });
    setIsLoading(false);
    navigate("/dashboard");
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    
    await logSecurityEvent({
      event_type: 'login_attempt',
      metadata: { provider: 'google' }
    });

    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer login com Google.",
        variant: "destructive"
      });
      setIsGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        <Logo size="md" />
        <p className="text-muted-foreground text-center mt-2">Entre na sua conta</p>
      </div>

      <AuthCard
        title="Conecte-se"
        description="Insira suas credenciais para acessar"
        footer={
          <p>
            Não tem uma conta?{" "}
            <Link to="/register" className="auth-link">
              Criar conta
            </Link>
          </p>
        }
      >
        <div className="space-y-4">
          <Button 
            type="button"
            variant="outline" 
            className="w-full flex items-center gap-2"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {isGoogleLoading ? "Conectando..." : "Continuar com Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? "border-destructive" : ""}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={errors.password ? "border-destructive" : ""}
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </AuthCard>
    </div>
  );
};

export default Login;
