import "server-only";
import type { AssetRow, DealItemRow, PartyRow, TemplateItemRow } from "@/lib/db-types";
import type { createClient } from "@/lib/supabase/server";
import type { CertidaoSubject } from "./providers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Monta o "sujeito" da certidão (pessoa ou imóvel) a partir do item do checklist. */
export async function loadSubject(supabase: Supabase, dealId: string, itemId: string): Promise<CertidaoSubject | null> {
  const { data: it } = await supabase.from("deal_items").select("*").eq("id", itemId).eq("deal_id", dealId).maybeSingle<DealItemRow>();
  if (!it) return null;
  const { data: t } = await supabase.from("template_items").select("*").eq("id", it.template_item_id).maybeSingle<TemplateItemRow>();
  if (!t) return null;
  const subject: CertidaoSubject = { itemCode: t.code, itemTitle: t.title };
  if (it.party_id) {
    const { data: p } = await supabase.from("parties").select("*").eq("id", it.party_id).maybeSingle<PartyRow>();
    if (p) subject.party = { name: p.name, document: p.document };
  }
  if (it.asset_id) {
    const { data: a } = await supabase.from("assets").select("*").eq("id", it.asset_id).maybeSingle<AssetRow>();
    if (a) {
      subject.asset = { description: a.description, matricula: a.matricula, cartorio: a.cartorio, cns: a.cns, municipio: a.municipio, uf: a.uf };
    }
  }
  return subject;
}

/** Versão síncrona para a tela (com as linhas já carregadas). */
export function subjectFromRows(
  item: Pick<DealItemRow, "party_id" | "asset_id">,
  tpl: Pick<TemplateItemRow, "code" | "title">,
  parties: PartyRow[],
  assets: AssetRow[],
): CertidaoSubject {
  const p = item.party_id ? parties.find((x) => x.id === item.party_id) : undefined;
  const a = item.asset_id ? assets.find((x) => x.id === item.asset_id) : undefined;
  return {
    itemCode: tpl.code,
    itemTitle: tpl.title,
    party: p ? { name: p.name, document: p.document } : undefined,
    asset: a ? { description: a.description, matricula: a.matricula, cartorio: a.cartorio, cns: a.cns, municipio: a.municipio, uf: a.uf } : undefined,
  };
}
