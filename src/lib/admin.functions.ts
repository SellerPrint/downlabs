import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runScrape } from "@/lib/scraper.server";

const slugRe = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const tagRe = /^[a-zA-Z0-9 _-]+$/;

const createAppSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(64).regex(slugRe, "slug invalide"),
  uptodown_url: z.string().trim().url().max(500),
  publisher: z.string().trim().max(200).nullish(),
  category: z.string().trim().max(100).nullish(),
  description: z.string().trim().max(5000).nullish(),
  icon_url: z.string().trim().url().max(1000).nullish(),
  download_url: z.string().trim().url().max(1000).nullish(),
  version: z.string().trim().max(50).nullish(),
  size: z.string().trim().max(50).nullish(),
  platform: z.string().trim().max(20).nullish(),
  rating: z.number().min(0).max(5).nullish(),
  downloads_count: z.string().trim().max(50).nullish(),
  tags: z.array(z.string().trim().min(1).max(40).regex(tagRe)).max(20).optional(),
});

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

export const createApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createAppSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload = {
      ...data,
      tags: data.tags ?? [],
      platform: data.platform ?? "android",
      last_scraped_at: new Date().toISOString(),
    };
    const { data: app, error } = await supabaseAdmin
      .from("apps")
      .upsert(payload, { onConflict: "slug" })
      .select("id, slug, name")
      .single();
    if (error) throw new Error(error.message);
    return { app };
  });

export const deleteApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("apps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
