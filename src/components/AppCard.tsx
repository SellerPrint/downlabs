import { Link } from "@tanstack/react-router";
import { Star, Download } from "lucide-react";

type Props = {
  app: {
    slug: string;
    name: string;
    publisher?: string | null;
    category?: string | null;
    icon_url?: string | null;
    rating?: number | null;
    downloads_count?: string | null;
  };
};

export function AppCard({ app }: Props) {
  return (
    <Link
      to="/apps/$slug"
      params={{ slug: app.slug }}
      className="group relative flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 border border-border/60"
    >
      <div className="flex items-center gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
          {app.icon_url ? (
            <img src={app.icon_url} alt={app.name} className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex size-full items-center justify-center text-lg font-semibold text-muted-foreground">
              {app.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{app.name}</h3>
          {app.publisher && (
            <p className="truncate text-xs text-muted-foreground">{app.publisher}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            {app.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 fill-primary text-primary" />
                {Number(app.rating).toFixed(1)}
              </span>
            )}
            {app.downloads_count && (
              <span className="inline-flex items-center gap-1">
                <Download className="size-3" />
                {app.downloads_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
