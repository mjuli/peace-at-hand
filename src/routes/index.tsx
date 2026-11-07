import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bambu — Meditação que cresce com você" },
      { name: "description", content: "30 fases, de 1 a 30 minutos. Uma jornada de meditação progressiva." },
      { property: "og:title", content: "Bambu — Meditação que cresce com você" },
      { property: "og:description", content: "30 fases, de 1 a 30 minutos. Uma jornada de meditação progressiva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user && navigate({ to: "/jornada", replace: true }));
  }, [navigate]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-24 pb-safe">
      <div className="animate-rise">
        <img src="/icon-192.png?v=2" alt="" width={64} height={64} className="h-16 w-16 rounded-2xl" />
        <h1 className="mt-10 font-display text-6xl font-light leading-none">Bambu</h1>
        <p className="mt-6 max-w-xs text-base text-muted-foreground">
          30 fases, de 1 a 30 minutos. Um gomo de cada vez.
        </p>
      </div>
      <Link
        to="/auth"
        className="mt-auto mb-6 rounded-full bg-primary py-4 text-center text-base text-primary-foreground animate-fade-slow"
      >
        Começar
      </Link>
    </div>
  );
}
