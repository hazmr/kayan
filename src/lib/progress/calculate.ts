// The progress rules as plain functions with no database in them, so they can be tested alone.
//
//   progress = lessons completed / lessons in the course
//   "continue" goes to the first lesson not completed yet, in course order
//   once everything is completed, "continue" becomes "review" and starts again at the first lesson

export interface CourseProgress {
  completed: number
  total: number
  /** A whole number from 0 to 100. */
  percent: number
}

export type LearnState = 'start' | 'continue' | 'review'

/**
 * Only lessons that still exist in the course count: a completed lesson the doctor later
 * deleted must not push the numbers past 100%.
 */
export function summarizeProgress(
  orderedLessonIds: readonly string[],
  completedIds: ReadonlySet<string>,
): CourseProgress {
  const total = orderedLessonIds.length
  const completed = orderedLessonIds.filter((id) => completedIds.has(id)).length
  return { completed, total, percent: total === 0 ? 0 : Math.floor((completed / total) * 100) }
}

/** Where "Continue learning" opens, and what the button should say. Null when there are no lessons. */
export function resumeAt(
  orderedLessonIds: readonly string[],
  completedIds: ReadonlySet<string>,
): { lessonId: string; state: LearnState } | null {
  const first = orderedLessonIds[0]
  if (first === undefined) return null
  const next = orderedLessonIds.find((id) => !completedIds.has(id))
  if (next === undefined) return { lessonId: first, state: 'review' }
  const anyDone = orderedLessonIds.some((id) => completedIds.has(id))
  return { lessonId: next, state: anyDone ? 'continue' : 'start' }
}
