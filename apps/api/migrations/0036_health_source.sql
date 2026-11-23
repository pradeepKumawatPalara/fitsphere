-- Health Connect as a source of steps and body weight (D-121, ADR-0013, docs/plans/health-connect.md).
-- Each day's value says where it came from: typed by the user ('manual') or read from the phone's
-- health store ('health_connect'). A value the user typed is never replaced by an import: the API
-- refuses that change (MANUAL_VALUE_EXISTS); an edit by the user turns an imported value into their
-- own. Every row that exists now was typed, so it takes the default 'manual'.
-- Rows stay one per user and day (unique (user_id, day)); nothing else changes.

alter table app.weigh_ins
  add column source text not null default 'manual' check (source in ('manual', 'health_connect'));

alter table app.step_counts
  add column source text not null default 'manual' check (source in ('manual', 'health_connect'));
