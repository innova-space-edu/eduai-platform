-- Manual integration regression: executes as authenticated users and rolls back all temporary documents.
begin;
select set_config('test.owner',(select user_id::text from public.saved_plannings limit 1),true);
select set_config('test.other',(select id::text from auth.users where id::text<>current_setting('test.owner') limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
do $$
declare p uuid; q uuid; a uuid; b uuid; cfg jsonb;
begin
insert into public.saved_plannings(user_id,title,planning_text,content,nivel,curso,asignatura,contexto,selected_oa_ids,planning_json)
values(auth.uid(),'Prueba temporal biblioteca','Ecosistema prueba inicial','Ecosistema prueba inicial','Media','1° Medio','Biología','ecosistema',array['TEST_OA'],'{}') returning id,planning_json into p,cfg;
a:=(cfg#>>'{_eduaiReuse,assetId}')::uuid;
if a is null then raise exception 'Trigger no creó vínculo'; end if;
update public.saved_plannings set content='Ecosistema corregido docente' where id=p;
if (select text_content from public.eduai_assets where id=a) <> 'Ecosistema corregido docente' then raise exception 'Corrección no sincronizada'; end if;
if (select count(*) from public.search_private_planning_references('ecosistema','Media','1° Medio','Biología',array['TEST_OA'],3))<1 then raise exception 'Referencia propia ausente'; end if;
insert into public.saved_plannings(user_id,title,planning_text,content,planning_json)
values(auth.uid(),'Copia temporal','Copia de prueba','Copia de prueba',cfg) returning id,planning_json into q,cfg;
b:=(cfg#>>'{_eduaiReuse,assetId}')::uuid;
if a=b then raise exception 'Copia comparte documento mutable'; end if;
if public.increment_planning_asset_hit(a)<>1 then raise exception 'Contador no incrementó'; end if;
perform set_config('request.jwt.claim.sub',current_setting('test.other'),true);
if exists(select 1 from public.eduai_assets where id in(a,b)) then raise exception 'Fuga RLS'; end if;
if public.increment_planning_asset_hit(a) is not null then raise exception 'Contador ajeno accesible'; end if;
if exists(select 1 from public.search_private_planning_references('ecosistema','Media','1° Medio','Biología',array['TEST_OA'],3) where id=p) then raise exception 'Referencia ajena accesible'; end if;
perform set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
delete from public.saved_plannings where id=p;
if exists(select 1 from public.eduai_assets where id=a) then raise exception 'Borrado no sincronizado'; end if;
if not exists(select 1 from public.eduai_assets where id=b) then raise exception 'Copia independiente eliminada'; end if;
end $$;
rollback;