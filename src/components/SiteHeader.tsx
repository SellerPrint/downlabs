import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";

export function SiteHeader() {
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
        <nav className="hidden gap-6 text-sm text-muted-foreground sm:flex">
          <Link to="/" className="transition-colors hover:text-foreground">Apps</Link>
          <a href="https://en.uptodown.com" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            Source
          </a>
        </nav>
      </div>
    </header>
  );
}
