import { createFileRoute } from "@tanstack/react-router";
import { runScrape, DEFAULT_SEEDS, safeEqual } from "@/lib/scraper.server";

function authorized(request: Request): boolean {
  const secret = process.env.SCRAPE_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return false;
  return safeEqual(token, secret);
}

export const Route = createFileRoute("/api/public/scrape")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { seeds?: string[] } = {};
        try {
          body = (await request.json()) as { seeds?: string[] };
        } catch {
          body = {};
        }
        // Cap seeds and require valid Uptodown URLs to prevent SSRF/abuse
        const seeds = (body.seeds && body.seeds.length ? body.seeds : DEFAULT_SEEDS)
          .filter((s) => typeof s === "string" && /^https:\/\/[a-z]{2}\.uptodown\.com\//i.test(s))
          .slice(0, 20);

        const result = await runScrape(seeds);
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(JSON.stringify({ hint: "POST with Authorization: Bearer <SCRAPE_SECRET>" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
