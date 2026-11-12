// Adds one big FREE demo course (6 modules x 6 lessons) so you can try the player, the lesson
// list, the progress tracker, and the catalog with real amounts of content. Development only.
//
//   pnpm demo:seed
//
// Optional: DEMO_DOCTOR_EMAIL=someone@example.com picks the doctor who owns it (default: the first
// doctor account). Run it again and it does nothing if the course already exists. To remove it,
// archive or delete it in the dashboard.
//
// The videos are all the same short public YouTube clip: replace the video ids in the dashboard
// when you have real lessons. The course is free so any student can enroll with one click.

import config from '@payload-config'
import { getPayload } from 'payload'

const SLUG = 'demo-large-course'
const VIDEO_ID = 'jNQXAC9IVRw'

const MODULES: {
  ar: string
  en: string
  lessons: { ar: string; en: string; minutes: number }[]
}[] = [
  {
    ar: 'مقدمة وأساسيات الفحص',
    en: 'Introduction and examination basics',
    lessons: [
      { ar: 'مرحباً بك في الدورة', en: 'Welcome to the course', minutes: 6 },
      { ar: 'أدوات العيادة البيطرية', en: 'Tools of the veterinary clinic', minutes: 14 },
      { ar: 'التعامل مع الحيوان والتثبيت الآمن', en: 'Safe handling and restraint', minutes: 18 },
      { ar: 'أخذ التاريخ المرضي', en: 'Taking the history', minutes: 12 },
      { ar: 'الفحص السريري الشامل', en: 'The full clinical examination', minutes: 22 },
      { ar: 'قياس العلامات الحيوية', en: 'Measuring vital signs', minutes: 15 },
    ],
  },
  {
    ar: 'أمراض القطط الشائعة',
    en: 'Common cat diseases',
    lessons: [
      { ar: 'أمراض الجهاز التنفسي العلوي', en: 'Upper respiratory disease', minutes: 17 },
      { ar: 'أمراض الكلى المزمنة', en: 'Chronic kidney disease', minutes: 21 },
      { ar: 'فرط نشاط الغدة الدرقية', en: 'Hyperthyroidism', minutes: 16 },
      { ar: 'السكري عند القطط', en: 'Diabetes in cats', minutes: 19 },
      { ar: 'أمراض الجهاز الهضمي', en: 'Gastrointestinal disease', minutes: 20 },
      { ar: 'الطفيليات الداخلية والخارجية', en: 'Internal and external parasites', minutes: 13 },
    ],
  },
  {
    ar: 'أمراض الكلاب الشائعة',
    en: 'Common dog diseases',
    lessons: [
      { ar: 'برنامج التطعيمات', en: 'The vaccination programme', minutes: 12 },
      { ar: 'فيروس البارفو', en: 'Parvovirus', minutes: 18 },
      { ar: 'أمراض المفاصل والعظام', en: 'Joint and bone disease', minutes: 23 },
      { ar: 'أمراض الجلد والحساسية', en: 'Skin disease and allergy', minutes: 20 },
      { ar: 'أمراض القلب', en: 'Heart disease', minutes: 25 },
      { ar: 'رعاية الكلاب المسنة', en: 'Caring for senior dogs', minutes: 14 },
    ],
  },
  {
    ar: 'التشخيص بالأشعة والمختبر',
    en: 'Imaging and laboratory diagnosis',
    lessons: [
      { ar: 'أساسيات الأشعة السينية', en: 'X-ray basics', minutes: 19 },
      { ar: 'قراءة صور الصدر', en: 'Reading chest films', minutes: 22 },
      { ar: 'قراءة صور البطن', en: 'Reading abdominal films', minutes: 21 },
      { ar: 'الموجات فوق الصوتية للمبتدئين', en: 'Ultrasound for beginners', minutes: 24 },
      { ar: 'تحليل الدم الكامل', en: 'The complete blood count', minutes: 17 },
      { ar: 'الكيمياء الحيوية وتفسيرها', en: 'Biochemistry and how to read it', minutes: 20 },
    ],
  },
  {
    ar: 'التخدير والجراحة',
    en: 'Anaesthesia and surgery',
    lessons: [
      { ar: 'تقييم ما قبل التخدير', en: 'Pre-anaesthetic assessment', minutes: 15 },
      { ar: 'بروتوكولات التخدير الآمنة', en: 'Safe anaesthetic protocols', minutes: 23 },
      {
        ar: 'التعقيم وتجهيز غرفة العمليات',
        en: 'Sterility and preparing the theatre',
        minutes: 16,
      },
      { ar: 'التعقيم الجراحي: الخطوات', en: 'Spay and neuter: the steps', minutes: 28 },
      { ar: 'الغُرز وإغلاق الجروح', en: 'Sutures and closing wounds', minutes: 18 },
      { ar: 'الرعاية بعد الجراحة', en: 'Post-operative care', minutes: 12 },
    ],
  },
  {
    ar: 'إدارة العيادة والتواصل',
    en: 'Running the clinic and communication',
    lessons: [
      { ar: 'التحدث مع أصحاب الحيوانات', en: 'Talking with pet owners', minutes: 13 },
      { ar: 'تسعير الخدمات بشكل عادل', en: 'Pricing services fairly', minutes: 11 },
      { ar: 'السجلات الطبية المنظمة', en: 'Keeping good medical records', minutes: 10 },
      { ar: 'التعامل مع الحالات الصعبة', en: 'Handling difficult cases', minutes: 15 },
      { ar: 'التعليم المستمر وبناء السمعة', en: 'Continuing education and reputation', minutes: 9 },
      { ar: 'ملخص الدورة وخطوتك القادمة', en: 'Course summary and your next step', minutes: 7 },
    ],
  },
]

const payload = await getPayload({ config })

const existing = await payload.find({
  collection: 'courses',
  where: { slug: { equals: SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
if (existing.totalDocs > 0) {
  console.log('The demo course already exists. Nothing was changed.')
  process.exit(0)
}

const wanted = process.env.DEMO_DOCTOR_EMAIL?.trim().toLowerCase()
const doctors = await payload.find({
  collection: 'users',
  where: wanted ? { email: { equals: wanted } } : { role: { equals: 'admin' } },
  sort: 'createdAt',
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const doctor = doctors.docs[0]
if (!doctor || doctor.role !== 'admin') {
  console.error('No doctor account found. Create one first, or set DEMO_DOCTOR_EMAIL to a doctor.')
  process.exit(1)
}

const categories = await payload.find({ collection: 'categories', limit: 1, depth: 0 })

const course = await payload.create({
  collection: 'courses',
  data: {
    title: 'الطب البيطري العملي: من الفحص إلى الجراحة (دورة تجريبية كبيرة)',
    description:
      'دورة تجريبية كبيرة تضم ٣٦ درساً في ٦ وحدات: الفحص السريري، أمراض القطط والكلاب، الأشعة والمختبر، التخدير والجراحة، وإدارة العيادة.\n\nاستخدمها لتجربة المشغّل وتتبع التقدم وقائمة الدروس.',
    owner: doctor.id,
    price: 0,
    ownerSharePercent: 70,
    ...(categories.docs[0] ? { category: categories.docs[0].id } : {}),
    slug: SLUG,
    status: 'draft',
  },
  locale: 'ar',
  overrideAccess: true,
})
await payload.update({
  collection: 'courses',
  id: course.id,
  data: {
    title: 'Practical veterinary medicine: from examination to surgery (big demo course)',
    description:
      'A big demo course with 36 lessons in 6 modules: clinical examination, cat and dog diseases, imaging and laboratory, anaesthesia and surgery, and running the clinic.\n\nUse it to try the player, the progress tracker, and the lesson list.',
  },
  locale: 'en',
  overrideAccess: true,
})

let lessonCount = 0
for (const [moduleIndex, moduleData] of MODULES.entries()) {
  const created = await payload.create({
    collection: 'modules',
    data: { title: moduleData.ar, course: course.id, position: moduleIndex + 1 },
    locale: 'ar',
    overrideAccess: true,
  })
  await payload.update({
    collection: 'modules',
    id: created.id,
    data: { title: moduleData.en },
    locale: 'en',
    overrideAccess: true,
  })

  for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: lessonData.ar,
        module: created.id,
        position: lessonIndex + 1,
        videoProvider: 'youtube',
        videoId: VIDEO_ID,
        durationSeconds: lessonData.minutes * 60,
        // Only the very first lesson is an open preview; the rest need enrolling.
        isFreePreview: moduleIndex === 0 && lessonIndex === 0,
      },
      locale: 'ar',
      overrideAccess: true,
    })
    await payload.update({
      collection: 'lessons',
      id: lesson.id,
      data: { title: lessonData.en },
      locale: 'en',
      overrideAccess: true,
    })
    lessonCount += 1
  }
}

// Status is closed to the API, so the script sets it directly, like the test helpers do.
await payload.update({
  collection: 'courses',
  id: course.id,
  data: { status: 'published' },
  locale: 'ar',
  overrideAccess: true,
})

console.log(
  `Demo course created and published: ${lessonCount} lessons in ${MODULES.length} modules, owned by ${doctor.email}.`,
)
console.log(`Open it at /ar/courses/${SLUG} (free: any student account can enroll).`)
process.exit(0)
