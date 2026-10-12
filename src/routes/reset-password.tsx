import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha · Bambu" },
      { name: "description", content: "Defina uma nova senha para sua conta Bambu." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr("Não foi possível alterar a senha. O link pode ter expirado.");
    navigate({ to: "/jornada", replace: true });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-20 pb-safe">
      <h1 className="font-display text-4xl font-light animate-rise">Nova senha</h1>
      <form onSubmit={submit} className="mt-auto flex flex-col gap-3 pb-6">
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Nova senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border border-input bg-card px-5 py-4 text-base outline-none focus:border-sage"
        />
        {err && <p className="px-1 text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="mt-2 rounded-full bg-primary py-4 text-base text-primary-foreground disabled:opacity-60">
          {busy ? "Aguarde…" : "Salvar senha"}
        </button>
      </form>
    </div>
  );
}
