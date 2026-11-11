import { createNavigation } from 'next-intl/navigation'

import { routing } from './routing'

// Use these instead of next/link and next/navigation on the public site.
// They add the current locale to every link and redirect for you.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
