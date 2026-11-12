import type { CollectionConfig } from 'payload'

import { DEFAULT_ROLE, isStaff, ROLES } from '@/access/roles'
import {
  resetPasswordHTML,
  resetPasswordSubject,
  verifyEmailHTML,
  verifyEmailSubject,
} from '@/lib/email/authEmails'

import {
  canAccessAdminPanel,
  canCreateUser,
  canReadUser,
  canUpdateUser,
  superadminOnly,
  superadminOnlyField,
} from './access'
import {
  changePasswordEndpoint,
  changeRoleEndpoint,
  confirmOwnerEndpoint,
  deleteUserEndpoint,
} from './endpoints'
import {
  enforcePasswordLength,
  guardProtectedFields,
  protectLastSuperadminOnChange,
  protectLastSuperadminOnDelete,
  protectMasterOwnerOnChange,
  protectMasterOwnerOnDelete,
  refuseDeleteWhenInUse,
  removeOwnerPromotions,
} from './hooks'

const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7
const TEN_MINUTES_IN_MS = 10 * 60 * 1000

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role', 'createdAt'],
    // Doctors do not manage users, so the list is hidden from them.
    hidden: ({ user }) => !isStaff(user),
  },
  auth: {
    tokenExpiration: ONE_WEEK_IN_SECONDS,
    // Slows down password guessing: 5 wrong attempts lock the account for 10 minutes.
    maxLoginAttempts: 5,
    lockTime: TEN_MINUTES_IN_MS,
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
    // Login is refused until the link in this email is opened.
    verify: {
      generateEmailSubject: verifyEmailSubject,
      generateEmailHTML: verifyEmailHTML,
    },
    forgotPassword: {
      generateEmailSubject: resetPasswordSubject,
      generateEmailHTML: resetPasswordHTML,
    },
  },
  access: {
    admin: canAccessAdminPanel,
    create: canCreateUser,
    read: canReadUser,
    update: canUpdateUser,
    // Deleting goes through the delete endpoint, which asks for the owner's password.
    delete: () => false,
    unlock: superadminOnly,
  },
  hooks: {
    beforeOperation: [enforcePasswordLength],
    beforeChange: [guardProtectedFields, protectMasterOwnerOnChange, protectLastSuperadminOnChange],
    beforeDelete: [
      protectMasterOwnerOnDelete,
      protectLastSuperadminOnDelete,
      refuseDeleteWhenInUse,
      removeOwnerPromotions,
    ],
  },
  endpoints: [changePasswordEndpoint, changeRoleEndpoint, deleteUserEndpoint, confirmOwnerEndpoint],
  fields: [
    // `email` and `password` are added by Payload because `auth` is enabled.
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 120,
    },
    {
      name: 'phone',
      type: 'text',
      maxLength: 30,
    },
    {
      // The master owner: one account that nobody can demote, edit, or delete from the app, not
      // even other owners. Set only by the `pnpm master:set` command on the server (see
      // src/scripts/set-master-owner.ts); the database allows at most one.
      name: 'isMasterOwner',
      type: 'checkbox',
      defaultValue: false,
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: DEFAULT_ROLE,
      options: ROLES.map((role) => ({ label: role, value: role })),
      // Stored in the login token, so access rules can read the role without a database query.
      saveToJWT: true,
      access: {
        create: superadminOnlyField,
        // Never through a normal save: see the role endpoint.
        update: () => false,
      },
    },
  ],
}
