import { Link, useRouter } from "@tanstack/react-router";
import { Download, LogIn, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.invalidate();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
            <Download className="size-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Down<span className="text-primary">labs</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm text-muted-foreground sm:gap-4">
          <Link to="/" className="hidden transition-colors hover:text-foreground sm:inline">Apps</Link>
          {email ? (
            <>
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:text-foreground">
                <Shield className="size-3.5" /> Admin
              </Link>
              <button onClick={signOut} className="inline-flex items-center gap-1.5 text-xs hover:text-foreground">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90">
              <LogIn className="size-3.5" /> Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
