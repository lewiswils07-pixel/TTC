-- safety: scam guard and reporting a message (spec §6.4, §6.5). Every
-- message is checked on the server for money and contact-moving patterns.
-- Nothing is blocked: the message is sent as normal, the person reading it
-- sees a calm warning, and it goes on Lewis's review list. The sender is
-- never told.

-- Why a message looks risky, as short codes (an empty array means it's
-- fine). A phone number only counts in the first 24 hours of a connection.
create function public.scam_reasons(p_body text, p_first_day boolean default false)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  b       text := lower(coalesce(p_body, ''));
  reasons text[] := '{}';
  phone   text;
begin
  if b ~ '\m(send|transfer|wire|lend|loan|borrow|owe)\M[^.?!]{0,40}\m(money|cash|funds|pounds|dollars|euros|quid|grand)\M'
     or b ~ '\m(send|transfer|wire|lend|loan)\M[^.?!]{0,30}[£$€] ?\d'
     or b ~ '\m(western union|moneygram|money gram|paypal|revolut|venmo|cash ?app|zelle|remitly|worldremit)\M'
     or b ~ '\m(customs|clearance|release|processing) fees?\M'
     or b ~ '\m(hospital|medical) (bill|fees?)\M'
  then
    reasons := reasons || 'money'::text;
  end if;
  if b ~ '\mbank (details|account|transfer|info)'
     or b ~ '\msort ?code\M'
     or b ~ '\maccount (number|no)\M'
     or b ~ '\m(iban|swift|bic|cvv)\M'
     or b ~ '\mrouting number\M'
     or b ~ '\mcard (number|details)\M'
  then
    reasons := reasons || 'bank'::text;
  end if;
  if b ~ '\mgift ?cards?\M'
     or b ~ '\m(itunes|apple|steam|amazon|google play|ebay|sephora)( gift)? (card|voucher)s?\M'
     or b ~ '\mvoucher codes?\M'
  then
    reasons := reasons || 'gift_card'::text;
  end if;
  if b ~ '\m(bitcoin|btc|crypto\w*|usdt|tether|ethereum|binance|coinbase|forex)\M'
     or b ~ '\mwallet address\M'
     or b ~ '\minvest(ment|ing)? (opportunit\w*|platform|scheme)'
     or b ~ '\mtrading (platform|account|app)\M'
  then
    reasons := reasons || 'crypto'::text;
  end if;
  if b ~ '\m(whats ?app|telegram|wechat|viber|kik|snapchat|hangouts)\M'
     or b ~ '\m(wa\.me|t\.me)/'
     or b ~ '\msignal\M[^.?!]{0,15}\m(app|me|number)\M'
     or b ~ '\m(add|find|follow|message|text|dm|contact) me (on|at|via)\M[^.?!]{0,25}\m(instagram|insta|facebook|messenger|email|gmail|hotmail|outlook|signal|line)\M'
  then
    reasons := reasons || 'off_app'::text;
  end if;
  if p_first_day then
    -- 9 or more digits, allowing spaces, dots, brackets and dashes.
    phone := substring(b from '\+?\d[\d ().-]{7,}\d');
    if phone is not null and length(regexp_replace(phone, '\D', '', 'g')) >= 9 then
      reasons := reasons || 'phone'::text;
    end if;
  end if;
  return reasons;
end;
$$;

-- The review list. A copy of the message is kept as evidence, even if the
-- message itself is later removed. Members can't read this table.
create table public.message_flags (
  id           bigint generated always as identity primary key,
  message_id   bigint unique references public.messages (id) on delete set null,
  sender_id    uuid references public.profiles (id) on delete set null,
  body         text not null,
  reasons      text[] not null,
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create index message_flags_open_idx on public.message_flags (created_at) where status = 'open';
alter table public.message_flags enable row level security;
revoke all on public.message_flags from anon, authenticated;

-- Members can read every column of a message except flagged, so a sender
-- can't tell their message was flagged. The person reading it learns which
-- messages need a warning from message_warnings() instead.
revoke select on public.messages from authenticated;
grant select (id, conversation_id, sender_id, body, created_at) on public.messages to authenticated;

-- Reporting a message: the report is about its sender, with a copy of
-- the message kept alongside.
alter table public.reports
  add column message_id bigint references public.messages (id) on delete set null,
  add column message_body text;

create or replace function public.send_message(p_conversation_id bigint, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  body      text := btrim(p_body);
  new_id    bigint;
  first_day boolean;
  reasons   text[];
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.in_conversation(p_conversation_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if not public.can_message(p_conversation_id) then
    raise exception 'This conversation has ended' using errcode = 'check_violation';
  end if;
  if body is null or body = '' then
    raise exception 'Write a message first' using errcode = 'check_violation';
  end if;
  select c.created_at > now() - interval '24 hours' into first_day
  from public.conversations c where c.id = p_conversation_id;
  reasons := public.scam_reasons(body, first_day);

  insert into public.messages (conversation_id, sender_id, body, flagged)
  values (p_conversation_id, auth.uid(), body, cardinality(reasons) > 0)
  returning id into new_id;
  if cardinality(reasons) > 0 then
    insert into public.message_flags (message_id, sender_id, body, reasons)
    values (new_id, auth.uid(), body, reasons);
  end if;
  -- Sending counts as reading everything before it.
  update public.conversation_members set last_read_at = clock_timestamp()
   where conversation_id = p_conversation_id and profile_id = auth.uid();
  return new_id;
end;
$$;

-- Messages sent to me in this conversation that should carry a warning.
create function public.message_warnings(p_conversation_id bigint)
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.messages m
  where m.conversation_id = p_conversation_id
    and public.in_conversation(p_conversation_id)
    and m.flagged
    and m.sender_id <> auth.uid()
  order by m.id
$$;

-- Report a message someone sent me. Counts as a report about the sender.
create function public.report_message(p_message_id bigint, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := auth.uid();
  msg public.messages;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into msg from public.messages m where m.id = p_message_id;
  if msg.id is null or not public.in_conversation(msg.conversation_id) or msg.sender_id = me then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;
  insert into public.reports (reporter_id, subject_profile_id, reason, details, message_id, message_body)
  values (me, msg.sender_id, p_reason, nullif(btrim(p_details), ''), msg.id, msg.body)
  on conflict (reporter_id, subject_profile_id) where status = 'open'
  do update set reason = excluded.reason,
                details = coalesce(excluded.details, public.reports.details),
                message_id = excluded.message_id,
                message_body = excluded.message_body,
                created_at = now();
end;
$$;

revoke all on function public.scam_reasons(text, boolean) from public, anon, authenticated;
revoke all on function public.report_message(bigint, text, text) from public, anon;
revoke all on function public.message_warnings(bigint) from public, anon;
grant execute on function public.message_warnings(bigint) to authenticated;
grant execute on function public.report_message(bigint, text, text) to authenticated;
