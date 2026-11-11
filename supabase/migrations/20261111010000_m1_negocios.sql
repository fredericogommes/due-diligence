-- M1 — Negócios, partes, bens e checklists.
--
-- Um negócio usa um modelo de checklist (template). Cada item do modelo tem um
-- "escopo": vale uma vez para o negócio, uma vez por parte PF/PJ (filtrando por
-- papel) ou uma vez por bem (imóvel/empresa). Os itens do negócio (deal_items)
-- são gerados automaticamente por triggers quando o negócio, as partes ou os
-- bens são criados ou alterados.

create type public.deal_kind as enum ('compra_venda_imovel', 'cessao_cotas');
create type public.deal_status as enum ('rascunho', 'em_analise', 'concluido', 'cancelado');
create type public.party_kind as enum ('pf', 'pj');
create type public.party_role as enum (
  'vendedor', 'comprador', 'conjuge', 'cedente', 'cessionario', 'socio', 'empresa_alvo', 'procurador', 'outro'
);
create type public.marital_status as enum ('solteiro', 'casado', 'uniao_estavel', 'divorciado', 'viuvo', 'separado');
create type public.property_regime as enum (
  'comunhao_parcial', 'comunhao_universal', 'separacao_total', 'separacao_obrigatoria', 'participacao_final_aquestos'
);
create type public.asset_kind as enum ('imovel', 'empresa');
create type public.item_scope as enum ('negocio', 'parte_pf', 'parte_pj', 'imovel', 'empresa');
create type public.item_status as enum ('faltante', 'parcial', 'completo', 'dispensado');

-- Modelos de checklist (globais, só leitura para usuários) --------------------
create table public.checklist_templates (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  deal_kind  public.deal_kind not null,
  description text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.template_items (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.checklist_templates (id) on delete cascade,
  code          text not null,
  section       text not null,
  title         text not null,
  description   text,
  scope         public.item_scope not null,
  applies_roles public.party_role[],          -- null = qualquer papel
  validity_days integer check (validity_days is null or validity_days > 0),
  required      boolean not null default true,
  sort_order    integer not null,
  unique (template_id, code)
);

-- Negócio ---------------------------------------------------------------------
create table public.deals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  template_id uuid references public.checklist_templates (id),
  kind        public.deal_kind not null,
  title       text not null check (char_length(btrim(title)) between 2 and 200),
  status      public.deal_status not null default 'rascunho',
  price       numeric(15, 2) check (price is null or price >= 0),
  notes       text,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index deals_org_id_idx on public.deals (org_id, created_at desc);

create table public.parties (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  deal_id          uuid not null references public.deals (id) on delete cascade,
  kind             public.party_kind not null,
  role             public.party_role not null,
  name             text not null check (char_length(btrim(name)) between 2 and 200),
  document         text check (document is null or document ~ '^[0-9]{11}$|^[0-9]{14}$'),
  marital_status   public.marital_status,
  property_regime  public.property_regime,
  notes            text,
  created_at       timestamptz not null default now(),
  check (kind = 'pf' or (marital_status is null and property_regime is null)),
  check (document is null or (kind = 'pf') = (char_length(document) = 11))
);
create index parties_deal_id_idx on public.parties (deal_id);

create table public.assets (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  deal_id        uuid not null references public.deals (id) on delete cascade,
  kind           public.asset_kind not null,
  description    text not null check (char_length(btrim(description)) between 2 and 300),
  -- imóvel
  matricula      text,
  cartorio       text,
  cns            text check (cns is null or cns ~ '^[0-9]{6}$'),
  inscricao_iptu text,
  address        text,
  municipio      text,
  uf             char(2) check (uf is null or uf ~ '^[A-Z]{2}$'),
  -- empresa
  cnpj           text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  created_at     timestamptz not null default now(),
  check (kind = 'empresa' or cnpj is null),
  check (kind = 'imovel' or (matricula is null and cartorio is null and cns is null and inscricao_iptu is null))
);
create index assets_deal_id_idx on public.assets (deal_id);

create table public.deal_items (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  deal_id          uuid not null references public.deals (id) on delete cascade,
  template_item_id uuid not null references public.template_items (id),
  party_id         uuid references public.parties (id) on delete cascade,
  asset_id         uuid references public.assets (id) on delete cascade,
  status           public.item_status not null default 'faltante',
  notes            text,
  updated_at       timestamptz not null default now(),
  unique nulls not distinct (deal_id, template_item_id, party_id, asset_id)
);
create index deal_items_deal_id_idx on public.deal_items (deal_id);

-- org_id das tabelas filhas sempre vem do negócio (não confia no cliente) ----
create function public.inherit_deal_org()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select d.org_id into new.org_id from public.deals d where d.id = new.deal_id;
  if new.org_id is null then
    raise exception 'negócio inexistente' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger parties_inherit_org before insert or update of deal_id on public.parties
  for each row execute function public.inherit_deal_org();
create trigger assets_inherit_org before insert or update of deal_id on public.assets
  for each row execute function public.inherit_deal_org();
create trigger deal_items_inherit_org before insert or update of deal_id on public.deal_items
  for each row execute function public.inherit_deal_org();

-- Negócio: escolhe o modelo ativo do tipo, ou confere o informado; trava troca.
create function public.deals_before_write()
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
    order by t.created_at desc
    limit 1;
  elsif not exists (
    select 1 from public.checklist_templates t where t.id = new.template_id and t.deal_kind = new.kind
  ) then
    raise exception 'modelo de checklist incompatível com o tipo do negócio' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger deals_before_write before insert or update on public.deals
  for each row execute function public.deals_before_write();

-- Geração dos itens do checklist ----------------------------------------------
-- Cria os itens que faltam para o negócio. Idempotente.
create function public.sync_deal_items(p_deal uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.deal_items (org_id, deal_id, template_item_id, party_id, asset_id)
  select d.org_id, d.id, ti.id, s.party_id, s.asset_id
  from public.deals d
  join public.template_items ti on ti.template_id = d.template_id
  cross join lateral (
    select null::uuid as party_id, null::uuid as asset_id
    where ti.scope = 'negocio'
    union all
    select p.id, null::uuid
    from public.parties p
    where p.deal_id = d.id
      and ((ti.scope = 'parte_pf' and p.kind = 'pf') or (ti.scope = 'parte_pj' and p.kind = 'pj'))
      and (ti.applies_roles is null or p.role = any (ti.applies_roles))
    union all
    select null::uuid, a.id
    from public.assets a
    where a.deal_id = d.id and a.kind::text = ti.scope::text
  ) s
  where d.id = p_deal
  on conflict (deal_id, template_item_id, party_id, asset_id) do nothing;
$$;

create function public.deals_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.sync_deal_items(new.id);
  return null;
end;
$$;

create trigger deals_after_insert after insert on public.deals
  for each row execute function public.deals_after_insert();

-- Parte criada ou com tipo/papel alterado: remove itens que deixaram de valer
-- para ela e cria os que passaram a valer.
create function public.parties_after_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.deal_items di
    using public.template_items ti
    where di.party_id = new.id
      and ti.id = di.template_item_id
      and not (
        ((ti.scope = 'parte_pf' and new.kind = 'pf') or (ti.scope = 'parte_pj' and new.kind = 'pj'))
        and (ti.applies_roles is null or new.role = any (ti.applies_roles))
      );
  end if;
  perform public.sync_deal_items(new.deal_id);
  return null;
end;
$$;

create trigger parties_after_write after insert or update of kind, role on public.parties
  for each row execute function public.parties_after_write();

create function public.assets_after_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.deal_items di
    using public.template_items ti
    where di.asset_id = new.id and ti.id = di.template_item_id and ti.scope::text <> new.kind::text;
  end if;
  perform public.sync_deal_items(new.deal_id);
  return null;
end;
$$;

create trigger assets_after_write after insert or update of kind on public.assets
  for each row execute function public.assets_after_write();

-- Item: só status e observação mudam; marca updated_at.
create function public.deal_items_before_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.deal_id <> old.deal_id or new.template_item_id <> old.template_item_id
     or new.party_id is distinct from old.party_id or new.asset_id is distinct from old.asset_id then
    raise exception 'apenas status e observação do item podem ser alterados' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger deal_items_before_update before update on public.deal_items
  for each row execute function public.deal_items_before_update();

-- Progresso do checklist por negócio (respeita a RLS de quem consulta).
create view public.deal_progress with (security_invoker = true) as
  select di.deal_id,
         count(*)::int                                        as total,
         count(*) filter (where di.status = 'completo')::int   as completos,
         count(*) filter (where di.status = 'parcial')::int    as parciais,
         count(*) filter (where di.status = 'faltante')::int   as faltantes,
         count(*) filter (where di.status = 'dispensado')::int as dispensados
  from public.deal_items di
  group by di.deal_id;

revoke all on public.deal_progress from anon;
grant select on public.deal_progress to authenticated;

-- Permissões ------------------------------------------------------------------
revoke all on function public.inherit_deal_org() from public, anon, authenticated;
revoke all on function public.deals_before_write() from public, anon, authenticated;
revoke all on function public.sync_deal_items(uuid) from public, anon, authenticated;
revoke all on function public.deals_after_insert() from public, anon, authenticated;
revoke all on function public.parties_after_write() from public, anon, authenticated;
revoke all on function public.assets_after_write() from public, anon, authenticated;
revoke all on function public.deal_items_before_update() from public, anon, authenticated;

revoke all on public.checklist_templates, public.template_items, public.deals, public.parties,
  public.assets, public.deal_items from anon;
grant select on public.checklist_templates, public.template_items to authenticated;
grant select, insert, update, delete on public.deals, public.parties, public.assets to authenticated;
grant select, update on public.deal_items to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.checklist_templates enable row level security;
alter table public.template_items      enable row level security;
alter table public.deals               enable row level security;
alter table public.parties             enable row level security;
alter table public.assets              enable row level security;
alter table public.deal_items          enable row level security;

create policy templates_select on public.checklist_templates for select to authenticated using (true);
create policy template_items_select on public.template_items for select to authenticated using (true);

-- Negócios: qualquer membro cria, vê e edita; dono/admin apagam.
create policy deals_select on public.deals for select to authenticated using (public.is_org_member(org_id));
create policy deals_insert on public.deals for insert to authenticated with check (public.is_org_member(org_id));
create policy deals_update on public.deals for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy deals_delete on public.deals for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]));

-- Partes e bens: qualquer membro da organização do negócio.
create policy parties_all on public.parties for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy assets_all on public.assets for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- Itens: gerados pelo sistema; membros veem e atualizam status/observação.
create policy deal_items_select on public.deal_items for select to authenticated using (public.is_org_member(org_id));
create policy deal_items_update on public.deal_items for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
