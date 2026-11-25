-- Remove the Everyday Math sample course (decided 2026-11-24).
--
-- Its PDFs were never loaded: OpenStax draws the maths as
-- pictures, so text extraction dropped every number and the
-- chapters would have needed OCR first. To finish the project
-- sooner, the demo keeps one sample course: Algorithms, with
-- its starter questions for visitors new to the subject.

-- "on delete cascade" (chats, messages, documents, chunks)
-- removes everything that hung off it: visitors' chats in
-- Everyday Math, which could only ever answer "not found".
--
-- session_id is null = a sample course, so this can never
-- touch a visitor's own course, even one with the same id.
delete from public.courses
 where session_id is null
   and id = '00000000-0000-0000-0000-00000000c004';
