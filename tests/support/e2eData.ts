// The people and the course the browser test uses. Shared by the seed script and the test.

export const E2E = {
  password: 'test-password-123',
  owner: 'owner@e2e.test',
  /** A second owner, who is not the master. */
  owner2: 'owner2@e2e.test',
  manager: 'manager@e2e.test',
  doctor: 'doctor@e2e.test',
  student: 'student@e2e.test',
  courseTitle: 'E2E Course',
  courseSlug: 'e2e-course',
  previewLesson: 'E2E Lesson 1',
  lockedLesson: 'E2E Lesson 2',
  previewVideoId: 'E2EPREVIEW1',
  lockedVideoId: 'E2ELOCKED02',
} as const
