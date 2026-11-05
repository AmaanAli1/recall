import type { Answer, ChatMessage, ChatRecord, Course, CourseColor, CourseDocument, DemoSession } from "@/lib/api/types";

/*
 * Database rows -> the frontend's types (lib/api/types.ts).
 *
 * Postgres uses snake_case and null; the frontend uses camelCase and leaves
 * optional fields out. Doing the conversion in ONE place means the route
 * handlers stay short, and if a column is renamed, only this file changes.
 */

/** The columns we read from public.demo_sessions. */
export interface DemoSessionRow {
  code: string;
  created_at: string;
  last_active_at: string;
}

/** The columns we read from public.courses. */
export interface CourseRow {
  id: string;
  session_id: string | null;
  name: string;
  code: string | null;
  term: string | null;
  color: CourseColor;
  archived: boolean;
}

export function toDemoSession(row: DemoSessionRow): DemoSession {
  return {
    // The UI shows the human-readable code (demo-K7QF-3M), never the uuid.
    id: row.code,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}

export function toCourse(row: CourseRow, documents: CourseDocument[] = []): Course {
  return {
    id: row.id,
    name: row.name,
    // null in the database -> leave the field out (undefined) in the UI.
    code: row.code ?? undefined,
    term: row.term ?? undefined,
    color: row.color,
    archived: row.archived,
    // session_id null = a shared sample course (read-only for everyone).
    sample: row.session_id === null,
    // There's no documents table yet (RAG phase), so it starts empty.
    documents,
  };
}

   /** The columns we read from public.chats. */
   export interface ChatRow {
     id: string;
     course_id: string;
     title: string;
     pinned: boolean;
     updated_at: string;
   }

   export function toChatRecord(row: ChatRow): ChatRecord {
     return {
       id: row.id,
       courseId: row.course_id,
       title: row.title,
       pinned: row.pinned,
       updatedAt: row.updated_at,
     };
   }

   /** The columns we read from public.messages. */
export interface MessageRow {
  id: number;
  role: "user" | "assistant";
  content: string;
  answer: Answer | null;
  created_at: string;
}

export function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    // null on questions -> leave the field out.
    answer: row.answer ?? undefined,
    createdAt: row.created_at,
  };
}