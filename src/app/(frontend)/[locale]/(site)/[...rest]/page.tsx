import { notFound } from 'next/navigation'

// Catches every unknown URL under a locale and shows the translated 404 page above.
export default function CatchAllPage() {
  notFound()
}
