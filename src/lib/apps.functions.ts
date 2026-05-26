import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listApps = createServerFn({ method: "GET" })
  .inputValidator((data: { category?: string; search?: string; limit?: number } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("apps")
      .select("id, slug, name, publisher, category, icon_url, rating, downloads_count, version")
      .order("last_scraped_at", { ascending: false })
      .limit(data.limit ?? 60);

    if (data.category) q = q.eq("category", data.category);
    if (data.search) q = q.ilike("name", `%${data.search}%`);

    const { data: apps, error } = await q;
    if (error) return { apps: [], error: error.message };
    return { apps: apps ?? [], error: null };
  });

export const getApp = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { data: app, error } = await supabaseAdmin
      .from("apps")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) return { app: null, error: error.message };
    return { app, error: null };
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("apps")
    .select("category")
    .not("category", "is", null);
  if (error) return { categories: [] as string[] };
  const set = new Set<string>();
  (data ?? []).forEach((r: { category: string | null }) => r.category && set.add(r.category));
  return { categories: Array.from(set).sort() };
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin.from("apps").select("*", { count: "exact", head: true });
  const { data: lastJob } = await supabaseAdmin
    .from("scrape_jobs")
    .select("started_at, status, apps_inserted")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { totalApps: count ?? 0, lastJob };
});
