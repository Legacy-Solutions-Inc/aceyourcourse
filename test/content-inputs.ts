/**
 * Pure: a Hidden deck or quiz, or a Draft Reviewer PDF, for a Topic: what a
 * later ticket's import or upload makes, for the tests that need a Topic
 * with content before those tickets exist.
 */
export function newContent(topicId: string) {
  return {
    id: crypto.randomUUID(),
    topicId,
    visibility: "hidden" as const,
    status: "draft" as const,
    freePreview: false,
  };
}
