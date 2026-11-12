// Dr. Hassan Helal's YouTube channel (youtube.com/@hassanhelal): the teaching playlists from the
// "Video Playlist Guide" (compiled 12 November 2026), kept as 13 courses in 4 categories. Left out
// on purpose: event, greeting, TV-program and activism videos, duplicate recordings, and bonus
// clips. Used by `pnpm seed`. Prices are placeholders for testing (0 means free). Video titles are
// as on YouTube; the guide gives no durations, so the seed uses a placeholder.

export interface SeedVideo {
  title: string
  /** Upload date on YouTube, YYYY-MM-DD. */
  uploaded: string
  /** The 11-character YouTube video id. */
  videoId: string
}

export interface SeedPlaylist {
  /** The playlist's number in the guide (kept so the seed can refer to it). */
  number: number
  /** Which part (category) it belongs to. */
  part: number
  titleAr: string
  titleEn: string
  descriptionAr: string
  descriptionEn: string
  /** Whole pounds; 0 is a free course. A placeholder for testing. */
  priceEgp: number
  /** In the recommended playing order. */
  videos: SeedVideo[]
}

export const SEED_PARTS: { number: number; ar: string; en: string }[] = [
  {
    number: 1,
    en: 'Study & Career',
    ar: 'الدراسة والمهنة',
  },
  {
    number: 2,
    en: 'Poultry Production & Farming',
    ar: 'إنتاج وتربية الدواجن',
  },
  {
    number: 3,
    en: 'Pigeons & Small Animals',
    ar: 'الحمام والحيوانات الصغيرة',
  },
  {
    number: 4,
    en: 'Public Health',
    ar: 'الصحة العامة',
  },
]

export const SEED_PLAYLISTS: SeedPlaylist[] = [
  {
    number: 1,
    part: 1,
    titleEn: 'Simplified Histology - Complete Cytology Course',
    titleAr: 'تبسيط الهستولوجيا - كورس السيتولوجيا الكامل',
    descriptionEn:
      'University-level cytology lectures, from the cell membrane to cell inclusions. Watch in lecture order 1-15.',
    descriptionAr:
      'محاضرات السيتولوجيا على مستوى الجامعة، من الغشاء الخلوي حتى مشتملات الخلية. شاهدها بترتيب المحاضرات من 1 إلى 15.',
    priceEgp: 300,
    videos: [
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 1 introduction',
        uploaded: '2020-11-20',
        videoId: '5Iu5mCkFaGc',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 2 the cell',
        uploaded: '2020-11-20',
        videoId: 'ikzCIZU0vIg',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 3 cytoplasm',
        uploaded: '2020-11-20',
        videoId: 'P108qNpLJsI',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 4 cell constituents',
        uploaded: '2020-11-20',
        videoId: 'X_eCc6C_l3g',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 5 cell membrane',
        uploaded: '2020-11-20',
        videoId: 'KxHzcA_nUtI',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 6 mitochondria',
        uploaded: '2020-11-20',
        videoId: 'FOFzdFoktt8',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 7 rER',
        uploaded: '2020-11-20',
        videoId: '3pdpLOwR3Pg',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 8 sER',
        uploaded: '2020-11-20',
        videoId: '7KDeHiTa_KU',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 9 golgi app',
        uploaded: '2020-11-20',
        videoId: 'I4fDFrUc_Ds',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 10 lysosome',
        uploaded: '2020-11-20',
        videoId: '7YBgstR-rZk',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 11 Ribosomes',
        uploaded: '2020-11-20',
        videoId: 'j-oWk_OvCAo',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 12 cytoskeleton',
        uploaded: '2020-11-20',
        videoId: 'GI0SUUeXj7g',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 13 inclusions',
        uploaded: '2020-11-20',
        videoId: '7Wd3Ndo109w',
      },
      {
        title: 'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 14 nucleus',
        uploaded: '2020-11-20',
        videoId: 'NCUkOX4_h6w',
      },
      {
        title:
          'تبسيط الهستولوجى للدكتور حسن هلال السيتولوجى محاضرة 15 الاخيرة modifications of cell constituents',
        uploaded: '2020-11-20',
        videoId: 'aOiMuILpKck',
      },
    ],
  },
  {
    number: 3,
    part: 1,
    titleEn: "Understanding Farmers' Slang",
    titleAr: 'دليل فهم مصطلحات الفلاحين',
    descriptionEn: "Local farmers' terminology every field vet needs to understand.",
    descriptionAr: 'مصطلحات الفلاحين المحلية التي يحتاج كل طبيب بيطري ميداني إلى فهمها.',
    priceEgp: 0,
    videos: [
      {
        title: 'دليل الاطباء البيطرين لفهم مصطلحات الفلاحين للدكتور حسن هلال جزء 1',
        uploaded: '2019-05-06',
        videoId: 'BGhl6pri4Tg',
      },
      {
        title: 'دليل الاطباء البيطرين لفهم مصطلحات الفلاحين للدكتور حسن هلال جزء 2',
        uploaded: '2019-05-06',
        videoId: '9sdbDMP8j5c',
      },
      {
        title: 'دليل الاطباء البيطرين لفهم مصطلحات الفلاحين للدكتور حسن هلال جزء 3',
        uploaded: '2019-05-07',
        videoId: 'feudDIlyojI',
      },
      {
        title: 'دليل الاطباء البيطرين لفهم مصطلحات الفلاحين للدكتور حسن هلال جزء 4',
        uploaded: '2019-05-07',
        videoId: '2CA76FVIkYY',
      },
    ],
  },
  {
    number: 4,
    part: 2,
    titleEn: 'Poultry Investment - Full Lecture Series',
    titleAr: 'الاستثمار في مجال الدواجن - المحاضرات الكاملة',
    descriptionEn: 'An 8-lecture course on investing in the poultry business.',
    descriptionAr: 'كورس من 8 محاضرات عن الاستثمار في مشروعات الدواجن.',
    priceEgp: 500,
    videos: [
      {
        title: 'الاستثمار فى مجال الدواجن للدكتور حسن هلال المحاضرة الاولى',
        uploaded: '2017-11-20',
        videoId: '0lJJ3UWcqcs',
      },
      {
        title: 'الاستثمار فى مجال الدواجن للدكتور حسن هلال المحاضرة الثانية',
        uploaded: '2017-11-20',
        videoId: 'iNsY49uTMQ8',
      },
      {
        title: 'الاستثمار فى مجال الدواجن للدكتور حسن هلال المحاضرة الثالثة',
        uploaded: '2017-11-20',
        videoId: 'l0q3QNCN0GQ',
      },
      {
        title: 'الاستثمار فى مجال الدواجن للدكتور حسن هلال المحاضرة الرابعة',
        uploaded: '2017-11-21',
        videoId: '4CTDO4Xa2vQ',
      },
      {
        title: 'الاستثمار فى مجال الدواجن للدكتور حسن هلال المحاضرة الخامسة',
        uploaded: '2017-11-21',
        videoId: 'Cox7MALjDRs',
      },
      {
        title: 'الاستثمار فى مجال الدواجن للدكتور حسن هلال المحاضرة السادسة',
        uploaded: '2017-11-21',
        videoId: 'C2i3ZCEoUSE',
      },
      {
        title: 'الاستثمار فى مجال الدواجن للدكتور حسن هلال المحاضرة السابعة',
        uploaded: '2017-11-21',
        videoId: 'viXfgg_SNOo',
      },
      {
        title: 'الاستثمار فى مجال الدواجن للدكتور حسن هلال المحاضرة الثامنة',
        uploaded: '2017-11-22',
        videoId: '3mFmMOMwh08',
      },
    ],
  },
  {
    number: 5,
    part: 2,
    titleEn: 'Building a Poultry Farm',
    titleAr: 'تأسيس مزارع الدواجن - التصميم والمستلزمات ودراسة الجدوى',
    descriptionEn: 'Farm types, housing design, equipment, feasibility and a real farm visit.',
    descriptionAr:
      'أنواع المزارع، وتصميم العنابر، والمستلزمات، ودراسة الجدوى، مع زيارة لمزرعة حقيقية.',
    priceEgp: 400,
    videos: [
      {
        title: 'موسوعة الدواجن للدكتور حسن هلال تصميم عنابر الدواجن',
        uploaded: '2012-01-16',
        videoId: 'yaGeEk8kms0',
      },
      {
        title: 'موسوعة الدواجن للدكتور حسن هلال الرعاية ودراسة الجدوى1',
        uploaded: '2012-02-02',
        videoId: 'PNnXIC3AHQw',
      },
      {
        title: 'موسوعة الدواجن للدكتور حسن هلال الرعاية ودراسة الجدوى2',
        uploaded: '2012-02-02',
        videoId: 'BEj-kTdbPg0',
      },
      {
        title: 'زيارة لمزرعة دواجن لتوضيح اسس تأسيس المزرعة الصحيحة 1',
        uploaded: '2014-02-21',
        videoId: '6u69gAvq5Jc',
      },
      {
        title: 'زيارة لمزرعة دواجن لتوضيح اسس تأسيس المزرعة الصحيحة 2',
        uploaded: '2014-02-21',
        videoId: 'gGIsEL3OzgI',
      },
      {
        title: 'معلومات سريعة عن انواع ومستلزمات وتصميم عنابر الدواجن للدكتور حسن هلال',
        uploaded: '2018-07-27',
        videoId: 'CqXpXixqJOU',
      },
      {
        title: 'انواع ومستلزمات مزارع الدواجن الحديثة والعادية للدكتور حسن هلال 1',
        uploaded: '2018-07-29',
        videoId: 'ruLtUFvA15s',
      },
      {
        title: 'انواع ومستلزمات مزارع الدواجن الحديثة والعادية للدكتور حسن هلال 2',
        uploaded: '2018-07-29',
        videoId: 'dBOISEDe13g',
      },
      {
        title: 'انواع ومستلزمات مزارع الدواجن الحديثة والعادية للدكتور حسن هلال 3',
        uploaded: '2018-07-29',
        videoId: 'Qb83cLdI8V0',
      },
      {
        title: 'انواع ومستلزمات مزارع الدواجن الحديثة والعادية للدكتور حسن هلال 4',
        uploaded: '2018-07-30',
        videoId: 'aEfQjh-oca4',
      },
      {
        title: 'انواع ومستلزمات مزارع الدواجن الحديثة والعادية للدكتور حسن هلال 5',
        uploaded: '2018-07-30',
        videoId: 'h6rzAjFMhDc',
      },
    ],
  },
  {
    number: 6,
    part: 2,
    titleEn: 'Broiler Farmer Tips',
    titleAr: 'نصائح لمربي دواجن التسمين',
    descriptionEn: 'Practical day-to-day tips for broiler producers.',
    descriptionAr: 'نصائح عملية يومية لمربي دواجن التسمين.',
    priceEgp: 150,
    videos: [
      {
        title: 'نصائح لعزيزى مربى دواجن التسمين جزء اول',
        uploaded: '2014-03-31',
        videoId: '4LZnmRdtZbo',
      },
      {
        title: 'نصائح لعزيزى مربى دواجن التسمين جزء ثانى',
        uploaded: '2014-03-31',
        videoId: 'QKFB5atB-Yo',
      },
      {
        title: 'نصائح لعزيزى مربى دواجن التسمين جزء ثالث',
        uploaded: '2014-03-31',
        videoId: '6GwrqNUO-Kk',
      },
      {
        title: 'نصائح لعزيزى مربى دواجن التسمين جزء رابع',
        uploaded: '2014-03-31',
        videoId: 'UHlCD8rc928',
      },
      {
        title: 'نمو الكتاكيت وتطعيمها ضد الامراض وكيف تصبح فرخة',
        uploaded: '2018-07-30',
        videoId: 'BYx80JvtWoc',
      },
    ],
  },
  {
    number: 7,
    part: 2,
    titleEn: 'Human Errors in Poultry Projects',
    titleAr: 'الأخطاء البشرية في مشاريع الدواجن وكيفية تجنبها',
    descriptionEn:
      'Common owner mistakes: chicks, feed, medicines and care - and how to avoid them.',
    descriptionAr:
      'أخطاء أصحاب المشاريع الشائعة في الكتاكيت والأعلاف والأدوية والرعاية، وكيفية تجنبها.',
    priceEgp: 250,
    videos: [
      {
        title: 'الاخطاء البشرية فى مشاريع الدواجن وكيفية تجنبها اولا الكتاكيت',
        uploaded: '2019-10-07',
        videoId: '8_w7bSDVYGE',
      },
      {
        title: 'الاخطاء البشرية فى مشاريع الدواجن وكيفية تجنبها ثانيا الاعلاف',
        uploaded: '2019-11-22',
        videoId: 'yVk9nmTHJr8',
      },
      {
        title: 'الاخطاء البشرية فى مشاريع الدواجن وكيفية تجنبها ثالثا الادوية 1',
        uploaded: '2019-11-22',
        videoId: '68daBjmxJDA',
      },
      {
        title: 'الاخطاء البشرية فى مشاريع الدواجن وكيفية تجنبهما ثالثا الادوية 2',
        uploaded: '2019-11-22',
        videoId: 'QUcy5xtuVpA',
      },
      {
        title: 'الاخطاء البشرية فى مشاريع الدواجن وكيفية تجنبهما ثالثا الادوية 3',
        uploaded: '2019-11-22',
        videoId: 'lqWFTWMjo3Q',
      },
      {
        title: 'الاخطاء البشرية فى مشاريع الدواجن وكيفية تجنبها رابعا الرعاية 1',
        uploaded: '2019-11-22',
        videoId: '4YKEs_iEdTo',
      },
    ],
  },
  {
    number: 8,
    part: 2,
    titleEn: 'Disinfection & Disinfectants',
    titleAr: 'التعقيم والتطهير والمطهرات',
    descriptionEn:
      'Farm biosecurity: disinfectants for poultry farms, then the 2020 disinfection lecture in three parts.',
    descriptionAr:
      'الأمن الحيوي للمزارع: مطهرات مزارع الدواجن، ثم محاضرة التطهير لعام 2020 في ثلاثة أجزاء.',
    priceEgp: 200,
    videos: [
      {
        title: 'مطهرات مزارع الدواجن جزء اول',
        uploaded: '2012-07-04',
        videoId: 'hbOyAyUePXs',
      },
      {
        title: 'مطهرات مزارع الدواجن جزء ثانى',
        uploaded: '2012-07-04',
        videoId: 'k_lAHXDik8M',
      },
      {
        title: 'التطهير والمطهرات الجزء الاول للدكتور حسن هلال',
        uploaded: '2020-04-12',
        videoId: 'MR7gH8-f-JU',
      },
      {
        title: 'التطهير والمطهرات الجزء الثاني للدكتور حسن هلال',
        uploaded: '2020-04-12',
        videoId: 'PSubaJOKucQ',
      },
      {
        title: 'التطهير والمطهرات الجزء الثالث للدكتور حسن هلال',
        uploaded: '2020-04-12',
        videoId: 'ktBC2edg8Xs',
      },
    ],
  },
  {
    number: 9,
    part: 2,
    titleEn: 'Poultry Immunity with Prof. Ismail Rahil',
    titleAr: 'مناعة الدواجن مع د. إسماعيل رحيل',
    descriptionEn: 'Immunity lectures and a TV episode with Professor Ismail Rahil.',
    descriptionAr: 'محاضرات عن مناعة الدواجن وحلقة تلفزيونية مع الأستاذ الدكتور إسماعيل رحيل.',
    priceEgp: 200,
    videos: [
      {
        title: 'مناعة الدواجن د اسماعيل رحيل ود حسن هلال1',
        uploaded: '2012-01-15',
        videoId: 'wwqzTCis3ic',
      },
      {
        title: 'مناعة الدواجن د اسماعيل رحيل ود حسن هلال 2',
        uploaded: '2012-01-15',
        videoId: 'p8JZM_AWDBg',
      },
      {
        title: 'مناعة الدواجن د اسماعيل رحيل ود حسن هلال 3',
        uploaded: '2012-01-16',
        videoId: '93GWVoIE9R4',
      },
      {
        title: 'محاضرة مناعة دواجن للاستاذ الدكتور اسماعيل رحيل',
        uploaded: '2015-06-18',
        videoId: 'Y89BikMNMpQ',
      },
      {
        title: 'حلقة تلفيزيونية عن المناعة سنة 2011 مع الاستاذ الدكتور اسماعيل رحيل',
        uploaded: '2022-09-05',
        videoId: '0AyEWjZXy1k',
      },
    ],
  },
  {
    number: 10,
    part: 2,
    titleEn: 'Avian Influenza & Outbreaks',
    titleAr: 'إنفلونزا الطيور والوباءات',
    descriptionEn: 'Bird flu signs, human risk, swine flu link and outbreak management.',
    descriptionAr:
      'علامات إنفلونزا الطيور، وخطرها على الإنسان، وعلاقتها بإنفلونزا الخنازير، والتعامل مع الوباءات.',
    priceEgp: 150,
    videos: [
      {
        title: 'انفلونزا الطيور مع دكتور مجدى القاضى ود حسن هلال 1',
        uploaded: '2012-01-19',
        videoId: '47wGhjw0BFI',
      },
      {
        title: 'انفلونزا الطيور مع دكتور مجدى القاضى ود حسن هلال 2',
        uploaded: '2012-01-19',
        videoId: '6ra9P0lwZ2g',
      },
      {
        title: 'رئيس الهيئة البيطريه و انفلونزا الطيور',
        uploaded: '2012-09-19',
        videoId: 'Ef0pa1FQ_kc',
      },
      {
        title: 'انفلونزا الخنازير وانفلونزا الطيور وانفلونزا الانسان والعلاقة بينهم',
        uploaded: '2014-02-20',
        videoId: 'slk1gflcFMY',
      },
      {
        title: 'شكل الفراخ المنزلية المصابة بأنفلونزا الطيور',
        uploaded: '2018-05-06',
        videoId: 'fQBDNuxb_do',
      },
      {
        title: 'ما هو الخطأ القاتل الذى قد يصيب ستات البيوت بمرض انفلونزا الطيور الخطير',
        uploaded: '2018-05-18',
        videoId: 'XTtC6_KbF-I',
      },
    ],
  },
  {
    number: 12,
    part: 3,
    titleEn: 'The Pigeon Raising Project',
    titleAr: 'مشروع تربية الحمام',
    descriptionEn:
      'The complete pigeon raising project lecture in six parts, from planning to nutrition, diseases and vaccination.',
    descriptionAr:
      'محاضرة مشروع تربية الحمام كاملة في ستة أجزاء، من التخطيط حتى التغذية والأمراض والتحصينات.',
    priceEgp: 350,
    videos: [
      {
        title: 'الجزء الاول من محاضرة عن مشروع تربية الحمام للدكتور حسن هلال',
        uploaded: '2018-09-29',
        videoId: 'WFQBvJdmLOU',
      },
      {
        title: 'الجزء الثانى من محاضرة عن مشروع تربية الحمام للدكتور حسن هلال',
        uploaded: '2018-09-29',
        videoId: 'd3wqIFZdGK8',
      },
      {
        title: 'الجزء الثالث من محاضرة عن مشروع تربية الحمام للدكتور حسن هلال',
        uploaded: '2018-09-29',
        videoId: 'Yj51cxdpAqY',
      },
      {
        title: 'الجزء الرابع من محاضرة عن مشروع تربية الحمام للدكتور حسن هلال',
        uploaded: '2018-10-01',
        videoId: '2wxs9DOiO3I',
      },
      {
        title: 'الجزء الخامس من محاضرة عن مشروع تربية الحمام للدكتور حسن هلال (التغذية)',
        uploaded: '2018-10-01',
        videoId: '-HbNOW_MZkw',
      },
      {
        title: 'الجزء السادس من محاضرة عن مشروع تربية الحمام للدكتور حسن هلال (الامراض والتحصينات)',
        uploaded: '2018-10-01',
        videoId: 'h8b0-Xd1OnA',
      },
    ],
  },
  {
    number: 13,
    part: 3,
    titleEn: 'The Art of Injection & Blood Sampling',
    titleAr: 'فن الحقن وسحب العينات',
    descriptionEn: 'How to inject and sample: poultry, pigeons, birds, rabbits and even snakes.',
    descriptionAr: 'طرق الحقن وسحب العينات في الدواجن والحمام والطيور والأرانب وحتى الثعابين.',
    priceEgp: 250,
    videos: [
      {
        title: 'جميع طرق الحقن للمضادات الحيوية و التحصين فى الحمام',
        uploaded: '2014-05-29',
        videoId: 'x5eo1WRy12M',
      },
      {
        title: 'طريقة الحقن العضل للدواجن للدكتور حسن هلال',
        uploaded: '2017-11-21',
        videoId: 'IheudvhaYmQ',
      },
      {
        title: 'طريقة حقن الحمام تحت الجلد للمبتدئين يشرحها دكتور حسن هلال',
        uploaded: '2017-11-22',
        videoId: 'rg9fYnRPkMk',
      },
      {
        title: 'طريقة الحقن في العصافير للدكتور حسن هلال مع الحذر الشديد من زيادة جرعة اى دواء',
        uploaded: '2018-01-09',
        videoId: '3j85H9zAQ4I',
      },
      {
        title: 'كيف تحقن الارانب وتسقيها الدواء بسهولة',
        uploaded: '2018-09-09',
        videoId: 'PFLwSiTtcTc',
      },
      {
        title: 'كيف تحقن الثعابين المريضة للدكتور حسن هلال',
        uploaded: '2018-09-28',
        videoId: 'Iikyppsg3zA',
      },
      {
        title: 'كيف احقن واحصن طيور حجمها صغير بدقة وامان للدكتور حسن هلال',
        uploaded: '2018-10-05',
        videoId: 'ogH2MuSfi_U',
      },
      {
        title: 'كيفية سحب عينة الدم من الدجاج من وريد الجناح او من القلب مباشرة للدكتور حسن هلال',
        uploaded: '2018-10-09',
        videoId: 'Gt-UtHF7KSI',
      },
    ],
  },
  {
    number: 14,
    part: 3,
    titleEn: 'Pet Care - Cats, Dogs & Rabbits',
    titleAr: 'رعاية وعلاج القطط والكلاب والأرانب',
    descriptionEn:
      'Clinical tips and treatments for pets: nails, ears, heatstroke, parvo and more.',
    descriptionAr: 'نصائح علاجية للحيوانات الأليفة: الأظافر، والأذن، وضربة الحر، والبارفو وغيرها.',
    priceEgp: 300,
    videos: [
      {
        title: 'طريقة بسيطة لتكميم الكلاب بالشاش',
        uploaded: '2017-11-21',
        videoId: 'WLXrVRzH6F8',
      },
      {
        title: 'اسهال دموى فى مرض البارفو',
        uploaded: '2017-11-21',
        videoId: 'oMqhltAR9HU',
      },
      {
        title: 'تمييز ذكور الارانب في العمر الصغير',
        uploaded: '2017-11-21',
        videoId: 'P5aA9j6AEBk',
      },
      {
        title: 'علاج التهاب العرقوب في الارانب للدكتور حسن هلال',
        uploaded: '2017-12-25',
        videoId: '8sh-F3k7nto',
      },
      {
        title: 'قص اظافر القطط بسهولة للدكتور حسن هلال',
        uploaded: '2018-01-18',
        videoId: '5g_Z9OAbX74',
      },
      {
        title: 'الدكتور البيطرى فى خمس دقائق يعالج مرض معدى فى اذن القطط',
        uploaded: '2018-01-26',
        videoId: 'jJfSciBzfAo',
      },
      {
        title: 'عزيري القط لا تأخذ هذا الدواء الدواء فيه سم قاتل',
        uploaded: '2018-02-21',
        videoId: 'DixspEyR9kE',
      },
      {
        title: 'شكل حشرة الجرب تحت الميكروسكوب',
        uploaded: '2018-05-05',
        videoId: 'taM4dV9_7wE',
      },
      {
        title: 'هل القطط بتسبب عقم للبنات فعلا والا لأ ( التوكسوبلازما )',
        uploaded: '2018-05-18',
        videoId: 'pt1_QEwGbRU',
      },
      {
        title: 'ليه الحر بيموت القطط والكلاب ولا يميت الانسان وكيف اتجنب الاحتباس الحرارى',
        uploaded: '2018-05-26',
        videoId: 'n2QC5GXmKj4',
      },
      {
        title: 'تمييز الذكر من الانثى فى القطط الصغيرة للدكتور حسن هلال',
        uploaded: '2018-10-02',
        videoId: '1wkxCX_eEWQ',
      },
      {
        title: 'تعقيم الحيوانات الأليفة الذكور بأحدث الأجهزة بعيادة د حسن هلال بالفيوم',
        uploaded: '2022-09-07',
        videoId: '7BShBFqOMOg',
      },
      {
        title: 'حالة احتباس حرارى فى قطة تم علاجها فى مستشفى ميدفيت البيطرية بالفيوم',
        uploaded: '2022-09-07',
        videoId: '2u_5oWW1628',
      },
    ],
  },
  {
    number: 16,
    part: 4,
    titleEn: 'Meat & Human Health - Farm to Table',
    titleAr: 'اللحوم وصحة الإنسان - من المزرعة إلى المائدة',
    descriptionEn:
      'Veterinary medicine, meat and human health: a three-part lecture, plus what hormones in calves and broilers really mean for consumers.',
    descriptionAr:
      'الطب البيطري واللحوم وصحة الإنسان: محاضرة في ثلاثة أجزاء، مع شرح حقيقة الهرمونات في العجول والدواجن البيضاء وأثرها على المستهلك.',
    priceEgp: 200,
    videos: [
      {
        title: 'اضرارهرمونات العجول بين الجهل والعلم',
        uploaded: '2012-10-25',
        videoId: 'L1Q6qvxzuQM',
      },
      {
        title: 'الطب البيطرى واللحوم وصحة الانسان 1',
        uploaded: '2013-06-19',
        videoId: 'KWq-uKqTGJo',
      },
      {
        title: 'الطب البيطرى واللحوم وصحة الانسان 2',
        uploaded: '2013-06-19',
        videoId: 'r0DbD2NAhm0',
      },
      {
        title: 'الطب البيطرى واللحوم وصحة الانسان 3',
        uploaded: '2013-06-19',
        videoId: 'Kv-xvq2Jb-0',
      },
      {
        title: 'هل الفراخ البيضاء بتاخذ هرمونات للدكتور حسن هلال',
        uploaded: '2017-05-07',
        videoId: 'nNmwZg171Fk',
      },
    ],
  },
]
