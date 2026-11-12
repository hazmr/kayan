# Phase 1: Requirements

Status: waiting for approval. No code has been written.

## 1. Decisions made in Phase 1

These came out of the Phase 1 questions. Each one changes or adds to the original spec.

| # | Decision | Effect on the spec |
|---|----------|--------------------|
| D1 | Default owner share is 70%. | New superadmin-only setting `defaultOwnerSharePercent`, copied onto each course at creation. Superadmin can override per course. |
| D2 | Refunds are requested in-app. | Orders get refund-request fields (reason, where to send the money, requested at, decision note). No new order status: the order stays `paid` until the money is sent. |
| D3 | An unpaid order does not lock the price. | Replaces "snapshot when the order is created". `amount` and `ownerAmount` follow the course while the order is `pending` and freeze when the first receipt is uploaded. |
| D4 | Orders can be cancelled. | New order status `cancelled`. A student can cancel a `pending` or `rejected` order. No automatic expiry is needed because of D3. |
| D5 | Free courses are allowed. | `price` may be 0. Enrolling creates an order with amount 0 that is fulfilled at once, with no receipt. |
| D6 | No coupons in v1. | Unchanged from the spec. |
| D7 | Edits to a published course go live at once. | No re-review. Price, status, owner, and share stay locked for the doctor. |
| D8 | Guests can watch free-preview lessons. | `userId` becomes optional in the `VideoProvider` context. |
| D9 | Doctors see buyer names only. | On orders for their courses a doctor sees student name, amount, their share, status, date. No email, phone, receipt, or refund details. |

Order states after D3 and D4:

```
                    upload receipt             approve
   +---------+   (price freezes here)   +-----------------+        +------+
   | pending | -----------------------> | awaiting_review | -----> | paid |
   +---------+                          +-----------------+        +------+
        |                                  |          ^               |
        | cancel                    reject |          | new receipt   | money sent back
        v                                  v          |               v
   +-----------+        cancel          +----------+  |          +----------+
   | cancelled | <--------------------- | rejected | -+          | refunded |
   +-----------+                        +----------+             +----------+
```

"Open order" means `pending`, `awaiting_review`, or `rejected`. A student can have at most one open order per course.

## 2. Assumptions

I filled these gaps myself. Tell me which ones are wrong.

| # | Assumption |
|---|------------|
| A1 | Doctors, managers, and the superadmin work in the Payload admin panel (`/admin`), with its interface available in Arabic and English. Students only ever use the public site. |
| A2 | There is no "apply to teach" form. The superadmin creates a doctor's account or promotes an existing user. |
| A3 | A course owner must have the `admin` role. Only the superadmin can change a course's owner. |
| A4 | Any logged-in, email-verified user can buy a course they do not own, whatever their role. |
| A5 | The course owner, managers, and the superadmin can watch every lesson of a course they can edit, without an enrollment. For everyone else, access comes from enrollments only. |
| A6 | A manager can send a course in review back to `draft` with a required note. The doctor sees the note in the admin panel. No email for course review in v1. |
| A7 | Only managers and the superadmin can archive or un-archive a course. Archived courses leave the catalog and accept no new orders. Enrolled students keep access. Open `pending` orders on that course are cancelled. |
| A8 | To be submitted for review a course needs a category, a thumbnail, an Arabic title and description, and at least one module with one lesson. |
| A9 | The course outline (module and lesson titles, durations) is public. Only the video is gated. |
| A10 | Refunds are full refunds only. Free orders cannot be refunded. The system enforces no refund deadline; the refund policy page explains that a manager decides. |
| A11 | A manager can decline a refund request with a note. The student is emailed and keeps access. This email is not in the original spec. |
| A12 | "Email managers" means every user with the manager or superadmin role. |
| A13 | A payout record cannot be edited. To fix a mistake the superadmin deletes it and records a new one. |
| A14 | A category cannot be deleted while it has subcategories or courses. |
| A15 | A user who owns courses or has orders cannot be hard-deleted. Details go to Phase 2. |
| A16 | A payment method is offered to students only if its address or number is filled in payment settings. |

> **Update after Phase 4 (refactors R1 and R2).** This document describes the original marketplace.
> The product is now **one academy**: three roles (Admin, Instructor, Student), no course review
> step, and one money rule (the Admin earns a set percent of each sale, paid by the academy and
> recorded as payments to the Admin). The marketplace stories below about doctor shares, payouts to
> doctors, managers, and owner promotion are superseded; see the "Refactor R1" and "Refactor R2"
> sections of [02-design.md](02-design.md).

## 3. User stories

Each story has an ID so later phases and tests can point back to it. Error codes shown here are examples; the final list is fixed in Phase 2.

### 3.1 Guest (not logged in)

**G1. Browse the catalog.** As a guest, I want to browse courses so that I can find one worth buying.
- Only `published` courses are listed. A draft, in-review, or archived course returns 404 to the public.
- I can filter by category and by subcategory.
- *Added after Phase 4:* I can search by course title (Arabic or English) or doctor name, filter free or paid, and sort by newest or price. The catalog shows 12 courses a page. All of it lives in the page address, so a view can be shared. Search never returns a course that is not published.
- Each card shows thumbnail, title, doctor name, and price in EGP, or "Free" when the price is 0.

**S-progress. Track my progress.** *(Added after Phase 4.)* As a student, I want to see how far I am in each course I own.
- Under each lesson's player I can press "Mark as complete" (and press again to undo). Only a student with an active enrollment can; doctors, staff, and guests cannot.
- My courses and the course page show "3 of 10 lessons" with a bar, and "Continue learning" opens the first lesson I have not completed ("Start learning" at 0, "Review course" at 100%).
- The lesson list marks completed lessons with a check.
- Nobody can read another person's progress, staff included. A refunded student's progress is hidden with the course and comes back if they buy it again.

**G2. See a course page.** As a guest, I want to read about a course before signing up.
- The page shows title, description, thumbnail, price, doctor name, and the outline of modules and lessons with durations.
- Free-preview lessons are marked.
- No response sent to my browser contains a `videoId` or embed URL for a lesson I cannot watch.

**G3. Watch a free preview.** As a guest, I want to watch free-preview lessons without an account.
- A lesson with `isFreePreview` plays without login.
- Any other lesson shows a prompt to buy or log in, and no video data is sent.

**G4. Register.** As a guest, I want to create an account with my email and a password.
- The form takes name, email, password, and an optional phone number.
- The new account is always a `student`, whatever the request body contains.
- A verification email with a link arrives, with Arabic and English text.
- I cannot log in until I click the link.

**G5. Log in and reset my password.** As a guest, I want to get back into my account.
- I can log in with email and password.
- "Forgot password" sends a reset link by email. The response is the same whether or not the email exists.

**G6. Choose my language.** As a guest, I want to read the site in Arabic or English.
- The locale is in the URL (`/ar/...`, `/en/...`). A URL with no locale redirects to Arabic.
- Arabic pages are right-to-left, English pages left-to-right.
- Content with no English version falls back to the Arabic text.
- Terms, privacy, and refund policy pages exist in both languages.

### 3.2 Student

**S1. Start a purchase.** As a student, I want to buy a course by InstaPay or Vodafone Cash.
- I must be logged in and verified.
- I pick a method and see the address or number to pay, the amount, and my order reference.
- If I already have an open order for this course, I am taken to it and no second order is created (`ORDER_ALREADY_OPEN`).
- If I already have an active enrollment, I cannot order (`ALREADY_ENROLLED`).
- While the order is `pending` I can switch method.

**S2. Pay the current price.** As a student, I always pay the price the course has when I actually pay.
- While my order is `pending`, the amount shown is the course's current price.
- The amount and the owner's share freeze at the moment I upload my first receipt.
- If the price changed between the page loading and my upload, the upload is refused (`ORDER_PRICE_CHANGED`), nothing is saved, and I see the new amount.

**S3. Upload a receipt.** As a student, I want to prove that I paid.
- I upload one image (JPEG, PNG, or WebP, at most 5 MB) and the number I sent from.
- The order moves to `awaiting_review` and managers are emailed.
- Only I, managers, and the superadmin can open the receipt image.

**S4. Fix a rejected payment.** As a student, I want to try again when my receipt is rejected.
- I get an email with the manager's note, and I see the note on the order.
- I can upload a new receipt on the same order, which returns it to `awaiting_review`.
- Earlier receipts stay on the order.

**S5. Cancel an order.** As a student, I want to drop an order I will not pay.
- I can cancel while the order is `pending` or `rejected`, not while it is `awaiting_review` or later.
- After cancelling I can start a new order for the same course.

**S6. Enroll in a free course.** As a student, I want to join a free course in one click.
- "Enroll" creates an order with amount 0 that is marked `paid` at once and activates my enrollment.
- There is no method choice, receipt, or review.

**S7. Get access after approval.** As a student, I want to start as soon as my payment is approved.
- I receive an approval email.
- The course appears in "My courses" and every lesson plays.

**S8. Watch lessons.** As a student, I want to watch the lessons of courses I am enrolled in.
- A lesson plays only if I have an `active` enrollment for its course, or it is a free preview.
- The embed URL is produced on the server after that check.
- With a `revoked` enrollment I get the same denial as someone who never bought.

**S9. See my courses.** As a student, I want one page listing what I own.
- It lists every course where my enrollment is `active`, including archived courses.

**S10. See my orders.** As a student, I want to follow the state of my payments.
- I see my own orders only: course, amount, method, reference, status, date, and any review or refund note.

**S11. Request a refund.** As a student, I want to ask for my money back.
- On a `paid` order with an amount above 0, I can submit a reason and the number or address to refund to.
- Only one request can be open per order.
- I keep full access while the request is open.
- I can cancel the request at any time before it is decided.

**S12. Learn the refund outcome.** As a student, I want to know what was decided.
- When the manager marks the order refunded, I get an email, the order becomes `refunded`, and my enrollment is `revoked`.
- When the manager declines, I get an email with the note and keep access.

**S13. Buy again after a refund.** As a student, I want to be able to return to a course.
- I can place a new order for a course I was refunded for.
- When it is approved, my old revoked enrollment is reactivated. No second enrollment row is created.

**S14. Edit my profile.** As a student, I want to keep my details current.
- I can change my name, phone, and password. I cannot change my role.

### 3.3 Admin (doctor)

**A1. Create a course.** As a doctor, I want to create a course that belongs to me.
- A new course is a `draft`, I am its owner, and its share is copied from the platform default.
- I cannot set or change owner, share percent, or any status other than the move in A4.
- Arabic title and description are required. English is optional.

**A2. Build the content.** As a doctor, I want to organise my course into modules and lessons.
- I can add, edit, reorder, and delete modules and lessons in my own courses.
- A lesson has a title, a video provider (YouTube in v1), a video ID, a duration, and a free-preview switch.
- I cannot read or change draft content in another doctor's course.

**A3. Set the price.** As a doctor, I want to decide what my course costs.
- I enter a whole-number price in EGP, 0 or more. It is stored in piasters.
- I can change it only while the course is a `draft`. After that the field is read-only for me.

**A4. Submit for review.** As a doctor, I want to send my course to be published.
- Submitting moves `draft` to `in_review`.
- It is refused if the course is missing a category, a thumbnail, or at least one module with one lesson (`COURSE_INCOMPLETE`).
- I cannot set the course to `published` myself.

**A5. Respond to a send-back.** As a doctor, I want to know what to fix.
- If the manager sends the course back, it returns to `draft` and I see the manager's note.
- I can edit and submit again.

**A6. Update a live course.** As a doctor, I want to improve a course after it is published.
- My edits to titles, descriptions, modules, and lessons are visible immediately.
- I cannot change price, status, owner, or share percent.
- I cannot delete the course.

**A7. See who bought.** As a doctor, I want to see sales of my courses.
- I see orders for my own courses only.
- For each order I see student name, amount, my share, status, and date.
- I never see student email, phone, receipt images, or refund details.

**A8. See my earnings.** As a doctor, I want to know what I have earned and what I am owed.
- Per course: number of paid orders and the total of my share.
- Balance = total of my share on `paid` orders minus total payouts. Refunded orders do not count.
- The balance can be negative, and the page says so plainly.
- My payout history lists date, amount, and note.
- I see only my own numbers.

**A9. Hear about payouts.** As a doctor, I want to know when I have been paid.
- I get an email when a payout is recorded for me.

### 3.4 Manager

**M1. Review courses.** As a manager, I want to decide what goes live.
- I see the list of courses that are `in_review`.
- I can publish one, or send it back to `draft` with a required note.

**M2. Change a live price.** As a manager, I want to adjust the price of a course after it left draft.
- The new price applies to orders that have not yet frozen their amount.
- Orders that are `awaiting_review` or later are unchanged.

**M3. Archive a course.** As a manager, I want to take a course off sale.
- Archiving removes it from the catalog and stops new orders.
- Enrolled students keep access.
- I can un-archive it.

**M4. Manage categories.** As a manager, I want to keep the catalog organised.
- I can create, edit, and delete categories and subcategories.
- A subcategory cannot have children (`CATEGORY_TOO_DEEP`).
- A category with subcategories or courses cannot be deleted.

**M5. Review receipts.** As a manager, I want to confirm that money arrived before giving access.
- I see the queue of orders that are `awaiting_review`, with the receipt image, sender number, amount, method, and reference.
- Approving calls `fulfillOrder`: the order becomes `paid`, the enrollment becomes active, and the student is emailed.
- Rejecting requires a note. The order becomes `rejected` and the student is emailed the note.
- My name and the time are recorded on the receipt.
- Approving twice, or two managers approving at once, produces one paid order, one enrollment, and one email.

**M6. Handle refunds.** As a manager, I want to decide refund requests.
- I see the queue of open refund requests with the reason and where to send the money.
- I can decline with a note.
- After I have sent the money myself, I mark the order refunded. That calls `refundOrder`: the order becomes `refunded`, the enrollment is revoked, and the student is emailed.
- Marking refunded twice has no further effect.
- I can refund a paid order that has no request.

**M7. See the work.** As a manager, I want an overview of what needs a decision.
- My dashboard opens on the queues: receipts to review, refund requests, courses in review.
- I can read all orders and see what each student paid (needed to match a receipt to a transfer).
- *Changed after M6:* I never see the money split. No doctor earnings, no payouts, no platform or doctor share, no share percent. Only the owner and the doctor concerned do.

**M8. Edit any course.** As a manager, I want to correct content.
- I can edit any course, module, or lesson.

A manager cannot change payment settings, create users, change roles, see or set share percent, see earnings or payouts, record payouts, or delete courses or users.

### 3.5 Superadmin (owner)

**O1. Do everything a manager can.**

**O2. Manage users and roles.** As the owner, I want to control who can do what.
- I can create users, change any user's role, and delete users.
- Only I can write the role field. Anyone else's attempt is refused.
- The last remaining superadmin cannot be demoted or deleted (`LAST_SUPERADMIN`).

**O2b. See where the money goes.** As the owner, I want to see what students paid and how it splits.
- My dashboard shows: what students paid, the platform's share (my revenue), the doctors' share, what was paid out, what is still owed.
- It also breaks the same numbers down by month, by doctor, and by course. Refunded orders are not counted; they have their own line.

**O2c. The master owner.** As the person who runs the business, I want one account that nobody can take away from me.
- One account is the master owner. Nobody can change its role, edit it (name, email, password), or delete it from the app, not even other owners and not even the master themselves for the role.
- Nobody can mark another account as master through the app. Only a command run on the server (`pnpm master:set`) picks, or moves, the master owner.
- The master owner still edits their own name, phone, and password like anyone else.
- The Users page marks the master owner and offers no role or delete controls on that row.

**O3. Set payment details.** As the owner, I want to control where students send money.
- I can set the InstaPay address and the Vodafone Cash number.
- Students see the new values on their next payment page.
- Nobody else can read the edit screen or change these values.

**O4. Set revenue shares.** As the owner, I want to control how much each doctor earns.
- I can set the default share percent (starting at 70).
- I can set a different percent, 0 to 100, on any course.
- A change affects only orders whose amount has not yet frozen.

**O5. Record payouts.** As the owner, I want to keep a record of what I paid each doctor.
- I record doctor, amount, date paid, and a note. My name is stored automatically.
- The doctor's balance drops by that amount and the doctor is emailed.
- The system moves no money.

**O6. Delete a course.** As the owner, I want to remove a course created by mistake.
- Deleting works only if the course has no enrollments.
- Otherwise it is refused (`COURSE_HAS_ENROLLMENTS`) and I archive it.

### 3.6 Rules that apply to every role

| ID | Rule |
|----|------|
| X1 | Every API error is a fixed English code with the right HTTP status. No names, IDs, or internal details in the message. The site shows the Arabic or English text for that code. |
| X2 | Every email contains Arabic and English text. |
| X3 | A lesson's `videoId` and embed URL never appear in a response to someone who may not watch it. |
| X4 | Access to lessons is decided by enrollments (and A5 for staff), never by reading orders. |
| X5 | Money is stored as whole piasters. The owner's share is `amount x percent / 100`, rounded down. |

## 4. MVP and later

| In v1 | Later, not blocked |
|-------|--------------------|
| Email and password sign-up with verification | Paymob online payment |
| Arabic and English site with RTL | Bunny Stream video with signed URLs |
| Categories with two levels | Subscriptions and time-limited passes |
| Courses, modules, lessons, review and publish | Automated payouts to doctors |
| Paid courses with manual payment, and free courses | Coupons and discounts |
| Receipt review, cancel, refund requests | Re-review of edits to live courses |
| Enrollment-gated YouTube player, guest previews | Emails to doctors about course review |
| My courses, order views per role | "Apply to teach" form |
| Earnings page and recorded payouts, lesson progress (added after Phase 4) | Quizzes, certificates, reviews |

## 5. Risks to know about

1. **YouTube unlisted is for development and testing only.** Anyone enrolled can copy the video link from the player and share it, and the video then plays for everybody. This is accepted: YouTube lets us build and test the player without paying for video hosting, and the plan is to move to Bunny Stream for production. Whether the Bunny adapter must exist before the first public launch is decided in Phase 5 (deployment).
2. **A receipt screenshot can be faked.** The manager must confirm the transfer in the real InstaPay or Vodafone Cash account before approving. The screenshot only tells them which transfer to look for.
3. **A negative balance is a real debt.** If a student is refunded after the doctor was paid, the doctor owes the platform until new sales cover it. If that doctor stops selling, the platform absorbs the loss.
4. **A student may pay the old price during a price change (D3).** If a manager changes a price in the minutes between a student transferring money and uploading the receipt, the upload is refused. A manager then has to sort it out by hand. Managers control price changes, so this should be rare.

## 6. Data model changes for Phase 2 to confirm

- Settings global: add `defaultOwnerSharePercent`.
- `orders.status`: add `cancelled`.
- `orders`: add refund-request fields (reason, refund destination, requested at, decision note) and who refunded and when.
- `orders.amount` and `orders.ownerAmount`: frozen at first receipt upload, not at creation.
- `orders.method`: empty for free orders. Phase 2 decides the `provider` value for them.
- `courses`: add the manager's review note. `price` may be 0.
- `VideoProvider.getPlayback`: `userId` becomes optional.
