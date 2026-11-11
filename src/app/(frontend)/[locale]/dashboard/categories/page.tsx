import { CategoryManager } from '@/components/dashboard/CategoryManager'
import { listCategoryOptions } from '@/lib/dashboard/queries'
import { requireDashboardUser } from '@/lib/dashboard/requireUser'

export default async function DashboardCategoriesPage() {
  await requireDashboardUser('superadmin', 'manager')
  return <CategoryManager categories={await listCategoryOptions()} />
}
