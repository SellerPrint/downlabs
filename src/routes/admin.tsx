import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, RefreshCw, ShieldAlert, CheckCircle2, XCircle, Clock, Upload, Plus } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin, listScrapeJobs, triggerScrape, createApp } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Downlabs" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [runLog, setRunLog] = useState<string | null>(null);

  const fetchIsAdmin = useServerFn(checkIsAdmin);
  const fetchJobs = useServerFn(listScrapeJobs);
  const runScrapeFn = useServerFn(triggerScrape);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/login" });
      else setAuthed(true);
    });
  }, [navigate]);

  const adminQ = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => fetchIsAdmin(),
    enabled: authed === true,
  });

  const jobsQ = useQuery({
    queryKey: ["scrapeJobs"],
    queryFn: () => fetchJobs({ data: { limit: 50 } }),
    enabled: adminQ.data?.isAdmin === true,
    refetchInterval: 10000,
  });

  const runMut = useMutation({
    mutationFn: () => runScrapeFn(),
    onSuccess: (res) => {
      setRunLog(`✓ Done — found ${res.found}, inserted ${res.inserted}${res.error ? ` (error: ${res.error})` : ""}`);
      qc.invalidateQueries({ queryKey: ["scrapeJobs"] });
      qc.invalidateQueries({ queryKey: ["apps"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => setRunLog(`✗ ${e instanceof Error ? e.message : "Failed"}`),
  });

  if (authed === null) return <PageShell><p className="text-sm text-muted-foreground">Loading…</p></PageShell>;

  if (adminQ.isLoading) return <PageShell><p className="text-sm text-muted-foreground">Checking permissions…</p></PageShell>;

  if (!adminQ.data?.isAdmin) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Admin access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account doesn't have the admin role. Ask an administrator to grant it.
          </p>
        </div>
      </PageShell>
    );
  }

  const jobs = jobsQ.data?.jobs ?? [];
  const lastJob = jobs[0];

  return (
    <PageShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last sync: {lastJob ? new Date(lastJob.started_at).toLocaleString() : "never"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => jobsQ.refetch()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:bg-accent"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
          <button
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Play className="size-4" /> {runMut.isPending ? "Running…" : "Run scraper"}
          </button>
        </div>
      </div>

      {runLog && (
        <pre className="mb-6 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
          {runLog}
        </pre>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Finished</th>
              <th className="px-4 py-3">Found</th>
              <th className="px-4 py-3">Inserted</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No jobs yet.</td></tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(j.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.finished_at ? new Date(j.finished_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{j.apps_found ?? 0}</td>
                  <td className="px-4 py-3 tabular-nums">{j.apps_inserted ?? 0}</td>
                  <td className="px-4 py-3 max-w-[16rem] truncate text-destructive" title={j.error ?? ""}>{j.error ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: typeof Clock; cls: string }> = {
    completed: { icon: CheckCircle2, cls: "bg-green-500/10 text-green-700 dark:text-green-400" },
    failed: { icon: XCircle, cls: "bg-destructive/10 text-destructive" },
    running: { icon: Clock, cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    pending: { icon: Clock, cls: "bg-muted text-muted-foreground" },
  };
  const c = map[status] ?? map.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>
      <Icon className="size-3" /> {status}
    </span>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
