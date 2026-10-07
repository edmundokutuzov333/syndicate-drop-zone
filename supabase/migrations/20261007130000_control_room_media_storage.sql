-- Central media storage for the Control Room.
-- Apply this migration in the project's Supabase database before using uploads.

insert into storage.buckets (id, name, public)
values ('syndicate-media', 'syndicate-media', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Control Room media read'
  ) then
    create policy "Control Room media read"
      on storage.objects for select
      using (bucket_id = 'syndicate-media');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Control Room media insert'
  ) then
    create policy "Control Room media insert"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'syndicate-media'
        and exists (
          select 1 from public.admin_profiles
          where user_id = auth.uid()
            and active = true
            and role in ('OWNER', 'ADMIN', 'EDITOR')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Control Room media update'
  ) then
    create policy "Control Room media update"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'syndicate-media'
        and exists (
          select 1 from public.admin_profiles
          where user_id = auth.uid()
            and active = true
            and role in ('OWNER', 'ADMIN', 'EDITOR')
        )
      )
      with check (
        bucket_id = 'syndicate-media'
        and exists (
          select 1 from public.admin_profiles
          where user_id = auth.uid()
            and active = true
            and role in ('OWNER', 'ADMIN', 'EDITOR')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Control Room media delete'
  ) then
    create policy "Control Room media delete"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'syndicate-media'
        and exists (
          select 1 from public.admin_profiles
          where user_id = auth.uid()
            and active = true
            and role in ('OWNER', 'ADMIN', 'EDITOR')
        )
      );
  end if;
end $$;
