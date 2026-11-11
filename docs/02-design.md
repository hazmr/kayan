# Phase 2: Design

Status: waiting for approval. No application code has been written.

The code blocks in this document are design sketches that show the shape of each piece. The real code is written in the milestones.

## 1. Versions (checked on 2026-11-11)

| Tool | Version | Source |
|------|---------|--------|
| Payload CMS | 3.93.0 | npm registry |
| Next.js | 16.4.6 | npm registry. Payload 3.93 supports Next 16.3.3 and later. |
| Node.js | 26.13.0 on this machine | Payload needs 22.23.4+ or 24.22.1+. |
| Tailwind CSS | 4.3.5 | npm registry |
| Package manager | pnpm 12.18.0 | Installed through mise. Payload's preferred package manager. |

One thing that differs from older tutorials: in Next.js 16 the request interceptor file is `src/proxy.ts`. It used to be `middleware.ts`.

## 2. Architecture

```
  Student's browser                         Staff browser (/admin)
     |             |                               |
     | page load   | button click                  | button click
     v             v                               v
+----------------+ +--------------------------------------------+
| Server         | | Custom endpoints   POST /api/orders/...    |
| Components     | | (thin: check login, read input, call lib)  |
+----------------+ +--------------------------------------------+
     |                              |
     | read through                 | every state change goes through
     | src/lib/catalog              | one function in src/lib
     v                              v
+----------------------------------------------------------------+
| src/lib   orders/  courses/  enrollments/  earnings/  catalog/  |
|           (business rules, transactions, error codes)           |
+----------------------------------------------------------------+
     |                  |                    |               |
     v                  v                    v               v
 Payload Local API   PaymentProvider    VideoProvider      email
     |                |       |           |       |
     v              manual  paymob     youtube  bunny
 PostgreSQL         (now)   (later)     (now)   (later)
```

Three rules keep this clean:

1. **Pages never change data directly.** A page reads through `src/lib/catalog` and changes data by calling an endpoint. Why: every rule lives in one place and is tested once.
2. **Status fields are never edited by hand.** `orders.status` and `courses.status` are read-only in the admin panel. Staff click a button (Approve, Reject, Publish) that calls the same endpoint a script or a webhook would. Why: a hand-edited status would skip the enrollment, the email, and the checks.
3. **Pages receive shaped objects, not raw database documents.** `src/lib/catalog` returns only the fields a visitor may see. Why: this is what guarantees a `videoId` never leaks.

```ts
// src/lib/payments/index.ts  (the only file that knows which adapters exist)
import type { PaymentProvider } from './types'
import { manualProvider } from './manual'

const providers: Partial<Record<PaymentProvider['id'], PaymentProvider>> = {
  manual: manualProvider,
  // paymob: paymobProvider,   <- adding Paymob later is this one line plus the adapter file
}

export function getPaymentProvider(id: PaymentProvider['id']): PaymentProvider {
  const provider = providers[id]
  if (!provider) throw new AppError('PAYMENT_PROVIDER_UNAVAILABLE')
  return provider
}
```

`src/lib/video/index.ts` has the same shape for `youtube` and `bunny`.

### Interfaces, with two small changes from the spec

```ts
// src/lib/video/types.ts
export interface VideoProvider {
  id: 'youtube' | 'bunny'
  getPlayback(
    videoId: string,
    ctx: { userId?: string },                 // changed: optional, because guests watch previews (D8)
  ): Promise<{ embedUrl: string; expiresAt?: Date }>
}

// src/lib/payments/types.ts
export interface PaymentProvider {
  id: 'manual' | 'paymob'
  startPayment(order: Order): Promise<
    | { kind: 'instructions'; payTo: string; amount: number; reference: string }
    | { kind: 'redirect'; url: string }
  >
  handleWebhook?(req: Request): Promise<{ orderId: string; status: 'paid' | 'failed' }>
}
```

The second change is not in the interface itself: IDs are UUID strings (see section 3), so `orderId: string` and `userId: string` are accurate as written.

## 3. Data model

Changes from the spec are marked **new** or **changed**. All IDs are UUIDs. Why: they match the `string` IDs in your interfaces and cannot be guessed by counting.

### users (auth collection)

| Field | Type | Notes |
|-------|------|-------|
| email | email | Login. Verified by link (`auth.verify`). |
| name | text, required | |
| phone | text, optional | |
| role | select: superadmin, manager, admin, student | Default `student`. Field-level access: only a superadmin can write it. |

### categories

| Field | Type | Notes |
|-------|------|-------|
| parent | relation to categories, optional | A category that has a parent cannot be a parent. |
| title | text, localized | |
| slug | text, unique | Latin letters, digits, and dashes. |

### media (public uploads)

| Field | Type | Notes |
|-------|------|-------|
| file | image | Course thumbnails. Public read. |
| alt | text, localized, optional | **new**, for accessibility. |

### courses

| Field | Type | Notes |
|-------|------|-------|
| owner | relation to users | Set to the creator. Only a superadmin can change it. |
| category | relation to categories | |
| thumbnail | relation to media | |
| title | text, localized | |
| slug | text, unique | Generated if left empty: from the English title, or `course-` plus a short code. |
| description | textarea, localized | Plain text in v1. Why: no rich-text editor or renderer to maintain. |
| price | integer, piasters, 0 or more | **changed**: 0 is allowed (D5). |
| ownerSharePercent | integer 0 to 100 | Copied from the default on creation. Superadmin only. |
| status | select: draft, in_review, published, archived | Read-only in the panel. Changed by endpoints. |
| reviewNote | textarea | **new**: the manager's note when a course is sent back. |

### modules

| Field | Type | Notes |
|-------|------|-------|
| course | relation to courses | |
| title | text, localized | |
| position | integer | |

### lessons

| Field | Type | Notes |
|-------|------|-------|
| module | relation to modules | |
| course | relation to courses | **new**: filled automatically from the module. Why: access rules check the course with one join instead of two. |
| title | text, localized | |
| position | integer | |
| videoProvider | select: youtube, bunny | |
| videoId | text | Field-level read: owner, manager, superadmin only. |
| durationSeconds | integer | |
| isFreePreview | checkbox | |

### orders

| Field | Type | Notes |
|-------|------|-------|
| user | relation to users | The buyer. |
| course | relation to courses | |
| owner | relation to users | **new**: the course owner, frozen with the amounts. Why: if a course changes owner later, past earnings stay with the doctor who earned them. |
| amount | integer, piasters | **changed**: follows the course while `pending`, frozen at first receipt (D3). |
| ownerAmount | integer, piasters | Frozen at the same moment. `amount x percent / 100`, rounded down. |
| amountFrozenAt | date | **new**: empty while the price can still change. |
| provider | select: manual, paymob | **changed**: empty for free orders. |
| method | select: instapay, vodafone_cash | Empty for free orders. Changeable while `pending`. |
| status | select: pending, awaiting_review, paid, rejected, refunded, cancelled | **changed**: `cancelled` added (D4). |
| reference | text, unique | Short code the student writes in the transfer note, such as `VT-7K3M9Q`. |
| providerRef | text, optional | For Paymob later. |
| paidAt | date | **new**: set by `fulfillOrder`. |
| refundStatus | select: none, requested, declined | **new** (D2). The order stays `paid` during a request. |
| refundReason | textarea | **new** |
| refundTo | text | **new**: the number or address to send the money back to. |
| refundRequestedAt | date | **new** |
| refundDecisionNote | textarea | **new**: the manager's note when declining. |
| refundedAt, refundedBy | date, relation to users | **new**: set by `refundOrder`. |

### receipts (private uploads, many per order)

| Field | Type | Notes |
|-------|------|-------|
| file | image: JPEG, PNG, WebP, 5 MB max | Read: the order's student, managers, superadmin. |
| order | relation to orders | |
| senderNumber | text | |
| decision | select: approved, rejected | **new**: empty until reviewed. Why: with several receipts on one order, each needs its own outcome. |
| reviewNote | textarea | Required when rejecting. |
| reviewedBy, reviewedAt | relation to users, date | |

### enrollments

| Field | Type | Notes |
|-------|------|-------|
| user | relation to users | |
| course | relation to courses | |
| order | relation to orders | The order that most recently activated it. |
| status | select: active, revoked | |

Unique index on (user, course).

### payouts

| Field | Type | Notes |
|-------|------|-------|
| owner | relation to users | |
| amount | integer, piasters | |
| paidAt | date | |
| paidBy | relation to users | Set automatically. |
| note | textarea | |

### Globals

| Global | Fields | Access |
|--------|--------|--------|
| payment-settings | instapayAddress, vodafoneCashNumber | Superadmin writes. Read on the server only when showing payment instructions. |
| platform-settings (**new**) | defaultOwnerSharePercent (default 70) | Superadmin only. Why a second global: where students pay and how revenue is split are different concerns. |

### Database safety nets

Two rules are also enforced by the database, so a bug or a double click cannot break them:

| Rule | Index |
|------|-------|
| One enrollment per student per course | Unique on `enrollments (user, course)` |
| One open order per student per course | Unique on `orders (user, course)` for rows whose status is pending, awaiting_review, or rejected. Payload cannot describe a filtered index, so this one is added by hand in a migration. To confirm in M3. |

## 4. Order states

```
                    upload receipt             approve
   +---------+   (amounts freeze here)  +-----------------+  fulfillOrder  +------+
   | pending | -----------------------> | awaiting_review | -------------> | paid |
   +---------+                          +-----------------+                +------+
     |     |                               |          ^                       |
     |     | free course:           reject |          | new receipt           | refundOrder
     |     | fulfillOrder at once          v          |                       | (money already
     |     +--------------------> paid   +----------+ |                       |  sent back)
     | cancel                            | rejected |-+                       v
     v                                   +----------+                    +----------+
   +-----------+           cancel             |                          | refunded |
   | cancelled | <----------------------------+                          +----------+
   +-----------+
```

```ts
// src/lib/orders/transitions.ts
export const ORDER_TRANSITIONS = {
  pending:         ['awaiting_review', 'paid', 'cancelled'], // 'paid' directly only when amount is 0
  awaiting_review: ['paid', 'rejected'],
  rejected:        ['awaiting_review', 'cancelled'],
  paid:            ['refunded'],
  refunded:        [],
  cancelled:       [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>

export const OPEN_ORDER_STATUSES = ['pending', 'awaiting_review', 'rejected'] as const
```

| Transition | Who | Function in `src/lib/orders` | Side effects |
|------------|-----|------------------------------|--------------|
| create (pending) | student | `startOrder` | Reuses the open order if one exists. |
| pending to awaiting_review | student | `submitReceipt` | Freezes amount, ownerAmount, owner. Emails managers. |
| rejected to awaiting_review | student | `submitReceipt` | Amounts stay frozen. Emails managers. |
| awaiting_review to paid | manager, superadmin | `fulfillOrder` | Activates the enrollment. Emails the student. |
| pending to paid | system, free course | `startOrder` calls `fulfillOrder` | Activates the enrollment. |
| awaiting_review to rejected | manager, superadmin | `rejectReceipt` | Saves the note. Emails the student. |
| pending or rejected to cancelled | student | `cancelOrder` | None. |
| paid to refunded | manager, superadmin | `refundOrder` | Revokes the enrollment. Emails the student. |

The refund request does not change `status`. It moves `refundStatus` between `none`, `requested`, and `declined` through `requestRefund`, `cancelRefundRequest`, and `declineRefund`.

### How `fulfillOrder` stays idempotent

```ts
// src/lib/orders/fulfillOrder.ts
export async function fulfillOrder(orderId: string): Promise<Order> {
  const order = await inTransaction(async (req) => {
    const order = await lockOrderRow(orderId, req)   // second caller waits here until the first finishes
    if (order.status === 'paid') return order        // already done: return, change nothing
    if (!canBeFulfilled(order)) throw new AppError('ORDER_INVALID_STATE')

    const paid = await markPaid(order, req)          // status = paid, paidAt = now
    await activateEnrollment(paid, req)              // create it, or flip revoked -> active
    return paid
  })
  await sendOrderApprovedEmail(order)                // after commit, so a failed email cannot undo a payment
  return order
}
```

Why a row lock: two managers clicking Approve at the same moment would otherwise both see `awaiting_review` and both proceed. With the lock the second one waits, then sees `paid` and returns. `refundOrder` has the same shape. The locking call uses Payload's direct database access and is to be confirmed in M3.

## 5. Course states

```
                 submit                      publish
   +-------+  (must be complete)  +-----------+          +-----------+
   | draft | -------------------> | in_review | -------> | published |
   +-------+                      +-----------+          +-----------+
       ^                                |                  |       ^
       |       send back with a note    |          archive |       | un-archive
       +--------------------------------+                  v       |
                                                         +----------+
                                                         | archived |
                                                         +----------+
```

```ts
// src/lib/courses/transitions.ts
type Actor = 'owner' | 'manager' | 'superadmin'

export const COURSE_TRANSITIONS: Record<CourseStatus, Partial<Record<CourseStatus, readonly Actor[]>>> = {
  draft:     { in_review: ['owner', 'manager', 'superadmin'] },
  in_review: { published: ['manager', 'superadmin'], draft: ['manager', 'superadmin'] },
  published: { archived:  ['manager', 'superadmin'] },
  archived:  { published: ['manager', 'superadmin'] },
}
```

| Status | Public can see it | Owner can edit content | Owner can edit price | New orders |
|--------|-------------------|------------------------|----------------------|------------|
| draft | no | yes | yes | no |
| in_review | no | yes | no | no |
| published | yes | yes, live at once | no | yes |
| archived | no, but enrolled students keep access | yes | no | no |

Hard delete is a superadmin action, allowed only when the course has no enrollments.

## 6. Who can watch a lesson

```
  request for a lesson's video
            |
            v
   free preview and course published? -- yes --> play
            | no
            v
      logged in? ------------------------ no ---> deny
            | yes
            v
   owner of the course, manager,
   or superadmin? ----------------------- yes --> play
            | no
            v
   active enrollment for the course? ---- yes --> play
            | no
            v
           deny
```

```ts
// src/lib/enrollments/canWatchLesson.ts
export async function canWatchLesson(lesson: Lesson, course: Course, user?: User): Promise<boolean> {
  if (lesson.isFreePreview && course.status === 'published') return true
  if (!user) return false
  if (isStaff(user) || course.owner === user.id) return true
  return hasActiveEnrollment(user.id, course.id)
  // a future subscription adds one line here: || hasActiveSubscription(user.id)
}
```

The lesson page is a Server Component. It calls `canWatchLesson`, then `getVideoProvider(lesson.videoProvider).getPlayback(...)`, and renders the player. There is no API endpoint that returns an embed URL, so there is nothing to call from outside.

## 7. Route map

### Public site: `src/app/(frontend)/[locale]/...`

`[locale]` is `ar` or `en`. A URL without a locale redirects to `/ar`.

| Path | Page | Who |
|------|------|-----|
| `/` | Home: categories and newest courses | everyone |
| `/courses` | Catalog, `?category=slug` filter | everyone |
| `/courses/[slug]` | Course page with outline and buy or enroll button | everyone |
| `/courses/[slug]/lessons/[lessonId]` | Lesson player | previews: everyone. Others: see section 6. |
| `/checkout/[slug]` | Choose a payment method, creates the order | logged in |
| `/orders` | My orders | logged in |
| `/orders/[reference]` | One order: payment instructions, receipt upload, status, cancel, refund request | the order's student |
| `/my-courses` | Courses I am enrolled in | logged in |
| `/account` | Name, phone, password | logged in |
| `/login`, `/register` | | guests |
| `/verify-email?token=` | Landing page for the email link | guests |
| `/forgot-password`, `/reset-password?token=` | | guests |
| `/terms`, `/privacy`, `/refund-policy` | Static pages | everyone |

### Admin panel: `/admin` (Payload)

| Area | superadmin | manager | admin (doctor) |
|------|------------|---------|----------------|
| Courses, modules, lessons, media | all | all | own |
| Categories | manage | manage | hidden, can pick one in the course form |
| Orders, receipts, enrollments | all | all | hidden |
| Earnings view (`/admin/earnings`) | any doctor | any doctor | own: sales per course, balance, payouts, buyer names (D9) |
| Payouts | create | read | through the earnings view |
| Users | manage | read | hidden |
| Payment and platform settings | manage | hidden | hidden |

Students are refused at `/admin` and sent to the public site.

Why doctors read sales through the earnings view and not the orders list: the view is built on one function that returns only name, amount, share, status, and date. That is simpler and safer than hiding a dozen fields on the orders collection one by one.

### API: `/api/...`

Built into Payload and used as is: `POST /api/users` (register), `/api/users/login`, `/api/users/logout`, `/api/users/me`, `/api/users/verify/:token`, `/api/users/forgot-password`, `/api/users/reset-password`.

Custom endpoints, each a thin wrapper around one function in `src/lib`:

| Method and path | Who | Function |
|-----------------|-----|----------|
| `POST /api/orders/start` | logged in | `startOrder` |
| `POST /api/orders/:id/method` | the order's student | `changeMethod` |
| `POST /api/orders/:id/receipt` | the order's student | `submitReceipt` |
| `POST /api/orders/:id/cancel` | the order's student | `cancelOrder` |
| `POST /api/orders/:id/approve` | manager, superadmin | `fulfillOrder` |
| `POST /api/orders/:id/reject` | manager, superadmin | `rejectReceipt` |
| `POST /api/orders/:id/refund-request` | the order's student | `requestRefund` |
| `POST /api/orders/:id/refund-request/cancel` | the order's student | `cancelRefundRequest` |
| `POST /api/orders/:id/refund-request/decline` | manager, superadmin | `declineRefund` |
| `POST /api/orders/:id/refund` | manager, superadmin | `refundOrder` |
| `POST /api/courses/:id/submit` | owner, manager, superadmin | `submitCourse` |
| `POST /api/courses/:id/publish` | manager, superadmin | `publishCourse` |
| `POST /api/courses/:id/send-back` | manager, superadmin | `sendCourseBack` |
| `POST /api/courses/:id/archive`, `/unarchive` | manager, superadmin | `archiveCourse`, `unarchiveCourse` |

Creating, updating, and deleting orders, receipts, and enrollments through Payload's generic REST routes is closed to everyone. Only the functions above write to them.

Later, Paymob adds one route: `POST /api/payments/paymob/webhook`, which calls `handleWebhook` and then `fulfillOrder`.

## 8. Access table, mapped to mechanisms

| Row in your access table | Enforced by |
|--------------------------|-------------|
| Change payment settings | Global access: superadmin |
| Create users, change roles | Field-level access on `role`. Collection create is open for registration but always produces a student. |
| Delete courses or users | Collection delete access: superadmin. Hooks refuse a course with enrollments and the last superadmin. |
| Set ownerSharePercent | Field-level access: superadmin |
| Record payouts | Collection create access: superadmin |
| Approve or reject receipts | Role check in the endpoint |
| Refund orders | Role check in the endpoint |
| Publish courses | Role check in the endpoint, plus `COURSE_TRANSITIONS` |
| Edit courses, modules, lessons | Collection update access: staff all, admin where `owner` is the user |
| Read orders | Collection read access: staff all, student own. Doctors through the earnings view. |
| Read earnings and payouts | Earnings function checks the role. Payouts read access: staff all, admin own. |
| Manage categories | Collection access: manager and superadmin write, everyone reads |

## 9. Errors

```ts
// src/lib/errors/codes.ts  (the single source of truth)
export const ERROR_CODES = {
  UNAUTHENTICATED:              401,
  FORBIDDEN:                    403,
  NOT_FOUND:                    404,
  VALIDATION_FAILED:            400,
  EMAIL_NOT_VERIFIED:           403,
  LAST_SUPERADMIN:              409,
  CATEGORY_TOO_DEEP:            400,
  CATEGORY_IN_USE:              409,
  COURSE_INCOMPLETE:            400,
  COURSE_INVALID_STATE:         409,
  COURSE_NOT_PURCHASABLE:       409,
  COURSE_HAS_ENROLLMENTS:       409,
  COURSE_PRICE_LOCKED:          403,
  ALREADY_ENROLLED:             409,
  ORDER_ALREADY_OPEN:           409,
  ORDER_INVALID_STATE:          409,
  ORDER_PRICE_CHANGED:          409,
  PAYMENT_METHOD_UNAVAILABLE:   409,
  PAYMENT_PROVIDER_UNAVAILABLE: 500,
  RECEIPT_INVALID_TYPE:         400,
  RECEIPT_TOO_LARGE:            413,
  REVIEW_NOTE_REQUIRED:         400,
  REFUND_NOT_ALLOWED:           409,
  REFUND_ALREADY_REQUESTED:     409,
  LESSON_ACCESS_DENIED:         403,
  INTERNAL_ERROR:               500,
} as const

export type ErrorCode = keyof typeof ERROR_CODES
```

```
  src/lib function                Payload                          browser
  throw new AppError(CODE) ---->  logs details on the server, ---> { "errors": [...], "code": "ORDER_ALREADY_OPEN" }
                                  then the afterError hook         with HTTP 409
                                  adds the code and status              |
                                                                        v
                                                  messages/ar.json  "errors.ORDER_ALREADY_OPEN": "..."
                                                  messages/en.json  "errors.ORDER_ALREADY_OPEN": "..."
```

Changed in M1: the code sits next to Payload's own `errors` array instead of replacing it. Why: the admin panel reads that array for its messages, and one hook (`src/lib/errors/attachErrorCode.ts`) can then give a code to Payload's built-in errors too, such as a wrong password.

A test in Phase 4 checks that every code has a text in both message files.

## 10. Emails

All emails have Arabic text first, then English.

| Trigger | To | Sent from |
|---------|----|-----------|
| Registration | the new user | Payload `auth.verify` |
| Password reset | the user | Payload `auth.forgotPassword` |
| Order enters awaiting_review | managers and superadmins | `submitReceipt` |
| Receipt approved | student | `fulfillOrder` |
| Receipt rejected, with the note | student | `rejectReceipt` |
| Refund declined, with the note | student | `declineRefund` |
| Order refunded | student | `refundOrder` |
| Payout recorded | the doctor | payouts `afterChange` hook |

Emails are sent after the database transaction commits. A failed email is logged and never undoes a payment.

## 11. Folder structure

```
vetudy/
├─ docs/                          the phase documents
├─ messages/
│  ├─ ar.json                     site text and error-code text, Arabic
│  └─ en.json                     the same keys, English
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ (frontend)/
│  │  │  └─ [locale]/             every public page from section 7
│  │  │     ├─ layout.tsx         sets <html lang dir>, so RTL is decided here
│  │  │     ├─ page.tsx
│  │  │     ├─ courses/
│  │  │     ├─ checkout/
│  │  │     ├─ orders/
│  │  │     ├─ my-courses/
│  │  │     ├─ account/
│  │  │     ├─ (auth)/            login, register, verify-email, forgot-password, reset-password
│  │  │     └─ (legal)/           terms, privacy, refund-policy
│  │  └─ (payload)/               generated by Payload: /admin and /api
│  ├─ collections/                one folder per collection
│  │  └─ Orders/
│  │     ├─ index.ts              fields and config
│  │     ├─ access.ts             who can read and write
│  │     ├─ hooks.ts
│  │     └─ endpoints.ts          thin wrappers around src/lib/orders
│  ├─ globals/                    PaymentSettings.ts, PlatformSettings.ts
│  ├─ access/                     shared role helpers: isSuperadmin, isStaff, isOwner
│  ├─ admin/                      custom panel pieces: OrderActions, CourseActions, EarningsView
│  ├─ components/
│  │  ├─ ui/                      shadcn/ui components
│  │  └─ ...                      site components
│  ├─ i18n/                       routing.ts, navigation.ts, request.ts
│  ├─ lib/
│  │  ├─ errors/                  codes.ts, AppError.ts, toResponse.ts
│  │  ├─ payments/                types.ts, index.ts, manual.ts
│  │  ├─ video/                   types.ts, index.ts, youtube.ts
│  │  ├─ orders/                  transitions.ts, startOrder.ts, submitReceipt.ts, fulfillOrder.ts, refundOrder.ts, ...
│  │  ├─ courses/                 transitions.ts, submitCourse.ts, publishCourse.ts, ...
│  │  ├─ enrollments/             canWatchLesson.ts, activateEnrollment.ts
│  │  ├─ earnings/                getOwnerEarnings.ts
│  │  ├─ catalog/                 read functions that return shaped objects for pages
│  │  ├─ email/                   one template function per email
│  │  └─ money.ts                 piasters and EGP conversion, owner share
│  ├─ migrations/                 generated by Payload, committed to git
│  ├─ proxy.ts                    locale redirect (Next.js 16 name for middleware)
│  ├─ payload.config.ts
│  └─ payload-types.ts            generated, never edited by hand
├─ tests/                         Phase 4: unit/, access/, e2e/
├─ .env.example
└─ package.json
```

What changes when a provider is added, which is the point of this layout:

| Adding | New files | Edited files |
|--------|-----------|--------------|
| Paymob | `src/lib/payments/paymob.ts`, one webhook route | `src/lib/payments/index.ts` (one line) |
| Bunny Stream | `src/lib/video/bunny.ts` | `src/lib/video/index.ts` (one line) |

No page, collection, or function in `orders/` changes.

## 12. Earnings

```
  balance(owner) =   sum of ownerAmount on orders where owner = this doctor and status = paid
                   - sum of amount on payouts where owner = this doctor
```

```ts
// src/lib/earnings/getOwnerEarnings.ts
export interface OwnerEarnings {
  perCourse: { courseId: string; title: string; paidOrders: number; earned: number }[]
  totalEarned: number     // piasters, paid orders only
  totalPaidOut: number    // piasters
  balance: number         // totalEarned - totalPaidOut, may be negative
  payouts: { paidAt: Date; amount: number; note?: string }[]
}
```

A refunded order is no longer `paid`, so it drops out of the first sum. That is the whole negative-balance rule, with no extra code.

## 13. Needs your approval

**Libraries.** Your rule is to ask before adding any, so here is everything M1 would install beyond Next.js, Payload, the Postgres adapter, Tailwind, and shadcn/ui:

| Library | Why | Alternative |
|---------|-----|-------------|
| `next-intl` (4.x) | Locale in the URL, the `/` to `/ar` redirect, translated text in server and client components, number and date formatting. | Hand-written dictionaries. Fine for a few pages, but we would rebuild the redirect, client-side text, and formatting ourselves. |
| `@payloadcms/translations` | The official package that gives the admin panel its Arabic interface and RTL layout. | English-only admin panel for doctors. |
| `sharp` | Payload uses it to resize thumbnails. Their template includes it. | Serve thumbnails at full size. |
| `@payloadcms/email-nodemailer` | Already in your spec. Listed for completeness. | |

**Choices I made that you can overrule:**

1. pnpm as the package manager (decided: you asked for pnpm).
2. UUID IDs.
3. Plain-text course descriptions.
4. The additions to the data model marked **new** in section 3. The ones that matter most are `orders.owner` and `lessons.course`.
5. Doctors read their sales through the earnings view, and the orders list is hidden from them.

**Three things to confirm while building, not now:**

| Item | Where |
|------|-------|
| Payload refuses login until the email is verified | M1 |
| The filtered unique index for one open order | M3 |
| The row lock inside `fulfillOrder` and `refundOrder` | M3 |

## 14. Changes made while building

| Milestone | Change | Why |
|-----------|--------|-----|
| M1 | Error responses keep Payload's `errors` array and add `code` beside it (section 9). | The admin panel reads that array. |
| M1 | Minimum password length is 8, enforced by a hook. | Payload's built-in minimum is 3 and cannot be configured. |
| M1 | The first superadmin is created by `pnpm superadmin:create`. | Payload's "create first user" screen is open to whoever reaches a fresh server first. |
| M2 | Managers and the superadmin can create a course for a doctor and must pick that doctor. Only the superadmin can change the owner afterwards. | A course needs a doctor as its owner. |
| M2 | New error code `COURSE_OWNER_INVALID`. | The superadmin must pick a doctor account as owner. |
| M2 | A doctor's price change after draft is ignored silently, not rejected. | The admin form always sends every field, so rejecting would break saving a title. |
| M2 | Courses and modules list their modules and lessons inside the edit page. | Doctors build a course from one screen. |
| M2 | `POST /api/users/change-password` asks for the current password. | Someone at an unlocked browser cannot quietly take over the account. |
| M2 | A logged-in student who opens `/admin` is redirected to the site by `src/proxy.ts`. | Payload still refuses students itself; the redirect is a courtesy. |
| After M2 | The Payload admin screens at `/admin` are removed. Doctors, managers, and the owner use our own dashboard at `/dashboard`, built with Next.js and shadcn/ui. Payload stays as the engine. This replaces the "Admin panel" table in section 7 and assumption A1. | The generated panel was hard to use: it showed data, not the next thing to do. |
| After M2 | The dashboard saves Arabic and English in one request (`?locale=all`), and a hook checks that the Arabic value is present. | One form with both languages side by side, instead of switching language and saving twice. |

### Dashboard routes (replace the "Admin panel" table in section 7)

| Path | What | Who |
|------|------|-----|
| `/dashboard` | Redirects to the review queue (staff) or "My courses" (doctors) | owner, manager, doctor |
| `/dashboard/courses` | Course list with status tabs | owner and manager: all. Doctor: own. |
| `/dashboard/courses/new` | Create a course. Staff pick the doctor. | owner, manager, doctor |
| `/dashboard/courses/[id]` | One screen: status and actions, details, modules and lessons | owner, manager, the course's doctor |
| `/dashboard/categories` | Main categories and subcategories | owner, manager |
| `/dashboard/users` | Users. Create, change role, delete. | owner manages, manager reads |
| `/dashboard/settings` | Default doctor share | owner |

The pages only decide what to show. Every action is checked again by the API, exactly as before.

### Changes after the first dashboard review

| Change | Why |
|--------|-----|
| Translated fields (titles, descriptions) are no longer `required` in Payload. A `requireArabic` hook requires the Arabic value instead. Migration `optional_english` drops the NOT NULL on the `*_locales` columns. | `required` on a translated field means "required in every language", so an empty English field failed and adding English to an existing course crashed. |
| A role changes only through `POST /api/users/:id/role { role, password }`. The `role` field cannot be written by a normal save, even by the owner. | A role was changed by mistake with one click, and the owner removed their own access. |
| An owner cannot change their own role or delete their own account (`SELF_CHANGE_NOT_ALLOWED`). Another owner has to. | Prevents locking yourself out. |
| Role changes and user deletion ask for the owner's password (`WRONG_PASSWORD`). Deletion uses `POST /api/users/:id/delete`; the generic delete route is closed. | A second, deliberate step before an action that is hard to undo. |
| Every role change emails the person and every owner. | A mistaken change is noticed immediately. |
| "New user" cannot create an owner. Promote an existing account instead. | Making an owner always goes through the password check and the emails. |
| Moving a course to another doctor asks for confirmation. | It changes who earns from future sales. |
| Archived courses show an Unarchive button in the course list and explain it on the course page. | Unarchiving was hard to find. |
| The dashboard has its own frame (dark sidebar, grey work area) instead of the public site header. Routes are split into `(site)` and `dashboard` under `[locale]`. | The dashboard should feel like its own workspace while keeping the brand. || Making someone an owner takes two steps: the owner's password, then a one-time link (30 minutes) emailed to that owner. It opens `/dashboard/confirm-owner`, which only shows the request; the change happens on Confirm (`POST /api/users/confirm-owner`). Pending requests live in the hidden `owner-promotions` collection, which stores only a hash of the token. | Giving full control of the platform needs proof of both the password and the owner's email. A button rather than an automatic change, because email scanners open links. |
| The course form picks the category in two fields: main category, then an optional subcategory filtered to it. The saved value is still one `category`. | Clearer than one long grouped list. |

### Changes made while building M3 (orders, payments, refunds)

| Change | Why |
|--------|-----|
| `PaymentProvider.startPayment(order, { payload })` takes the Payload instance as a second argument. | Adapters read payment settings from the database, and importing the config inside an adapter creates an import cycle. |
| `fulfillOrder(orderId, req)`, `refundOrder(orderId, req)` and the other order functions take the request. | They run inside a database transaction started from the request, and the Paymob webhook will have one too. |
| Starting an order is "find or create": a student with an open order for the course gets that order back (`resumed: true`) instead of an error. The code `ORDER_ALREADY_OPEN` is not used. | A double click or a second tab should just continue the same payment. |
| Concurrency is handled by locking rows (`SELECT ... FOR UPDATE`) inside a transaction: the student's row when starting an order, the order's row for every other change. A partial unique index in migration `open_order_index` is the safety net underneath. | Two managers pressing Approve together, or two clicks on Buy, must produce one result. |
| While an order is pending its amount follows the course price and is refreshed whenever the order page loads. A receipt upload carries the amount the student saw; if the price moved, nothing is saved (`ORDER_PRICE_CHANGED`). The amount, the doctor's share, and the doctor lock when the receipt is accepted for review. | Decision D3 from Phase 1. |
| A pending order whose course becomes free is completed when the student next opens it. | Otherwise they would be stuck on a payment of 0. |
| A student can ask for a refund again after a decline. Free orders cannot be refunded. | Declines are case by case; there is nothing to return for a free course. |
| Archiving a course cancels its pending orders. Orders with a receipt waiting stay. | The money was already sent for those. |
| A course with orders or enrollments cannot be deleted (`COURSE_HAS_ENROLLMENTS`). An account that owns courses or has orders or enrollments cannot be deleted (`USER_HAS_RECORDS`). | Their records point at them. Archive the course instead. |
| Receipt file names are random UUIDs, and receipts live in `receipts/` (not the public `media/`). | The name must not reveal who sent it. |
| An upload over 5 MB is stopped by Payload's own limit; its 413 answer is mapped to `RECEIPT_TOO_LARGE`. | Payload answers before our code runs. |
| Logging in can return the visitor to where they were (`?next=`), accepted only for paths on this site. | Buy -> log in -> straight back to checkout. |
| The owner edits the InstaPay address and Vodafone Cash number on the dashboard settings page. A method with an empty field is hidden from students. | Decision from the access table: payment settings are owner-only. |

### Changes made while building M4 (the lesson player)

| Change | Why |
|--------|-----|
| `VideoProvider.getPlayback(videoId, { userId? })`: `userId` is optional. | Guests watch free previews (decision D8). |
| The lesson page is a server component at `/courses/[slug]/lessons/[lessonId]`. `getWatchPage` loads the outline without video fields, decides access, and only then reads the video id and builds the embed URL. A locked page never has a video id in memory. | The embed URL must be resolved on the server after the access check and never appear in an API answer or a page for someone who may not watch. |
| One rule decides access (`canWatch`): the whole course for staff, the course's doctor, and active enrollments; otherwise only a free preview of a published course. An archived course keeps its students. Orders are never read. | "Access is decided by enrollments only." |
| A course that is not public (draft, in review, archived) is a 404 for people with no claim on it, even for a free-preview lesson. | It should not exist for them. |
| Locked lessons are listed with a lock but are not links. Previous and next buttons appear only for lessons the person may open. | Fewer dead ends. |
| YouTube is embedded through `youtube-nocookie.com` with a `strict-origin-when-cross-origin` referrer policy. | No tracking cookies until play, and the referrer YouTube asks for. |
| The course page links the lessons a visitor may open, and enrolled students get a "Start learning" button. | Connects the purchase to the lessons. |

### Changes made while building M5 (My courses and order views)

| Change | Why |
|--------|-----|
| `/my-courses` lists every ACTIVE enrollment, including archived courses (with a note that the course is no longer sold). "Continue learning" opens the first lesson by position, not by creation order. A refund removes the course from the list at once. | Access is decided by enrollments only. |
| One page, `/dashboard/orders`, with a view per role. Managers and the owner see every order (reference, student name and email, method, status), with search by reference, name, or email, status tabs, and pages of 25. A doctor sees "Sales": student name, course, amount, their share, status, and date, for orders in the statuses awaiting review, paid, and refunded. The menu calls it Orders or Sales. | Decisions D9 and the access table: doctors read orders for their own courses, name only. |
| Doctors read orders through `listSalesForDoctor`, not through the API. It returns a `SaleRow` with no email, phone, method, receipt, refund details, or order reference. The reference is also kept out of React keys, because Next.js copies keys into the page data. | Privacy by construction: what is not in the type cannot reach the page. |
| The account menu has My courses, My orders, My account, in that order; the home page links to My courses for logged-in users. | The student's main destinations. |

