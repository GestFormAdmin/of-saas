create or replace function public.get_my_page_permissions()
returns table(page text, allowed boolean)
language sql
security definer
set search_path = public
as $$
  with me as (
    select lower(u.email) as email
    from auth.users u
    where u.id = auth.uid()
  )
  select p.page, false as allowed
  from public.app_pages p

  union all
  select 'abonnes_application'::text as page, true as allowed
  from me
  where me.email = 'talentupfp@gmail.com';
$$;

revoke all on function public.get_my_page_permissions() from public;
grant execute on function public.get_my_page_permissions() to authenticated;
