import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import AuthCard from "@/components/AuthCard";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { registerSchema } from "@/lib/validation";
import { logSecurityEvent } from "@/lib/security";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { signUp, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate input
    const validation = registerSchema.safeParse({ name, email, password });
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
    
    const { error } = await signUp(validation.data.email, validation.data.password, validation.data.name);
    
    if (error) {
      let message = "Erro ao criar conta. Tente novamente.";
      
      if (error.message.includes("User already registered")) {
        message = "Este email já está cadastrado. Faça login.";
      } else if (error.message.includes("Invalid email")) {
        message = "Email inválido.";
      } else if (error.message.includes("Password")) {
        message = "A senha não atende aos requisitos de segurança.";
      }
      
      toast({
        title: "Erro no cadastro",
        description: message,
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }

    await logSecurityEvent({
      event_type: 'signup',
      email: validation.data.email,
    });
    
    toast({
      title: "Conta criada!",
      description: "Sua conta foi criada com sucesso.",
    });
    setIsLoading(false);
    navigate("/dashboard");
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
        <p className="text-muted-foreground text-center mt-2">Crie sua conta</p>
      </div>

      <AuthCard
        title="Criar conta"
        description="Preencha os dados para se cadastrar"
        footer={
          <p>
            Já tem uma conta?{" "}
            <Link to="/" className="auth-link">
              Fazer login
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={errors.name ? "border-destructive" : ""}
              autoComplete="name"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? "border-destructive" : ""}
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, com maiúscula, minúscula e número
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Criando..." : "Criar conta"}
          </Button>
        </form>
      </AuthCard>
    </div>
  );
};

export default Register;
