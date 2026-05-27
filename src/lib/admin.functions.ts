import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runScrape } from "@/lib/scraper.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const triggerScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const result = await runScrape();
    return result;
  });

export const listScrapeJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const limit = Math.min(100, Math.max(1, data.limit ?? 50));
    const { data: jobs, error } = await supabaseAdmin
      .from("scrape_jobs")
      .select("id, source_url, status, apps_found, apps_inserted, error, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return { jobs: jobs ?? [] };
  });
