import "server-only";
import type { AnalysisRow, AssetRow, CertificateRequestRow, DealItemRow, DealRow, DocumentRow, FindingRow, PartyRow, TemplateItemRow } from "@/lib/db-types";
import { createClient } from "@/lib/supabase/server";

export type DealData = Awaited<ReturnType<typeof loadDeal>>;

/** Carrega tudo de que a tela (e o relatório) precisam. A RLS garante o acesso. */
export async function loadDeal(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("*").eq("id", id).maybeSingle<DealRow>();
  if (!deal) return null;

  const [parties, assets, items, templateItems, org, documents, analyses, findings, certRequests] = await Promise.all([
    supabase.from("parties").select("*").eq("deal_id", id).order("created_at").returns<PartyRow[]>(),
    supabase.from("assets").select("*").eq("deal_id", id).order("created_at").returns<AssetRow[]>(),
    supabase.from("deal_items").select("*").eq("deal_id", id).returns<DealItemRow[]>(),
    supabase.from("template_items").select("*").eq("template_id", deal.template_id ?? "").returns<TemplateItemRow[]>(),
    supabase.from("organizations").select("name").eq("id", deal.org_id).maybeSingle<{ name: string }>(),
    supabase.from("documents").select("*").eq("deal_id", id).order("created_at").returns<DocumentRow[]>(),
    supabase.from("document_analyses").select("*").eq("deal_id", id).order("created_at", { ascending: false }).returns<AnalysisRow[]>(),
    supabase.from("findings").select("*").eq("deal_id", id).order("created_at").returns<FindingRow[]>(),
    supabase.from("certificate_requests").select("*").eq("deal_id", id).order("created_at", { ascending: false }).returns<CertificateRequestRow[]>(),
  ]);

  // Última análise de cada documento.
  const latestAnalysis: Record<string, AnalysisRow> = {};
  for (const a of analyses.data ?? []) latestAnalysis[a.document_id] ??= a;

  return {
    deal,
    orgName: org.data?.name ?? "",
    parties: parties.data ?? [],
    assets: assets.data ?? [],
    items: items.data ?? [],
    templateItems: templateItems.data ?? [],
    documents: documents.data ?? [],
    latestAnalysis,
    findings: findings.data ?? [],
    certRequests: certRequests.data ?? [],
  };
}
