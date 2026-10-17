import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Bambu" },
      { name: "description", content: "Entre ou crie sua conta no Bambu." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Entrar · Bambu" },
      { property: "og:description", content: "Entre ou crie sua conta no Bambu." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

const inputCls =
  "w-full rounded-2xl border border-input bg-card px-5 py-4 text-base outline-none transition-colors duration-500 placeholder:text-muted-foreground focus:border-sage";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user && navigate({ to: "/jornada", replace: true }));
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/jornada", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/jornada" },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/jornada", replace: true });
        else setMsg({ kind: "ok", text: "Enviamos um link de confirmação para o seu e-mail." });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMsg({ kind: "ok", text: "Se o e-mail existir, você receberá um link para redefinir a senha." });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setMsg({
        kind: "err",
        text: m.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : m.includes("already registered")
            ? "Este e-mail já tem uma conta."
            : m.includes("Password")
              ? "A senha precisa ter pelo menos 6 caracteres."
              : "Algo deu errado. Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Bem-vindo de volta" : mode === "signup" ? "Comece sua jornada" : "Esqueci minha senha";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-20 pb-safe">
      <div className="animate-rise">
        <img src="/icon-192.png" alt="" width={56} height={56} className="h-14 w-14 rounded-2xl" />
        <h1 className="mt-8 font-display text-4xl font-light">{title}</h1>
      </div>

      <form onSubmit={submit} className="mt-auto flex flex-col gap-3 pb-6 animate-fade-slow">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        {mode !== "forgot" && (
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        )}
        {msg && (
          <p className={cn("px-1 text-sm", msg.kind === "err" ? "text-destructive" : "text-sage")}>{msg.text}</p>
        )}
        <button
          disabled={busy}
          className="mt-2 rounded-full bg-primary py-4 text-base text-primary-foreground transition-opacity duration-500 disabled:opacity-60"
        >
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
        </button>

        <div className="mt-4 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => (setMode("forgot"), setMsg(null))}>Esqueci minha senha</button>
              <button type="button" onClick={() => (setMode("signup"), setMsg(null))}>
                Não tem conta? <span className="text-sage">Criar conta</span>
              </button>
            </>
          )}
          {mode !== "login" && (
            <button type="button" onClick={() => (setMode("login"), setMsg(null))}>
              Já tenho conta · <span className="text-sage">Entrar</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
