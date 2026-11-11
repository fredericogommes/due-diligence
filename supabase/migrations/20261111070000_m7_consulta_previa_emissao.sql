-- M7 — Fluxo em duas fases:
--   1. consulta prévia: o sistema busca a VISUALIZAÇÃO das certidões (sem valor
--      oficial) para montar o relatório preliminar;
--   2. emissão: se o negócio avançar, pede as certidões OFICIAIS pela API e
--      repassa o boleto ao usuário; quando pago, a certidão chega e é anexada.

-- Documento obtido numa consulta prévia (visualização), não uma certidão oficial.
alter table public.documents add column is_preview boolean not null default false;

-- Pedido de emissão que espera o pagamento do boleto.
alter type public.certificate_request_status add value if not exists 'aguardando_pagamento' before 'concluido';

alter table public.certificate_requests
  add column mode text not null default 'emissao' check (mode in ('visualizacao', 'emissao')),
  add column boleto_url  text check (boleto_url is null or (boleto_url ~ '^https://' and char_length(boleto_url) <= 1000)),
  add column boleto_line text check (boleto_line is null or char_length(boleto_line) <= 200),
  add column boleto_due  date;

create index certificate_requests_item_idx on public.certificate_requests (deal_item_id, mode, created_at desc);

-- Apontamento gerado automaticamente por uma consulta (visualização positiva).
alter type public.finding_source add value if not exists 'consulta';
