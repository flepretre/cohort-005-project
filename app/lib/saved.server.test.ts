import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { approveRefundRequest, raiseRefundRequest } from "./refunds.server";
import { fakeNotifications } from "./notifications.fake.server";
import {
  getNote,
  isBookmarked,
  listBookmarks,
  listNotes,
  MAX_NOTE_LENGTH,
  saveNote,
  toggleBookmark,
} from "./saved.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const LATER = new Date(2026, 9, 6, 13, 0, 0);
const LATEST = new Date(2026, 9, 6, 14, 0, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let otherStudent: typeof schema.users.$inferSelect;
let firstLessonId: number;
let secondLessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  otherStudent = db
    .insert(schema.users)
    .values({
      name: "Other Student",
      email: "other@example.com",
      role: UserRole.Student,
    })
    .returning()
    .get();

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  [firstLessonId, secondLessonId] = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("toggling a Bookmark", () => {
  it("bookmarks a Lesson with no Bookmark, and un-bookmarks it on the next toggle", () => {
    expect(toggleBookmark(db, base.user.id, firstLessonId, NOW)).toBe(true);
    expect(isBookmarked(db, base.user.id, firstLessonId)).toBe(true);

    expect(toggleBookmark(db, base.user.id, firstLessonId, LATER)).toBe(false);
    expect(isBookmarked(db, base.user.id, firstLessonId)).toBe(false);
  });

  it("never leaves a Student with two Bookmarks on one Lesson", () => {
    toggleBookmark(db, base.user.id, firstLessonId, NOW);
    expect(() =>
      db
        .insert(schema.bookmarks)
        .values({ userId: base.user.id, lessonId: firstLessonId })
        .run()
    ).toThrow();
    expect(listBookmarks(db, base.user.id)).toHaveLength(1);
  });
});

describe("saving a Note", () => {
  it("creates a Note, trimmed, on a Lesson with none", () => {
    const result = saveNote(db, base.user.id, firstLessonId, "  Remember this  ", NOW);

    expect(result).toEqual({
      ok: true,
      note: { body: "Remember this", updatedAt: NOW.toISOString() },
    });
    expect(getNote(db, base.user.id, firstLessonId)).toEqual({
      body: "Remember this",
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last-edited time on when saved again", () => {
    saveNote(db, base.user.id, firstLessonId, "First draft", NOW);
    saveNote(db, base.user.id, firstLessonId, "Second draft", LATER);

    expect(getNote(db, base.user.id, firstLessonId)).toEqual({
      body: "Second draft",
      updatedAt: LATER.toISOString(),
    });
    expect(listNotes(db, base.user.id)).toHaveLength(1);
  });

  it("keeps the body as typed, Markdown characters included", () => {
    saveNote(db, base.user.id, firstLessonId, "# not a heading\n*not bold*", NOW);

    expect(getNote(db, base.user.id, firstLessonId)?.body).toBe(
      "# not a heading\n*not bold*"
    );
  });

  it("accepts a Note of exactly 2,000 characters and refuses one longer", () => {
    expect(MAX_NOTE_LENGTH).toBe(2000);

    const atCap = saveNote(db, base.user.id, firstLessonId, "a".repeat(2000), NOW);
    expect(atCap.ok).toBe(true);

    const overCap = saveNote(db, base.user.id, secondLessonId, "a".repeat(2001), NOW);
    expect(overCap).toEqual({
      ok: false,
      error: "A note must be 2,000 characters or fewer.",
    });
    expect(getNote(db, base.user.id, secondLessonId)).toBeNull();
  });

  it("removes the Note when saved empty", () => {
    saveNote(db, base.user.id, firstLessonId, "Something", NOW);

    expect(saveNote(db, base.user.id, firstLessonId, "   ", LATER)).toEqual({
      ok: true,
      note: null,
    });
    expect(getNote(db, base.user.id, firstLessonId)).toBeNull();
  });
});

describe("the Saved lists", () => {
  it("hold only the Student's own rows, newest first, with Lesson and Course", () => {
    toggleBookmark(db, base.user.id, firstLessonId, NOW);
    toggleBookmark(db, base.user.id, secondLessonId, LATER);
    toggleBookmark(db, otherStudent.id, firstLessonId, LATEST);

    saveNote(db, base.user.id, secondLessonId, "Older", NOW);
    saveNote(db, base.user.id, firstLessonId, "Newer", LATER);
    saveNote(db, otherStudent.id, firstLessonId, "Not mine", LATEST);

    expect(listBookmarks(db, base.user.id)).toMatchObject([
      { lessonId: secondLessonId, lessonTitle: "Lesson 2", courseTitle: "Test Course", courseSlug: "test-course" },
      { lessonId: firstLessonId, lessonTitle: "Lesson 1", courseTitle: "Test Course", courseSlug: "test-course" },
    ]);
    expect(listNotes(db, base.user.id)).toMatchObject([
      { body: "Newer", lessonId: firstLessonId, courseTitle: "Test Course" },
      { body: "Older", lessonId: secondLessonId, courseTitle: "Test Course" },
    ]);
  });

  it("orders Notes by last edited, so a re-saved Note moves to the top", () => {
    saveNote(db, base.user.id, firstLessonId, "First", NOW);
    saveNote(db, base.user.id, secondLessonId, "Second", LATER);
    saveNote(db, base.user.id, firstLessonId, "First, edited", LATEST);

    expect(listNotes(db, base.user.id).map((note) => note.body)).toEqual([
      "First, edited",
      "Second",
    ]);
  });
});

describe("approving a Refund", () => {
  it("keeps the Student's Bookmarks and Notes", async () => {
    const platformAdmin = db
      .insert(schema.users)
      .values({ name: "Admin", email: "admin@example.com", role: UserRole.Admin })
      .returning()
      .get();
    const purchase = db
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 7900,
        createdAt: NOW.toISOString(),
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();

    toggleBookmark(db, base.user.id, firstLessonId, NOW);
    saveNote(db, base.user.id, firstLessonId, "Keep me", NOW);

    const notifications = fakeNotifications();
    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "Not for me.",
      NOW,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);
    const approved = await approveRefundRequest(
      db,
      raised.refundRequestId,
      platformAdmin.id,
      null,
      NOW,
      notifications
    );
    expect(approved.ok).toBe(true);
    expect(
      db
        .select()
        .from(schema.enrollments)
        .where(eq(schema.enrollments.userId, base.user.id))
        .all()
    ).toHaveLength(0);

    expect(isBookmarked(db, base.user.id, firstLessonId)).toBe(true);
    expect(getNote(db, base.user.id, firstLessonId)?.body).toBe("Keep me");
  });
});
