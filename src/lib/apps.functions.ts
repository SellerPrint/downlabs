import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SortKey = "recent" | "top" | "downloads";

export const listApps = createServerFn({ method: "GET" })
  .inputValidator((data: {
    category?: string;
    search?: string;
    minRating?: number;
    version?: string;
    sort?: SortKey;
    page?: number;
    pageSize?: number;
  } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, data.pageSize ?? 24));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = supabaseAdmin
      .from("apps")
      .select("id, slug, name, publisher, category, icon_url, rating, downloads_count, version", { count: "exact" });

    if (data.category) q = q.eq("category", data.category);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    if (typeof data.minRating === "number" && data.minRating > 0) q = q.gte("rating", data.minRating);
    if (data.version) q = q.ilike("version", `%${data.version}%`);

    const sort: SortKey = data.sort ?? "recent";
    if (sort === "top") q = q.order("rating", { ascending: false, nullsFirst: false });
    else if (sort === "downloads") q = q.order("downloads_count", { ascending: false, nullsFirst: false });
    else q = q.order("last_scraped_at", { ascending: false });

    q = q.range(from, to);

    const { data: apps, error, count } = await q;
    if (error) return { apps: [], total: 0, page, pageSize, error: error.message };
    return { apps: apps ?? [], total: count ?? 0, page, pageSize, error: null };
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
