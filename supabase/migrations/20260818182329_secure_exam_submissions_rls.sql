-- Student submissions are written through the server-side exam API. Direct public
-- SELECT/INSERT exposed names, RUTs, answers, scores and grades and are not required.
drop policy if exists "Anyone can submit" on public.exam_submissions;
drop policy if exists "Student reads own submission" on public.exam_submissions;

alter policy "Teacher reads submissions" on public.exam_submissions
to authenticated
using (
  exam_id in (
    select te.id
    from public.teacher_exams te
    where te.teacher_id = (select auth.uid())
  )
);
