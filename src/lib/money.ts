// Money is stored as whole piasters (1 EGP = 100 piasters), so there is never a rounding error
// from decimals. Convert only at the edges: when a person types a price or reads one.

export const PIASTERS_PER_EGP = 100

export function egpToPiasters(egp: number): number {
  return Math.round(egp * PIASTERS_PER_EGP)
}

/**
 * The doctor's cut of a sale, in piasters, rounded down.
 * Rounding down means the platform keeps any leftover piaster, and the doctor is never overpaid.
 */
export function ownerShare(amountPiasters: number, percent: number): number {
  return Math.floor((amountPiasters * percent) / 100)
}

export function piastersToEgp(piasters: number): number {
  return piasters / PIASTERS_PER_EGP
}
