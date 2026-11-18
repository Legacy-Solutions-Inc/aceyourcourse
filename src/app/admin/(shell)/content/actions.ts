"use server";

import { adminAction } from "@/lib/admin/action";
import {
  confirmCardImport,
  confirmQuizImport,
  createCard,
  createQuestion,
  createTopic,
  deleteCard,
  deleteQuestion,
  deleteTopic,
  moveCard,
  moveQuestion,
  moveTopic,
  planCardImport,
  planQuizImport,
  renameTopic,
  setDeckFreePreview,
  setDeckVisibility,
  setQuizFreePreview,
  setQuizVisibility,
  updateCard,
  updateQuestion,
  updateQuizSettings,
} from "@/services/admin";
import {
  cardFormSchema,
  cardIdInputSchema,
  importInputSchema,
  cardMoveInputSchema,
  confirmImportInputSchema,
  deckFreePreviewInputSchema,
  deckVisibilityInputSchema,
  newCardFormSchema,
  newQuestionFormSchema,
  newTopicFormSchema,
  questionFormSchema,
  questionIdInputSchema,
  questionMoveInputSchema,
  quizFreePreviewInputSchema,
  quizSettingsFormSchema,
  quizVisibilityInputSchema,
  renameTopicFormSchema,
  topicIdInputSchema,
  topicMoveInputSchema,
} from "@/services/admin.schema";
import { createContentUpload } from "@/services/uploads";
import { cardImageFileSchema, contentUploadRequestSchema } from "@/services/uploads.types";

// Member App content's Server Actions (Phase 3, ticket 05; spec, Phase 3
// planning decisions → Topics editor): any Staff User manages a Subject's
// Topics. The Staff Guard runs first, so someone signed out, or signed in but
// not Staff (a Member, say), is refused before the seam is reached; the seam
// checks the Staff Role again. None clears a cache tag: nothing cached reads
// Topics.

/** "+ Add topic": a new, empty Topic, last in its Subject. */
export const addTopic = adminAction({ role: "staff", schema: newTopicFormSchema }, createTopic);

/** Rename: an editor's save, so it sends the stamp the name had when the form opened. */
export const saveTopicName = adminAction(
  { role: "staff", schema: renameTopicFormSchema, requiresStamp: true },
  renameTopic,
);

/** ▲▼: one place earlier or later in its Subject. */
export const moveTopicInSubject = adminAction(
  { role: "staff", schema: topicMoveInputSchema },
  async (actor, { id, direction }) => moveTopic(actor, id, direction),
);

/** Delete: only an empty Topic; the seam refuses one with content, saying why. */
export const removeTopic = adminAction(
  { role: "staff", schema: topicIdInputSchema },
  async (actor, { id }) => deleteTopic(actor, id),
);

// The card import (ticket 06): the browser asks for a one-time URL for each
// file, uploads the CSV and zip straight to the private content bucket, then
// checks and imports them by their paths. Like every Admin action, each runs
// the Staff Guard first, so a Member or someone signed out never reaches the
// seam.

/** A one-time upload URL for the import's CSV or zip of images, in the private content bucket. */
export const createImportUpload = adminAction(
  { role: "staff", schema: contentUploadRequestSchema },
  async (actor, request) => createContentUpload(actor, request),
);

/** "Check file": the import's preview. Saves nothing. */
export const checkCardImport = adminAction(
  { role: "staff", schema: importInputSchema },
  async (actor, input) => planCardImport(actor, input),
);

/** "Import": saves a preview with no problems, all or nothing. */
export const importCards = adminAction(
  { role: "staff", schema: confirmImportInputSchema },
  async (actor, input) => confirmCardImport(actor, input),
);

// The quiz import (ticket 09): the same screen and uploads, with quiz rows.

/** "Check file" for a quiz CSV: the import's preview. Saves nothing. */
export const checkQuizImport = adminAction(
  { role: "staff", schema: importInputSchema },
  async (actor, input) => planQuizImport(actor, input),
);

/** "Import" for a quiz CSV: saves a preview with no problems, all or nothing. */
export const importQuizzes = adminAction(
  { role: "staff", schema: confirmImportInputSchema },
  async (actor, input) => confirmQuizImport(actor, input),
);

// The card editor (ticket 07): any Staff User adds, edits, moves and deletes
// a Topic's cards, and makes its deck Visible and Free Preview. The browser
// uploads a card's back image straight to the private content bucket first,
// and the save names it by its path. Like every Admin action, each runs the
// Staff Guard first, so a Member or someone signed out never reaches the seam,
// which checks every rule again.

/** A one-time upload URL for a card's back image, in the private content bucket. */
export const createCardImageUpload = adminAction(
  { role: "staff", schema: cardImageFileSchema },
  async (actor, file) => createContentUpload(actor, { purpose: "card-image", ...file }),
);

/** "Save" or "Save & add next" on a new card, last in its Topic's deck. */
export const addCard = adminAction({ role: "staff", schema: newCardFormSchema }, createCard);

/** "Save" on a card being edited: it sends the stamp the card had when the form opened. */
export const saveCard = adminAction(
  { role: "staff", schema: cardFormSchema, requiresStamp: true },
  updateCard,
);

/** ▲▼: one place earlier or later in its deck. */
export const moveCardInDeck = adminAction(
  { role: "staff", schema: cardMoveInputSchema },
  async (actor, { id, direction }) => moveCard(actor, id, direction),
);

/** Delete, after the confirmation: the card and every Member's Card Mark on it. */
export const removeCard = adminAction(
  { role: "staff", schema: cardIdInputSchema },
  async (actor, { id }) => deleteCard(actor, id),
);

/** "Visible to members": refused while the deck is empty. */
export const saveDeckVisibility = adminAction(
  { role: "staff", schema: deckVisibilityInputSchema },
  async (actor, { deck, visible }) => setDeckVisibility(actor, deck, visible),
);

/** "Free Preview": Members with no Access Pass can open the deck while it's Visible. */
export const saveDeckFreePreview = adminAction(
  { role: "staff", schema: deckFreePreviewInputSchema },
  async (actor, { deck, freePreview }) => setDeckFreePreview(actor, deck, freePreview),
);

// The quiz screen (ticket 09): any Staff User sets a quiz's passing score,
// shuffle and "show answers after", and makes it Visible and Free Preview.
// Like every Admin action, each runs the Staff Guard first, so a Member or
// someone signed out never reaches the seam, which checks every rule again.

/** "Save settings": an editor's save, so it sends the stamp the settings had when the form opened. */
export const saveQuizSettings = adminAction(
  { role: "staff", schema: quizSettingsFormSchema, requiresStamp: true },
  updateQuizSettings,
);

/** "Visible to members": refused while the quiz has no questions. */
export const saveQuizVisibility = adminAction(
  { role: "staff", schema: quizVisibilityInputSchema },
  async (actor, { quiz, visible }) => setQuizVisibility(actor, quiz, visible),
);

/** "Free Preview": Members with no Access Pass can open the quiz while it's Visible. */
export const saveQuizFreePreview = adminAction(
  { role: "staff", schema: quizFreePreviewInputSchema },
  async (actor, { quiz, freePreview }) => setQuizFreePreview(actor, quiz, freePreview),
);

// The question editor (ticket 10): any Staff User adds, edits, moves and
// deletes a Topic's quiz questions, as the card editor does cards. A figure
// has a card image's rules, so the form asks for its upload with
// createCardImageUpload. Like every Admin action, each runs the Staff Guard
// first, so a Member or someone signed out never reaches the seam, which
// checks every rule again.

/** "Save" or "Save & add next" on a new question, last in its Topic's quiz. */
export const addQuestion = adminAction(
  { role: "staff", schema: newQuestionFormSchema },
  createQuestion,
);

/** "Save" on a question being edited: it sends the stamp the question had when the form opened. */
export const saveQuestion = adminAction(
  { role: "staff", schema: questionFormSchema, requiresStamp: true },
  updateQuestion,
);

/** ▲▼: one place earlier or later in its quiz. */
export const moveQuestionInQuiz = adminAction(
  { role: "staff", schema: questionMoveInputSchema },
  async (actor, { id, direction }) => moveQuestion(actor, id, direction),
);

/** Delete, after the confirmation: the question leaves the quiz, kept for Members' old attempts. */
export const removeQuestion = adminAction(
  { role: "staff", schema: questionIdInputSchema },
  async (actor, { id }) => deleteQuestion(actor, id),
);
