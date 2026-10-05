-- pgTAP: the scam guard (spec §6.5) on 36 example messages, then flagging
-- in a real conversation, warnings for the reader only, and reporting a message.
-- Run with: npx supabase test db
begin;
select plan(48);

-- Messages that should be flagged, and why.
select is(public.scam_reasons(body, first_day), reasons, body)
from (values
  ('Could you send me some money for the flight?', false, '{money}'::text[]),
  ('Can you lend me 500 pounds until Friday?', false, '{money}'),
  ('I need you to transfer £200, I will pay you back', false, '{money}'),
  ('Please wire the funds today', false, '{money}'),
  ('Just use Western Union, it is quicker', false, '{money}'),
  ('Send it on PayPal as friends and family', false, '{money}'),
  ('My parcel is stuck and I have to pay the customs fee', false, '{money}'),
  ('My mother is ill and the hospital bill is huge', false, '{money}'),
  ('What are your bank details?', false, '{bank}'),
  ('Give me your sort code and account number', false, '{bank}'),
  ('My IBAN is below', false, '{bank}'),
  ('Read me the card number and the CVV', false, '{bank}'),
  ('Can you buy me some gift cards?', false, '{gift_card}'),
  ('Get two Steam cards from the shop', false, '{gift_card}'),
  ('An Amazon voucher would help', false, '{gift_card}'),
  ('Send me the voucher code', false, '{gift_card}'),
  ('I made a fortune with Bitcoin', false, '{crypto}'),
  ('Pay in USDT please', false, '{crypto}'),
  ('Here is my wallet address', false, '{crypto}'),
  ('I have an investment opportunity for you', false, '{crypto}'),
  ('Join my trading platform, it is easy', false, '{crypto}'),
  ('Let''s talk on WhatsApp instead', false, '{off_app}'),
  ('Message me on Telegram', false, '{off_app}'),
  ('Here: wa.me/447700900123', false, '{off_app}'),
  ('Add me on Instagram, it is easier', false, '{off_app}'),
  ('Download the Signal app and message me there', false, '{off_app}'),
  ('Call me on 07700 900123', true, '{phone}'),
  ('My number is +44 (0)7700-900-123', true, '{phone}'),
  ('Text WhatsApp 07700900123 and send money', true, '{money,off_app,phone}'),
  ('Bitcoin or gift cards, send the money now', false, '{money,gift_card,crypto}')
) as t(body, first_day, reasons);

-- Messages that are fine.
select is(public.scam_reasons(body, first_day), '{}'::text[], body)
from (values
  ('Hello! Are you still thinking about Paris in May?', true),
  ('The museum is £18 and the boat trip is £25', false),
  ('I saved so much money booking early', false),
  ('Call me on 07700 900123', false),
  ('I fly 12-20 May, 2026-05-12 to be exact', true),
  ('Would a quick video call through the app work this week?', true)
) as t(body, first_day);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('eeeeeeee-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 's' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 2) n;
update public.profiles p set display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob')) as v(n, name)
where p.id = pg_temp.m(v.n);

create temp table ids (name text primary key, id bigint);
grant select, insert on ids to authenticated;

select pg_temp.sign_in_as(pg_temp.m(1));
insert into ids select 'req', public.send_connection_request(pg_temp.m(2));
select pg_temp.sign_in_as(pg_temp.m(2));
select public.respond_to_request((select id from ids where name = 'req'), true);
insert into ids select 'conv', id from public.my_conversations();
insert into ids select 'ok', public.send_message((select id from ids where name = 'conv'), 'Lovely to connect!');
insert into ids select 'bad', public.send_message((select id from ids where name = 'conv'), 'Can you send me money on WhatsApp? 07700 900123');

select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv')), 2,
  'flagged messages are still sent');
select is_empty($$select public.message_warnings((select id from ids where name = 'conv'))$$,
  'the sender gets no warning about their own message');
select throws_ok($$select flagged from public.messages$$, '42501', null,
  'members cannot read the flagged column');

select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq($$select public.message_warnings((select id from ids where name = 'conv'))$$,
  $$select id from ids where name = 'bad'$$, 'the reader is warned about the flagged message only');
select throws_ok($$select public.report_message((select id from ids where name = 'conv') * 0 + 999999, 'other')$$, 'P0002', 'Message not found',
  'reporting an unknown message fails');
select lives_ok($$select public.report_message((select id from ids where name = 'bad'), 'asking_for_money', 'Asked twice')$$,
  'Ann can report the message');

select pg_temp.sign_in_as(pg_temp.m(2));
select throws_ok($$select public.report_message((select id from ids where name = 'bad'), 'other')$$, 'P0002', 'Message not found',
  'members cannot report their own messages');

reset role;
select results_eq($$select reasons from public.message_flags$$, $$values ('{money,off_app,phone}'::text[])$$,
  'the flag records every reason');
select results_eq($$select subject_profile_id, reason, message_body from public.reports$$,
  $$values (pg_temp.m(2), 'asking_for_money', 'Can you send me money on WhatsApp? 07700 900123')$$,
  'the report is about the sender and keeps a copy of the message');
delete from public.messages where id = (select id from ids where name = 'bad');
select is((select count(*)::int from public.message_flags where body like 'Can you send me money%'), 1,
  'the evidence stays if the message is removed');
select is((select message_body from public.reports), 'Can you send me money on WhatsApp? 07700 900123',
  'and the report keeps its copy');
select ok((select relrowsecurity from pg_class where oid = 'public.message_flags'::regclass), 'message_flags has row-level security');

select * from finish();
rollback;
