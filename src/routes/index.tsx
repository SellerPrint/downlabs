import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { AppCard } from "@/components/AppCard";
import { listApps, listCategories, getStats, type SortKey } from "@/lib/apps.functions";

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

const PAGE_SIZE = 24;

function Home() {
  const fetchApps = useServerFn(listApps);
  const fetchCats = useServerFn(listCategories);
  const fetchStats = useServerFn(getStats);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [version, setVersion] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);

  const resetPage = () => setPage(1);

  const appsQ = useQuery({
    queryKey: ["apps", category, search, minRating, version, sort, page],
    queryFn: () =>
      fetchApps({
        data: {
          category: category ?? undefined,
          search: search || undefined,
          minRating: minRating || undefined,
          version: version || undefined,
          sort,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });
  const catsQ = useQuery({ queryKey: ["cats"], queryFn: () => fetchCats() });
  const statsQ = useQuery({ queryKey: ["stats"], queryFn: () => fetchStats(), refetchInterval: 30000 });

  const apps = appsQ.data?.apps ?? [];
  const total = appsQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cats = catsQ.data?.categories ?? [];
  const empty = !appsQ.isLoading && apps.length === 0;

  const lastSync = useMemo(() => {
    const j = statsQ.data?.lastJob;
    return j ? new Date(j.started_at).toLocaleString() : null;
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
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                placeholder="Search apps..."
                className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {cats.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip active={category === null} onClick={() => { setCategory(null); resetPage(); }}>All</FilterChip>
            {cats.map((c) => (
              <FilterChip key={c} active={category === c} onClick={() => { setCategory(c); resetPage(); }}>
                <span className="capitalize">{c}</span>
              </FilterChip>
            ))}
          </div>
        )}

        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Min rating
            <select
              value={minRating}
              onChange={(e) => { setMinRating(Number(e.target.value)); resetPage(); }}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value={0}>Any</option>
              <option value={3}>3★+</option>
              <option value={4}>4★+</option>
              <option value={4.5}>4.5★+</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Version
            <input
              value={version}
              onChange={(e) => { setVersion(e.target.value); resetPage(); }}
              placeholder="e.g. 2.1"
              className="h-8 w-24 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
            />
          </label>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); resetPage(); }}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="recent">Most recent</option>
              <option value="top">Top rated</option>
              <option value="downloads">Most downloaded</option>
            </select>
          </label>
        </div>

        {appsQ.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : empty ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <h3 className="text-lg font-semibold">No apps match your filters</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try clearing filters, or wait for the next background sync.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {apps.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Page {page} of {pageCount} · {total} apps
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs hover:bg-accent disabled:opacity-40"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-16 border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>Downlabs · Data aggregated from public sources · For demo purposes only.</p>
      </footer>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
