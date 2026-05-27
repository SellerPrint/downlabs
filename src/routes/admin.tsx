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

      <AddAppCard onCreated={() => { qc.invalidateQueries({ queryKey: ["apps"] }); qc.invalidateQueries({ queryKey: ["stats"] }); }} />

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scrape history</h2>


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

function AddAppCard({ onCreated }: { onCreated: () => void }) {
  const createAppFn = useServerFn(createApp);
  const [form, setForm] = useState({
    name: "", slug: "", uptodown_url: "", publisher: "", category: "",
    version: "", description: "", tags: "", icon_url: "", download_url: "",
  });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function uploadFile(file: File, folder: string, slug: string) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${folder}/${slug}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("app-files").upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type || undefined,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("app-files").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const slug = form.slug.trim().toLowerCase();
      let icon_url = form.icon_url.trim() || null;
      let download_url = form.download_url.trim() || null;
      if (iconFile) icon_url = await uploadFile(iconFile, "icons", slug);
      if (apkFile) download_url = await uploadFile(apkFile, "apks", slug);

      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        name: form.name.trim(),
        slug,
        uptodown_url: form.uptodown_url.trim(),
        publisher: form.publisher.trim() || null,
        category: form.category.trim() || null,
        version: form.version.trim() || null,
        description: form.description.trim() || null,
        icon_url, download_url, tags,
      };
      const res = await createAppFn({ data: payload });
      setMsg(`✓ App "${res.app?.name}" enregistrée`);
      setForm({ name: "", slug: "", uptodown_url: "", publisher: "", category: "", version: "", description: "", tags: "", icon_url: "", download_url: "" });
      setIconFile(null); setApkFile(null);
      onCreated();
    } catch (err) {
      setMsg(`✗ ${err instanceof Error ? err.message : "Échec"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Plus className="size-5" /> Ajouter une app manuellement
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Uploade l'icône et le fichier APK, ou colle simplement des URLs.
      </p>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Nom *"><input required value={form.name} onChange={set("name")} className={inputCls} /></Field>
        <Field label="Slug * (ex: whatsapp)"><input required value={form.slug} onChange={set("slug")} pattern="[a-z0-9][a-z0-9-]*" className={inputCls} /></Field>
        <Field label="URL Uptodown *" className="md:col-span-2">
          <input required type="url" value={form.uptodown_url} onChange={set("uptodown_url")} placeholder="https://...uptodown.com/android" className={inputCls} />
        </Field>
        <Field label="Éditeur"><input value={form.publisher} onChange={set("publisher")} className={inputCls} /></Field>
        <Field label="Catégorie"><input value={form.category} onChange={set("category")} className={inputCls} /></Field>
        <Field label="Version"><input value={form.version} onChange={set("version")} className={inputCls} /></Field>
        <Field label="Tags (séparés par virgule)"><input value={form.tags} onChange={set("tags")} placeholder="messaging, free, communication" className={inputCls} /></Field>
        <Field label="Description" className="md:col-span-2">
          <textarea value={form.description} onChange={set("description")} rows={3} className={`${inputCls} resize-y`} />
        </Field>

        <Field label="Icône (fichier image)">
          <input type="file" accept="image/*" onChange={(e) => setIconFile(e.target.files?.[0] ?? null)} className={fileCls} />
        </Field>
        <Field label="…ou URL d'icône"><input type="url" value={form.icon_url} onChange={set("icon_url")} className={inputCls} /></Field>

        <Field label="APK / Fichier (upload)">
          <input type="file" accept=".apk,.xapk,.zip,application/vnd.android.package-archive" onChange={(e) => setApkFile(e.target.files?.[0] ?? null)} className={fileCls} />
        </Field>
        <Field label="…ou URL de téléchargement"><input type="url" value={form.download_url} onChange={set("download_url")} className={inputCls} /></Field>

        <div className="md:col-span-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">{msg}</p>
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            <Upload className="size-4" /> {busy ? "Envoi…" : "Enregistrer l'app"}
          </button>
        </div>
      </form>
    </section>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
const fileCls = "block w-full text-sm text-muted-foreground file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium hover:file:bg-secondary/80";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
