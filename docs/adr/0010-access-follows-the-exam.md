# 10. Access follows the Exam: one Plan unlocks all of an Exam's content

Date: 2026-10-29

## Status

Accepted

## Context

The Admin mockup implies two access models that conflict:

- The Plan editor lets a Plan unlock chosen content types (flashcards,
  quizzes, Reviewer PDFs, video courses).
- Each Reviewer PDF has its own "Included in" setting.

The only Plans actually sold are "{Exam} All-Access".

## Decision

- A **Plan** covers exactly one Exam and unlocks **all** of that Exam's study
  content: flashcard decks, quizzes, Reviewer PDFs, and any Course marked as
  included.
- Buying a Plan, or a Staff grant, gives the Member an **Access Pass** for that
  Exam, with a start date and an end date.
- A Course sold separately gives permanent **Course Ownership**, independent
  of any Access Pass.
- **Free Preview** is a flag on an individual deck, Reviewer PDF or Lesson.
  Any signed-in Member can open Free Preview content.

Every access check therefore answers one of three questions:

1. Is this content Free Preview?
2. Does the Member hold an active Access Pass for the content's Exam?
3. For a separately sold Course, does the Member own it?

## Considered options

- **Per-content-type unlocks** (for example "Flashcards only" Plans).
  Rejected. They add a layer to every access check and every Admin screen, to
  support partial Plans nobody has asked for. If they're ever needed, add a
  content-type scope to Plan and Access Pass then.
- **A per-item "Included in" list.** Rejected. Content belongs to an Exam, so
  access follows the Exam.
