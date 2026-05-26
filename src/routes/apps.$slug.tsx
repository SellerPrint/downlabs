import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Star, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { getApp } from "@/lib/apps.functions";

export const Route = createFileRoute("/apps/$slug")({
  component: AppDetail,
  notFoundComponent: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">App not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">← Back to catalog</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={reset} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Retry</button>
      </div>
    </div>
  ),
});

function AppDetail() {
  const { slug } = Route.useParams();
  const fetchApp = useServerFn(getApp);
  const { data, isLoading } = useQuery({
    queryKey: ["app", slug],
    queryFn: () => fetchApp({ data: { slug } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const app = data?.app;
  if (!app) throw notFound();

  const screenshots = Array.isArray(app.screenshots) ? (app.screenshots as string[]) : [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="size-24 shrink-0 overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
              {app.icon_url ? (
                <img src={app.icon_url} alt={app.name} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-3xl font-bold text-muted-foreground">
                  {app.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{app.name}</h1>
              {app.publisher && <p className="mt-1 text-sm text-muted-foreground">{app.publisher}</p>}
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {app.rating != null && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-4 fill-primary text-primary" /> {Number(app.rating).toFixed(1)}
                  </span>
                )}
                {app.downloads_count && (
                  <span className="inline-flex items-center gap-1">
                    <Download className="size-4" /> {app.downloads_count}
                  </span>
                )}
                {app.version && <span>v{app.version}</span>}
                {app.size && <span>{app.size}</span>}
                {app.category && <span className="capitalize">{app.category}</span>}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={app.uptodown_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity hover:opacity-90"
                >
                  <Download className="size-4" /> Download
                </a>
                <a
                  href={app.uptodown_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <ExternalLink className="size-4" /> View source
                </a>
              </div>
            </div>
          </div>

          {app.description && (
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">About</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{app.description}</p>
            </div>
          )}

          {screenshots.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Screenshots</h2>
              <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2">
                {screenshots.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`screenshot ${i + 1}`}
                    className="h-64 rounded-xl border border-border object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
