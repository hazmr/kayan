import { describe, expect, it } from 'vitest'

import { resumeAt, summarizeProgress } from '@/lib/progress/calculate'

const LESSONS = ['a', 'b', 'c', 'd']

describe('summarizeProgress', () => {
  it('counts completed lessons out of all lessons, as a whole percent', () => {
    expect(summarizeProgress(LESSONS, new Set(['a']))).toEqual({
      completed: 1,
      total: 4,
      percent: 25,
    })
    expect(summarizeProgress(LESSONS, new Set(['a', 'b', 'c']))).toMatchObject({ percent: 75 })
    // rounds down: 1 of 3 is 33%, never 34%
    expect(summarizeProgress(['a', 'b', 'c'], new Set(['a']))).toMatchObject({ percent: 33 })
  })

  it('is 0% with nothing done, 100% with everything done, and 0 for a course with no lessons', () => {
    expect(summarizeProgress(LESSONS, new Set())).toMatchObject({ completed: 0, percent: 0 })
    expect(summarizeProgress(LESSONS, new Set(LESSONS))).toMatchObject({
      completed: 4,
      percent: 100,
    })
    expect(summarizeProgress([], new Set())).toEqual({ completed: 0, total: 0, percent: 0 })
  })

  it('ignores completed lessons that are no longer in the course, so it never passes 100%', () => {
    const result = summarizeProgress(['a', 'b'], new Set(['a', 'b', 'deleted-lesson']))
    expect(result).toEqual({ completed: 2, total: 2, percent: 100 })
  })
})

describe('resumeAt', () => {
  it('starts at the first lesson when nothing is done', () => {
    expect(resumeAt(LESSONS, new Set())).toEqual({ lessonId: 'a', state: 'start' })
  })

  it('continues at the first lesson not completed, in course order', () => {
    expect(resumeAt(LESSONS, new Set(['a', 'b']))).toEqual({ lessonId: 'c', state: 'continue' })
    // a gap: the student skipped b, so that is where they continue
    expect(resumeAt(LESSONS, new Set(['a', 'c']))).toEqual({ lessonId: 'b', state: 'continue' })
  })

  it('offers a review from the first lesson once everything is completed', () => {
    expect(resumeAt(LESSONS, new Set(LESSONS))).toEqual({ lessonId: 'a', state: 'review' })
  })

  it('has nowhere to go when the course has no lessons', () => {
    expect(resumeAt([], new Set())).toBeNull()
  })
})
