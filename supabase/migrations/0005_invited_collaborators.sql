-- Links a people row to a real login account, once that person is invited.
alter table people add column auth_user_id uuid references auth.users(id) on delete set null;

-- A person can see their own linked people row (so the app can answer "who am I").
create policy "person can view own row" on people
  for select using (auth_user_id = auth.uid());

-- An invited collaborator sees and can update only the tasks assigned to them.
-- The WITH CHECK clause deliberately requires assignee_id to still resolve to
-- their own people row after the update — they can change status/description,
-- but cannot reassign a task away from themselves via a direct write.
create policy "assignee can view assigned tasks" on tasks
  for select using (
    assignee_id in (select id from people where auth_user_id = auth.uid())
  );

create policy "assignee can update assigned tasks" on tasks
  for update using (
    assignee_id in (select id from people where auth_user_id = auth.uid())
  ) with check (
    assignee_id in (select id from people where auth_user_id = auth.uid())
  );

-- Task updates (the log) for tasks assigned to them — read and add, not edit/delete others'.
create policy "assignee can view updates on assigned tasks" on task_updates
  for select using (
    task_id in (
      select id from tasks where assignee_id in (select id from people where auth_user_id = auth.uid())
    )
  );

create policy "assignee can add updates on assigned tasks" on task_updates
  for insert with check (
    task_id in (
      select id from tasks where assignee_id in (select id from people where auth_user_id = auth.uid())
    )
  );

-- Focus sessions on their own assigned tasks.
create policy "assignee can view own focus sessions" on focus_sessions
  for select using (
    task_id in (
      select id from tasks where assignee_id in (select id from people where auth_user_id = auth.uid())
    )
  );

create policy "assignee can log own focus sessions" on focus_sessions
  for insert with check (
    task_id in (
      select id from tasks where assignee_id in (select id from people where auth_user_id = auth.uid())
    )
  );

create policy "assignee can end own focus sessions" on focus_sessions
  for update using (
    task_id in (
      select id from tasks where assignee_id in (select id from people where auth_user_id = auth.uid())
    )
  ) with check (
    task_id in (
      select id from tasks where assignee_id in (select id from people where auth_user_id = auth.uid())
    )
  );

-- Read-only context: the school or research milestone a task is linked to.
create policy "assignee can view linked schools" on schools
  for select using (
    id in (
      select school_id from tasks
      where assignee_id in (select id from people where auth_user_id = auth.uid())
        and school_id is not null
    )
  );

create policy "assignee can view linked milestones" on research_milestones
  for select using (
    id in (
      select research_milestone_id from tasks
      where assignee_id in (select id from people where auth_user_id = auth.uid())
        and research_milestone_id is not null
    )
  );
