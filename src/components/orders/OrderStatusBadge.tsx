import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import type { OrderStatus } from '@/lib/orders/transitions'

const VARIANT: Record<OrderStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  awaiting_review: 'secondary',
  paid: 'default',
  rejected: 'destructive',
  refunded: 'secondary',
  cancelled: 'outline',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('orderStatus')
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>
}
