-- RAPAT Impact Tracker: reporting over existing anonymised/deduplicated interactions.
-- A recorded interaction represents one provider x browser key x UTC day (not a completed inquiry).
create index if not exists gig_interactions_created_at_idx on public.gig_interactions (created_at);
create index if not exists gig_interactions_provider_created_at_idx on public.gig_interactions (provider_id, created_at);

create or replace function public.gig_admin_impact(p_session_token text, p_days integer default 30)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_days is null or p_days not in (0,7,30,90) then
    raise exception 'Invalid reporting period' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.sessions s
    join public.superadmins a on a.id = s.subject_id
    where s.token::text = p_session_token
      and s.role = 'superadmin'
      and s.expires_at > now()
      and a.active = true
  ) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  with relevant as materialized (
    select i.provider_id, i.interaction_type, i.visitor_key,
           (i.created_at at time zone 'Asia/Kuala_Lumpur')::date as local_day
    from public.gig_interactions i
    where p_days = 0 or i.created_at >= now() - (p_days * interval '1 day')
  ),
  day_groups as (
    select local_day,
           count(*) filter (where interaction_type = 'view') as views,
           count(*) filter (where interaction_type = 'whatsapp') as whatsapp
    from relevant
    group by local_day
  ),
  provider_groups as (
    select p.id, p.display_name, p.state,
           count(*) filter (where r.interaction_type = 'whatsapp') as clicks,
           count(*) filter (where r.interaction_type = 'view') as views
    from relevant r
    join public.gig_providers p on p.id = r.provider_id
    group by p.id, p.display_name, p.state
    order by clicks desc, views desc, p.display_name
    limit 10
  ),
  state_groups as (
    select p.state as name, count(*) as clicks
    from relevant r
    join public.gig_providers p on p.id = r.provider_id
    where r.interaction_type = 'whatsapp'
    group by p.state
    order by clicks desc, name
    limit 10
  ),
  category_groups as (
    select coalesce(c.name, 'Lain-lain') as name, count(*) as clicks
    from relevant r
    join public.gig_providers p on p.id = r.provider_id
    left join public.gig_services sv on sv.id = p.main_service_id
    left join public.gig_categories c on c.id = sv.category_id
    where r.interaction_type = 'whatsapp'
    group by coalesce(c.name,'Lain-lain')
    order by clicks desc, name
    limit 10
  )
  select jsonb_build_object(
    'period_days', p_days,
    'views', (select count(*) from relevant where interaction_type = 'view'),
    'whatsapp_clicks', (select count(*) from relevant where interaction_type = 'whatsapp'),
    'providers_contacted', (select count(distinct provider_id) from relevant where interaction_type = 'whatsapp'),
    'approx_unique_browsers', (select count(distinct visitor_key) from relevant where interaction_type = 'whatsapp'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date',local_day,'views',views,'whatsapp',whatsapp) order by local_day) from day_groups), '[]'::jsonb),
    'top_providers', coalesce((select jsonb_agg(jsonb_build_object('provider_id',id,'name',display_name,'state',state,'clicks',clicks,'views',views) order by clicks desc, views desc) from provider_groups), '[]'::jsonb),
    'top_states', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',clicks) order by clicks desc) from state_groups), '[]'::jsonb),
    'top_categories', coalesce((select jsonb_agg(jsonb_build_object('name',name,'count',clicks) order by clicks desc) from category_groups), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- Existing superadmin session is checked inside the function on every request.
revoke all on function public.gig_admin_impact(text,integer) from public;
revoke all on function public.gig_admin_impact(text,integer) from anon, authenticated;
grant execute on function public.gig_admin_impact(text,integer) to anon, authenticated, service_role;

create or replace function public.gig_my_impact(p_days integer default 30)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_provider uuid;
  v_result jsonb;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (7,30,90) then
    raise exception 'Invalid reporting period' using errcode = '22023';
  end if;
  select p.id into v_provider
  from public.gig_providers p
  where p.user_id = v_user
  order by p.created_at desc
  limit 1;

  if v_provider is null then
    return jsonb_build_object('period_days',p_days,'views',0,'whatsapp_clicks',0,'daily','[]'::jsonb);
  end if;
  with relevant as materialized (
    select i.interaction_type,
           (i.created_at at time zone 'Asia/Kuala_Lumpur')::date as local_day
    from public.gig_interactions i
    where i.provider_id=v_provider
      and i.created_at >= now() - (p_days * interval '1 day')
  ), grouped as (
    select local_day, count(*) filter (where interaction_type = 'view') as views,
           count(*) filter (where interaction_type = 'whatsapp') as whatsapp
    from relevant group by local_day
  )
  select jsonb_build_object(
    'period_days',p_days,
    'views',(select count(*) from relevant where interaction_type='view'),
    'whatsapp_clicks',(select count(*) from relevant where interaction_type='whatsapp'),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',local_day,'views',views,'whatsapp',whatsapp) order by local_day) from grouped), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.gig_my_impact(integer) from public, anon;
grant execute on function public.gig_my_impact(integer) to authenticated, service_role;
