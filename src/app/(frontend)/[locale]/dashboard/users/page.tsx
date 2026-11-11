import { isSuperadmin } from '@/access/roles'
import { UserManager } from '@/components/dashboard/UserManager'
import { listUsers } from '@/lib/dashboard/queries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>
}

export default async function DashboardUsersPage({ searchParams }: PageProps) {
  const [user, { q }] = await Promise.all([
    requireDashboardUser('superadmin', 'manager'),
    searchParams,
  ])
  const search = typeof q === 'string' ? q : ''

  return (
    <UserManager
      users={await listUsers(user, search)}
      currentUserId={user.id}
      canManage={isSuperadmin(user)}
      search={search}
    />
  )
}
