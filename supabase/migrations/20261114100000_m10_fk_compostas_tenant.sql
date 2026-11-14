-- M10 — Isolamento garantido pelo banco (MK-01 §5/§6: "FKs compostas impedem
-- relacionamentos entre tenants mesmo por erro da aplicação").
--
-- Até aqui o org_id das tabelas filhas era herdado do negócio por trigger
-- (inherit_deal_org). Agora, além disso, a chave estrangeira composta
-- (org_id, deal_id) → deals(org_id, id) torna impossível gravar uma linha
-- cujo org_id não seja o do negócio, mesmo com o trigger desligado ou por um
-- papel com permissão de escrita direta.
--
-- Aditiva: não muda colunas nem dados. Os dados atuais já são consistentes
-- (o trigger garante isso desde a M1); se não fossem, a criação da FK falharia
-- e nada seria alterado (transação única).
-- Reversão: drop das constraints *_org_deal_fkey e deals_org_id_id_key.

alter table public.deals add constraint deals_org_id_id_key unique (org_id, id);

alter table public.parties
  add constraint parties_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
alter table public.assets
  add constraint assets_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
alter table public.deal_items
  add constraint deal_items_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
alter table public.documents
  add constraint documents_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
alter table public.document_analyses
  add constraint document_analyses_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
alter table public.findings
  add constraint findings_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
alter table public.deal_opinions
  add constraint deal_opinions_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
alter table public.certificate_requests
  add constraint certificate_requests_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
alter table public.report_versions
  add constraint report_versions_org_deal_fkey foreign key (org_id, deal_id) references public.deals (org_id, id) on delete cascade;
