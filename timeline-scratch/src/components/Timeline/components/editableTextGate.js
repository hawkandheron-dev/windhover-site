import { getUpdateFn } from '../../EditEntityForm/EditEntityForm.jsx';

/**
 * Whether a pencil may be offered for this binding.
 *
 * Pulled out as a plain function so the gate can be tested without a DOM: it
 * decides who gets a write affordance, and every clause is load-bearing.
 * RLS would refuse an unauthorised write anyway, but a pencil that always
 * fails is worse than no pencil, and a pencil bound to the wrong table is
 * worse than both.
 */
export function canEditField({ isAdmin, getToken, pkValue, itemType }) {
  return Boolean(isAdmin) && Boolean(getToken) && Boolean(pkValue) && Boolean(getUpdateFn(itemType));
}
