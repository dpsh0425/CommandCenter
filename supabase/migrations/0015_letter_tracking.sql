-- Track when each recommender was asked and reminded, so the app can say who to chase.
alter table letter_requests
  add column asked_on date,
  add column last_reminded_on date,
  add column reminder_count integer not null default 0 check (reminder_count >= 0),
  add column received_on date;

-- Letters already marked as asked or later have no recorded date; use the day the request was created.
update letter_requests
   set asked_on = created_at::date
 where status <> 'not_asked' and asked_on is null;
update letter_requests
   set received_on = updated_at::date
 where status = 'submitted' and received_on is null;
