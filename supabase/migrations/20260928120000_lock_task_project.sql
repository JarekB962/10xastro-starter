-- Zadania nie wolno przenieść do innego projektu (poprawka po przeglądzie task-edit, F1):
-- polityka update dopuszcza dowolne kolumny, więc niezmienność project_id pilnuje wyzwalacz, jak numeru zadania.
create function public.prevent_task_project_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Zadania nie można przenieść do innego projektu.' using errcode = 'check_violation';
end;
$$;

create trigger tasks_prevent_project_change
  before update on public.tasks
  for each row
  when (old.project_id is distinct from new.project_id)
  execute function public.prevent_task_project_change();
