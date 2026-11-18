# 11 — Quiz taking

**What to build:** a Member takes a Topic's practice quiz one question at a time. They can go back before submitting, with no time limit. The server marks it. They see their score, the missed questions with the right answers and explanations (when the quiz allows), their Best Score, and their previous attempts.

- **Starting** (mockup `quizStart`): the question count, passing score, Best Score so far and previous attempts, with "Start".
- **Taking** (mockup `quiz`):
  - one question at a time, with rendered maths and the optional figure
  - Back and Next, and Submit at the end, with unanswered questions flagged
  - shuffled when the quiz says so
- **Marking on the server:**
  - the questions are sent without the correct choice or explanation
  - Submit sends the answers and saves the Quiz Attempt (score and answers)
  - the Best Score updates only if higher
  - submitting counts as a Study Day
- **The score** (mockup `score`):
  - the score and pass or fail against the passing score
  - when "show answers after" is on: each missed question with the Member's answer, the correct answer and the explanation
  - when it's off: the score and which questions were missed
  - "Retake" and back to the Library
- **Previous attempts:** listed with date and score, and each can be reviewed. Questions removed since show "This question has since been removed".
- **Protection and states:** overlay watermark, no text selection, figures as signed URLs, and the same states as ticket 08.

**Blocked by:** 05.

**Status:** ready-for-agent

Spec: Phase 3 → "Quizzes are graded on the server", "Corrections never cost progress"; stories 98–100, 133k, 133l.

- [ ] A Member takes a quiz, goes back to change an answer, submits, and sees the score and review.
- [ ] A lower retake keeps the higher Best Score. Attempts are listed and reviewable.
- [ ] **Sad paths, each with a test:**
  - the question payload never contains the correct choice or explanation
  - a forged submit for a locked quiz is refused
  - a submit with an unknown question or a missing answer is handled (scored as wrong, or refused, as the prompt settles)
  - a double submit saves one attempt
  - "show answers after" off never reveals answers
  - a removed question in an old attempt shows as removed
  - a replaced device's submit is refused
  - one Member's attempts never reach another
