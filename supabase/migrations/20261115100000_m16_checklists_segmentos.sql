-- M16 — Checklists por segmento (MK-01 §3 "Cobertura por segmento").
--
-- Modelos INICIAIS, a validar com o jurídico da MK: checklist é política de
-- análise do escritório, não lista legal universal. Reaproveitam os itens das
-- partes (vendedor PF/PJ, comprador, procurador) e a matrícula/título do modelo
-- urbano (mesmos códigos, para a consulta online da matrícula continuar valendo).
--
-- Também: o modelo padrão de cada tipo de negócio passa a ser explícito
-- (is_default), para que um modelo novo não vire padrão sem querer.
-- Reversão: apagar os modelos novos (sem negócios usando) e voltar
-- deals_before_write da M1; drop da coluna is_default.

alter table public.checklist_templates add column is_default boolean not null default false;
update public.checklist_templates set is_default = true where code in ('IMV-CV-v1', 'TETTU-COTAS-v1');

create or replace function public.deals_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.org_id <> old.org_id or new.kind <> old.kind or new.template_id is distinct from old.template_id then
      raise exception 'organização, tipo e modelo do negócio não podem ser alterados' using errcode = '23514';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.template_id is null then
    select t.id into new.template_id
    from public.checklist_templates t
    where t.deal_kind = new.kind and t.active
    order by t.is_default desc, t.created_at desc
    limit 1;
  elsif not exists (
    select 1 from public.checklist_templates t where t.id = new.template_id and t.deal_kind = new.kind and t.active
  ) then
    raise exception 'modelo de checklist incompatível com o tipo do negócio' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Cria um modelo copiando itens de outro (exceto os códigos excluídos) e acrescenta itens próprios.
create function pg_temp.copy_template_items(p_from text, p_to uuid, p_exclude text[])
returns void language sql as $$
  insert into public.template_items (template_id, code, section, title, description, scope, applies_roles, validity_days, required, sort_order)
  select p_to, i.code, i.section, i.title, i.description, i.scope, i.applies_roles, i.validity_days, i.required, i.sort_order
  from public.template_items i join public.checklist_templates t on t.id = i.template_id
  where t.code = p_from and not (i.code = any (p_exclude));
$$;

-- Imóvel rural -----------------------------------------------------------------
with t as (
  insert into public.checklist_templates (code, name, deal_kind, description)
  values ('IMV-RURAL-v1', 'Compra e venda de imóvel rural', 'compra_venda_imovel',
    'Modelo inicial a validar com o jurídico da MK. Matrícula e certidões das partes, mais cadastro rural, ITR, CAR, georreferenciamento e restrições ambientais. Cadastro e certificação não equivalem automaticamente à prova de domínio.')
  returning id
)
select pg_temp.copy_template_items('IMV-CV-v1', (select id from t), array['IMV-02', 'IMV-04', 'IMV-05']);

insert into public.template_items (template_id, code, section, title, description, scope, applies_roles, validity_days, required, sort_order)
select t.id, v.code, 'Imóvel rural', v.title, v.description, 'imovel', null, v.validity_days, v.required, v.sort_order
from public.checklist_templates t, (values
  ('RUR-01', 'CCIR — Certificado de Cadastro de Imóvel Rural', 'CCIR do exercício vigente, emitido pelo INCRA, quitado.', null::int, true, 21),
  ('RUR-02', 'ITR — declarações e certidão de regularidade', 'Comprovação de entrega do ITR dos últimos 5 exercícios e certidão de regularidade fiscal do imóvel rural (Receita Federal).', 180, true, 22),
  ('RUR-03', 'CAR — recibo de inscrição no Cadastro Ambiental Rural', 'Recibo do CAR e situação da análise (pendências, reserva legal, APP).', null, true, 23),
  ('RUR-04', 'Georreferenciamento certificado (SIGEF/INCRA)', 'Certificação do georreferenciamento quando exigível pela área/ato; conferir sobreposições.', null, false, 24),
  ('RUR-05', 'Consulta de embargos e autuações ambientais', 'Consulta a embargos e autos de infração ambientais (federal e estadual) sobre o imóvel e os vendedores.', 30, true, 25),
  ('RUR-06', 'Declaração sobre posse, arrendamento e parcerias', 'Declaração do vendedor sobre ocupantes, arrendamentos, parcerias rurais e conflitos possessórios.', null, true, 26)
) as v(code, title, description, validity_days, required, sort_order)
where t.code = 'IMV-RURAL-v1';

-- Terreno / lote ---------------------------------------------------------------
with t as (
  insert into public.checklist_templates (code, name, deal_kind, description)
  values ('IMV-TERRENO-v1', 'Compra e venda de terreno ou lote', 'compra_venda_imovel',
    'Modelo inicial a validar com o jurídico da MK. Não deduzir edificabilidade apenas pela descrição comercial.')
  returning id
)
select pg_temp.copy_template_items('IMV-CV-v1', (select id from t), array['IMV-04', 'IMV-05']);

insert into public.template_items (template_id, code, section, title, description, scope, applies_roles, validity_days, required, sort_order)
select t.id, v.code, 'Terreno ou lote', v.title, v.description, 'imovel', null, v.validity_days, v.required, v.sort_order
from public.checklist_templates t, (values
  ('TER-01', 'Certidão de uso e ocupação do solo (zoneamento)', 'Certidão ou consulta prévia da prefeitura sobre zoneamento, usos permitidos e parâmetros construtivos.', null::int, true, 61),
  ('TER-02', 'Registro do loteamento ou desmembramento', 'Quando o lote integrar loteamento: registro do loteamento e termo de verificação de obras, se houver.', null, false, 62),
  ('TER-03', 'Restrições ambientais e de preservação', 'Consulta sobre APP, áreas de risco, tombamento e restrições ambientais que limitem o uso.', null, true, 63),
  ('TER-04', 'Confrontações, acesso e infraestrutura', 'Conferência de medidas e confrontações com a matrícula, acesso por via pública e redes disponíveis.', null, false, 64)
) as v(code, title, description, validity_days, required, sort_order)
where t.code = 'IMV-TERRENO-v1';

-- Comercial ----------------------------------------------------------------------
with t as (
  insert into public.checklist_templates (code, name, deal_kind, description)
  values ('IMV-COMERCIAL-v1', 'Compra e venda de imóvel comercial', 'compra_venda_imovel',
    'Modelo inicial a validar com o jurídico da MK. Distinguir o imóvel do estabelecimento empresarial e das licenças do ocupante.')
  returning id
)
select pg_temp.copy_template_items('IMV-CV-v1', (select id from t), array[]::text[]);

insert into public.template_items (template_id, code, section, title, description, scope, applies_roles, validity_days, required, sort_order)
select t.id, v.code, 'Imóvel comercial', v.title, v.description, 'imovel', null, v.validity_days, v.required, v.sort_order
from public.checklist_templates t, (values
  ('COM-01', 'Contratos de locação vigentes', 'Contratos, aditivos, garantias, direito de preferência e cláusula de vigência registrada.', null::int, false, 71),
  ('COM-02', 'Regularidade junto ao Corpo de Bombeiros', 'Certificado de aprovação/vistoria vigente do imóvel.', null, true, 72),
  ('COM-03', 'Uso permitido e licenças do imóvel', 'Compatibilidade do uso com o zoneamento e licenças vinculadas ao imóvel (não às do ocupante).', null, true, 73)
) as v(code, title, description, validity_days, required, sort_order)
where t.code = 'IMV-COMERCIAL-v1';
