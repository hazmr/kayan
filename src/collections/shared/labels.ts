/** Admin panel text in both interface languages. */
export function label(en: string, ar: string): { en: string; ar: string } {
  return { en, ar }
}

/** Singular and plural names for a collection, in both languages. */
export function collectionLabels(
  singular: [en: string, ar: string],
  plural: [en: string, ar: string],
): { singular: { en: string; ar: string }; plural: { en: string; ar: string } } {
  return { singular: label(...singular), plural: label(...plural) }
}
