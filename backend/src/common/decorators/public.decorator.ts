import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'
export const ALLOW_TOTP_PENDING_KEY = 'allowTotpPending'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
export const AllowTotpPending = () => SetMetadata(ALLOW_TOTP_PENDING_KEY, true)
