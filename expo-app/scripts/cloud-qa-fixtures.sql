-- ISOLATED Drops Test project snabmkbeoshxxxhtwkyi ONLY.
-- Admin SQL fallback for two temporary GoTrue email identities. This is not a
-- migration, never production setup, and must never be included in a deployment.
-- The returned random passwords are secrets: consume in memory, never log/export.
-- Preferred CI provisioning is auth.admin.createUser with a private test-only key.
with fixtures as materialized (
  select gen_random_uuid() id, encode(extensions.gen_random_bytes(24),'hex') password
  from generate_series(1,2)
), inserted_users as (
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    confirmation_token,recovery_token,email_change_token_new,email_change,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
  select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',
    'drops-qa-'||id::text||'@example.invalid',extensions.crypt(password,extensions.gen_salt('bf')),now(),
    '','','','',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('test_fixture','drops-isolated-qa'),now(),now(),false,false from fixtures
  returning id,email
), inserted_identities as (
  insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
  select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true,'phone_verified',false),
    'email',now(),now() from inserted_users returning user_id
)
select u.id,u.email,f.password from inserted_users u join fixtures f using(id)
join inserted_identities i on i.user_id=u.id;
