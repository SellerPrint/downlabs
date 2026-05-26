import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { AppCard } from "@/components/AppCard";
import { listApps, listCategories, getStats } from "@/lib/apps.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Downlabs — Discover & download Android apps" },
      { name: "description", content: "Downlabs is a curated catalog of Android apps continuously aggregated from Uptodown. Browse, search, and download." },
      { property: "og:title", content: "Downlabs — Android apps catalog" },
      { property: "og:description", content: "Browse and download thousands of Android apps." },
    ],
  }),
  component: Home,
});

function Home() {
  const fetchApps = useServerFn(listApps);
  const fetchCats = useServerFn(listCategories);
  const fetchStats = useServerFn(getStats);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const appsQ = useQuery({
    queryKey: ["apps", category, search],
    queryFn: () => fetchApps({ data: { category: category ?? undefined, search: search || undefined } }),
  });
  const catsQ = useQuery({ queryKey: ["cats"], queryFn: () => fetchCats() });
  const statsQ = useQuery({ queryKey: ["stats"], queryFn: () => fetchStats(), refetchInterval: 30000 });

  const apps = appsQ.data?.apps ?? [];
  const cats = catsQ.data?.categories ?? [];
  const empty = !appsQ.isLoading && apps.length === 0;

  const lastSync = useMemo(() => {
    const j = statsQ.data?.lastJob;
    if (!j) return null;
    return new Date(j.started_at).toLocaleString();
  }, [statsQ.data]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-soft)]">
              <Sparkles className="size-3.5 text-primary" />
              {statsQ.data?.totalApps ?? 0} apps synced{lastSync ? ` · last update ${lastSync}` : ""}
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Discover Android apps,{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                effortlessly
              </span>
            </h1>
            <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
              Downlabs aggregates a clean, searchable catalog of Android apps — continuously refreshed in the background.
            </p>

            <div className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-card)]">
              <Search className="ml-2 size-5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search apps..."
                className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {cats.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              onClick={() => setCategory(null)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                category === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {appsQ.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : empty ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <h3 className="text-lg font-semibold">No apps yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The scraper hasn't run yet. Trigger it to populate the catalog.
            </p>
            <TriggerScrapeButton />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-16 border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>Downlabs · Data aggregated from public sources · For demo purposes only.</p>
      </footer>
    </div>
  );
}

function TriggerScrapeButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-6">
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setMsg(null);
          try {
            const res = await fetch("/api/public/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            const j = await res.json();
            setMsg(j.ok ? `Done. Inserted ${j.inserted} apps.` : `Error: ${j.error}`);
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Failed");
          } finally {
            setLoading(false);
          }
        }}
        className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Scraping..." : "Run scraper now"}
      </button>
      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
