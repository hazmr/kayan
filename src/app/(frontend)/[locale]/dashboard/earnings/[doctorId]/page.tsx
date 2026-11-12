import { notFound } from 'next/navigation'

import { isSuperadmin } from '@/access/roles'
import { EarningsView } from '@/components/dashboard/EarningsView'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'
import { getOwnerEarnings } from '@/lib/earnings/getOwnerEarnings'
import { AppError } from '@/lib/errors/AppError'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PageProps {
  params: Promise<{ doctorId: string }>
}

// One doctor's earnings, for the owner only (who is also the only one who records payouts).
export default async function DoctorEarningsPage({ params }: PageProps) {
  const [user, { doctorId }] = await Promise.all([requireDashboardUser('superadmin'), params])
  if (!UUID.test(doctorId)) notFound()

  const data = await getOwnerEarnings(user, doctorId).catch((error: unknown) => {
    if (error instanceof AppError && error.code === 'NOT_FOUND') return null
    throw error
  })
  if (!data) notFound()

  return <EarningsView data={data} canManage={isSuperadmin(user)} showDoctor />
}
