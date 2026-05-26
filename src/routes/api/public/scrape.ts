import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

// Default category landing pages on Uptodown (English) to harvest app URLs from.
const DEFAULT_SEEDS = [
  "https://en.uptodown.com/android",
  "https://en.uptodown.com/android/communication",
  "https://en.uptodown.com/android/games",
  "https://en.uptodown.com/android/social",
  "https://en.uptodown.com/android/tools",
  "https://en.uptodown.com/android/multimedia",
  "https://en.uptodown.com/android/productivity",
];

type ScrapeResult = {
  markdown?: string;
  html?: string;
  links?: string[];
  json?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

async function firecrawlScrape(url: string, body: Record<string, unknown>): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ url, ...body }),
  });
  const json = (await res.json()) as { data?: ScrapeResult; success?: boolean; error?: string };
  if (!res.ok || !json.success) throw new Error(json.error || `Firecrawl ${res.status}`);
  return json.data ?? {};
}

function slugFromUrl(u: string): string | null {
  // https://<name>.en.uptodown.com/android  -> <name>
  const m = u.match(/^https?:\/\/([a-z0-9-]+)\.en\.uptodown\.com\/android/i);
  return m ? m[1].toLowerCase() : null;
}

function deriveCategoryFromSeed(seed: string): string {
  const m = seed.match(/\/android\/([a-z-]+)/i);
  return m ? m[1] : "android";
}

async function harvestSeed(seedUrl: string) {
  const category = deriveCategoryFromSeed(seedUrl);
  const page = await firecrawlScrape(seedUrl, { formats: ["links"], onlyMainContent: true });
  const links = (page.links ?? []).filter((l) => /\.en\.uptodown\.com\/android\/?$/i.test(l));
  const unique = Array.from(new Set(links)).slice(0, 12); // cap per seed
  let inserted = 0;

  for (const appUrl of unique) {
    const slug = slugFromUrl(appUrl);
    if (!slug) continue;

    // Skip if already scraped within 24h
    const { data: existing } = await supabaseAdmin
      .from("apps")
      .select("id, last_scraped_at")
      .eq("slug", slug)
      .maybeSingle();
    if (existing && existing.last_scraped_at) {
      const age = Date.now() - new Date(existing.last_scraped_at).getTime();
      if (age < 24 * 3600 * 1000) continue;
    }

    try {
      const detail = await firecrawlScrape(appUrl, {
        formats: [
          {
            type: "json",
            prompt:
              "Extract app metadata. Return strict JSON: { name, publisher, description, version, rating (0-5 number), downloads_count (string like '1M'), size, icon_url (absolute), screenshots (array of absolute image URLs, max 5) }",
          },
        ],
        onlyMainContent: true,
      });
      const j = (detail.json ?? {}) as Record<string, unknown>;
      const row = {
        slug,
        name: String(j.name ?? slug),
        publisher: j.publisher ? String(j.publisher) : null,
        category,
        description: j.description ? String(j.description) : null,
        icon_url: j.icon_url ? String(j.icon_url) : null,
        version: j.version ? String(j.version) : null,
        rating: typeof j.rating === "number" ? Math.min(5, Math.max(0, j.rating)) : null,
        downloads_count: j.downloads_count ? String(j.downloads_count) : null,
        size: j.size ? String(j.size) : null,
        uptodown_url: appUrl,
        screenshots: Array.isArray(j.screenshots) ? j.screenshots.slice(0, 5) : [],
        last_scraped_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin
        .from("apps")
        .upsert(row, { onConflict: "uptodown_url" });
      if (!error) inserted += 1;
    } catch (e) {
      console.error(`[scrape] ${appUrl}`, e);
    }
  }
  return { found: unique.length, inserted };
}

export const Route = createFileRoute("/api/public/scrape")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { seeds?: string[] } = {};
        try {
          body = (await request.json()) as { seeds?: string[] };
        } catch {
          body = {};
        }
        const seeds = body.seeds && body.seeds.length ? body.seeds : DEFAULT_SEEDS;

        const { data: job } = await supabaseAdmin
          .from("scrape_jobs")
          .insert({ source_url: seeds.join(","), status: "running" })
          .select("id")
          .single();

        let totalFound = 0;
        let totalInserted = 0;
        let errorMsg: string | null = null;

        try {
          for (const seed of seeds) {
            const { found, inserted } = await harvestSeed(seed);
            totalFound += found;
            totalInserted += inserted;
          }
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : String(e);
        }

        if (job) {
          await supabaseAdmin
            .from("scrape_jobs")
            .update({
              status: errorMsg ? "failed" : "completed",
              apps_found: totalFound,
              apps_inserted: totalInserted,
              error: errorMsg,
              finished_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }

        return new Response(
          JSON.stringify({ ok: !errorMsg, found: totalFound, inserted: totalInserted, error: errorMsg }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
      GET: async () => {
        // Allow GET for easy cron triggering
        return new Response(
          JSON.stringify({ hint: "POST to trigger scraping. Body: { seeds?: string[] }" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
