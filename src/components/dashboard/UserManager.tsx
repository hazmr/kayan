'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'

import { ROLES, type Role } from '@/access/roles'
import { FormError } from '@/components/auth/FormError'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendJson } from '@/lib/api/postJson'
import { selectClass } from '@/lib/dashboard/localized'
import type { UserRow } from '@/lib/dashboard/types'
import { MIN_PASSWORD_LENGTH } from '@/lib/errors/codes'

import { useApiAction } from './shared'

interface UserManagerProps {
  users: UserRow[]
  currentUserId: string
  /** Only the owner may create users, change roles, or delete. Managers get a read-only list. */
  canManage: boolean
  search: string
}

type Pending = { kind: 'role'; user: UserRow; to: Role } | { kind: 'delete'; user: UserRow } | null

/** Roles an owner may give when creating an account. Owners are made by changing a role later. */
const CREATABLE_ROLES = ROLES.filter((role) => role !== 'superadmin')

export function UserManager({ users, currentUserId, canManage, search }: UserManagerProps) {
  const t = useTranslations('dashboard')
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<Pending>(null)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('users.title')}</h1>
        {canManage && (
          <Button type="button" onClick={() => setCreating(true)}>
            {t('users.new')}
          </Button>
        )}
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder={t('users.searchPlaceholder')}
          aria-label={t('users.searchPlaceholder')}
        />
        <Button type="submit" variant="outline">
          {t('common.search')}
        </Button>
      </form>

      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          {t('users.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t('users.name')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('users.email')}</th>
                <th className="px-4 py-2 text-start font-medium">{t('users.role')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => {
                const isSelf = user.id === currentUserId
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-2">
                      {user.name}
                      {isSelf && (
                        <Badge variant="outline" className="ms-2">
                          {t('users.you')}
                        </Badge>
                      )}
                      {user.master && (
                        <Badge className="ms-2" title={t('users.masterLocked')}>
                          {t('users.master')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2" dir="ltr">
                      {user.email}
                      {!user.verified && (
                        <Badge variant="secondary" className="ms-2">
                          {t('users.notVerified')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {canManage && !isSelf && !user.master ? (
                        <select
                          className={selectClass}
                          // Always shows the saved role. Choosing another opens the confirmation.
                          value={user.role}
                          aria-label={`${t('users.role')}: ${user.name}`}
                          onChange={(event) =>
                            setPending({ kind: 'role', user, to: event.target.value as Role })
                          }
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {t(`roles.${role}`)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          title={
                            user.master
                              ? t('users.masterLocked')
                              : isSelf && canManage
                                ? t('users.selfLocked')
                                : undefined
                          }
                        >
                          {t(`roles.${user.role}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-end">
                      {canManage && !isSelf && !user.master && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setPending({ kind: 'delete', user })}
                        >
                          {t('common.delete')}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewUserDialog onClose={() => setCreating(false)} />}
      {pending && <ConfirmWithPassword pending={pending} onClose={() => setPending(null)} />}
    </section>
  )
}

/**
 * Role changes and deletions are hard to undo, so both ask the owner to type their password,
 * say exactly what will happen, and (for roles) warn that everyone involved gets an email.
 */
function ConfirmWithPassword({
  pending,
  onClose,
}: {
  pending: NonNullable<Pending>
  onClose: () => void
}) {
  const t = useTranslations('dashboard')
  const { run, pending: busy, errorCode } = useApiAction()
  const [password, setPassword] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const { user } = pending
  const makingOwner = pending.kind === 'role' && pending.to === 'superadmin'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() =>
      pending.kind === 'role'
        ? sendJson('POST', `/api/users/${user.id}/role`, { role: pending.to, password })
        : sendJson('POST', `/api/users/${user.id}/delete`, { password }),
    )
    if (!result.ok) return
    // An owner promotion is not done yet: it waits for the link in the owner's email.
    if (makingOwner) setEmailSent(true)
    else onClose()
  }

  if (emailSent) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.changeRoleTitle')}</DialogTitle>
            <DialogDescription>{t('users.ownerEmailSent', { name: user.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              {t('users.sendAgain')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pending.kind === 'role' ? t('users.changeRoleTitle') : t('users.deleteTitle')}
          </DialogTitle>
          <DialogDescription>
            {pending.kind === 'role'
              ? t('users.changeRoleBody', {
                  name: user.name,
                  from: t(`roles.${user.role}`),
                  to: t(`roles.${pending.to}`),
                })
              : t('users.deleteBody', { name: user.name, email: user.email })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {makingOwner && (
            <Alert variant="destructive">
              <AlertDescription>
                {t('users.ownerWarning')} {t('users.ownerTwoSteps')}
              </AlertDescription>
            </Alert>
          )}
          {pending.kind === 'role' && (
            <p className="text-sm text-muted-foreground">
              {t('users.emailNotice', { name: user.name })}
            </p>
          )}
          <FormError code={errorCode} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">{t('users.passwordConfirm')}</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="confirm-password-help"
              dir="ltr"
            />
            <p id="confirm-password-help" className="text-xs text-muted-foreground">
              {t('users.passwordConfirmHelp')}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant={pending.kind === 'delete' ? 'destructive' : 'default'}
              disabled={busy || password === ''}
            >
              {pending.kind === 'delete' ? t('common.delete') : t('users.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewUserDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('dashboard')
  const { run, pending, errorCode } = useApiAction()
  const [role, setRole] = useState<Role>('admin')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = await run(() =>
      sendJson('POST', '/api/users?depth=0', {
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
        role,
        // The owner vouches for this person, so no verification email is needed.
        _verified: true,
      }),
    )
    if (result.ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.new')}</DialogTitle>
          <DialogDescription>{t('users.newHelp')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormError code={errorCode} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-name">{t('users.name')}</Label>
            <Input id="new-user-name" name="name" required maxLength={120} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-email">{t('users.email')}</Label>
            <Input id="new-user-email" name="email" type="email" required dir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-password">{t('users.password')}</Label>
            <Input
              id="new-user-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-role">{t('users.role')}</Label>
            <select
              id="new-user-role"
              className={selectClass}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              aria-describedby="new-user-role-help"
            >
              {CREATABLE_ROLES.map((option) => (
                <option key={option} value={option}>
                  {t(`roles.${option}`)}
                </option>
              ))}
            </select>
            <p id="new-user-role-help" className="text-xs text-muted-foreground">
              {t('users.newOwnerHint')}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
