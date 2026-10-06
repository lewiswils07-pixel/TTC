-- pgTAP: the back of a member's card (answers to 3 chosen questions).
begin;
select plan(12);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('cdcdcdcd-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'mc' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles set display_name = 'M', gender = 'woman', birth_date = date '1960-05-01', home_city_id = 2644688, onboarded_at = now()
 where id in (pg_temp.m(1), pg_temp.m(2), pg_temp.m(3));

select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$update public.profiles set
  card_answers = '[{"q":"perfect_holiday","a":"A slow week in Lisbon with long lunches, old trams and sunsets over the river."},{"q":"dream_trip","a":"Japan in cherry blossom season"},{"q":"always_pack","a":"A good book"}]'
  where id = auth.uid()$$, 'members can write the back of their card');
select throws_ok($$update public.profiles set card_answers = jsonb_build_array(jsonb_build_object('q', 'how_often', 'a', repeat('word ', 31))) where id = auth.uid()$$, '23514', null, 'answers are at most 30 words');
select throws_ok($$update public.profiles set card_answers = '[{"q":"a_b","a":"1"},{"q":"c_d","a":"2"},{"q":"e_f","a":"3"},{"q":"g_h","a":"4"}]' where id = auth.uid()$$, '23514', null, 'at most 3 answers');
select throws_ok($$update public.profiles set card_answers = '[{"q":"how_often","a":"x"},{"q":"how_often","a":"y"}]' where id = auth.uid()$$, '23514', null, 'each question once');
select throws_ok($$update public.profiles set card_answers = jsonb_build_array(jsonb_build_object('q', 'how_often', 'a', repeat('x', 201))) where id = auth.uid()$$, '23514', null, 'and 200 characters');
select throws_ok($$update public.profiles set card_answers = '[{"q":"how_often","a":"   "}]' where id = auth.uid()$$, '23514', null, 'answers can''t be blank');
select throws_ok($$update public.profiles set card_answers = '[{"q":"how_often","a":"x","extra":"y"}]' where id = auth.uid()$$, '23514', null, 'nothing else can be stored in an answer');
reset role;

select pg_temp.sign_in_as(pg_temp.m(2));
select is((select card_answers -> 0 ->> 'a' from public.member_card(pg_temp.m(1))), 'A slow week in Lisbon with long lunches, old trams and sunsets over the river.', 'other members can read it');
select is((select jsonb_array_length(card_answers) from public.member_card(pg_temp.m(1))), 3, 'with all 3 answers');
select is((select count(*)::int from public.profiles where id = pg_temp.m(1)), 0, 'but not the rest of the profile row');
select public.block_member(pg_temp.m(1));
select is((select count(*)::int from public.member_card(pg_temp.m(1))), 0, 'not after a block');
reset role;

set local role anon;
select throws_ok($$select * from public.member_card(pg_temp.m(1))$$, '42501', null, 'visitors who aren''t signed in can''t read it');
reset role;

select * from finish();
rollback;
