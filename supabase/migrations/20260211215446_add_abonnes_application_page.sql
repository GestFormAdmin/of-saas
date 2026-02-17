insert into public.app_pages (page, label, path, sort_order)
values ('abonnes_application', 'Abonnés application', '/abonnes-application', 900)
on conflict (page) do update
set label = excluded.label,
    path = excluded.path,
    sort_order = excluded.sort_order;
