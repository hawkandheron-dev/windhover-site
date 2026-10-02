/**
 * The gate on inline editing. RLS is the real boundary — only an admin can
 * UPDATE CH_People or CH_Events — but this decides whether the affordance is
 * offered at all, and it must not offer one it cannot honour: a pencil that
 * always fails is worse than no pencil, and a pencil bound to the wrong table
 * is worse than both.
 */
import { describe, it, expect } from 'vitest';
import { canEditField } from '../../timeline-scratch/src/components/Timeline/components/EditableText.jsx';
import { getTableConfig } from '../../timeline-scratch/src/components/EditEntityForm/EditEntityForm.jsx';

const admin = { isAdmin: true, getToken: () => 'token', pkValue: 'athanasius', itemType: 'person' };

describe('canEditField', () => {
  it('lets an admin with a full binding edit', () => {
    expect(canEditField(admin)).toBe(true);
  });

  it('refuses anyone who is not an admin', () => {
    // The signed-out reader and the signed-in contributor both land here;
    // contributors cannot UPDATE these tables at all.
    expect(canEditField({ ...admin, isAdmin: false })).toBe(false);
    expect(canEditField({ ...admin, isAdmin: undefined })).toBe(false);
  });

  it('refuses when there is no token provider to authenticate the write', () => {
    expect(canEditField({ ...admin, getToken: null })).toBe(false);
  });

  it('refuses when the row has no primary key', () => {
    // Works and connection pills reach the panel without their own id; a
    // pencil there would have nothing to write back to.
    expect(canEditField({ ...admin, pkValue: undefined })).toBe(false);
    expect(canEditField({ ...admin, pkValue: '' })).toBe(false);
  });

  it('refuses an item type with no updater', () => {
    expect(canEditField({ ...admin, itemType: 'movement' })).toBe(false);
    expect(canEditField({ ...admin, itemType: undefined })).toBe(false);
  });
});

describe('getTableConfig', () => {
  it('maps each editable item type to its table and primary key', () => {
    expect(getTableConfig('person')).toEqual({ table: 'CH_People', pk: 'person_id' });
    expect(getTableConfig('point')).toEqual({ table: 'CH_Events', pk: 'event_id' });
  });

  it('returns nothing for a type it does not know', () => {
    expect(getTableConfig('movement')).toBeNull();
  });

  // Documents the ambiguity the explicit binding exists to avoid: 'period'
  // resolves to CH_Eras here, but on Lifelines a period is a CH_Movements row.
  // Anything inferring a table from itemType alone would write to the wrong
  // one, which is why callers pass the binding in rather than deriving it.
  it("maps 'period' to CH_Eras, which is why callers must not infer the table", () => {
    expect(getTableConfig('period')).toEqual({ table: 'CH_Eras', pk: 'era_id' });
  });
});
