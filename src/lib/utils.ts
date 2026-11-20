export type ItemSize = { length: number; width: number; height: number; weight: number };
export type LiftSize = {
  lift_length: number | null;
  lift_width: number | null;
  lift_height: number | null;
  has_staircase_only: boolean | null;
};

/** Longest/heaviest item two people can still carry up a normal staircase. */
export const MAX_STAIR_CARRY_LENGTH_CM = 200;
export const MAX_STAIR_CARRY_WEIGHT_KG = 60;

export function doesItemFitLift(item: Omit<ItemSize, 'weight'>, lift: LiftSize) {
  if (lift.has_staircase_only) return false;
  if (!lift.lift_length || !lift.lift_width || !lift.lift_height) return false;

  // Compare smallest-to-smallest, middle-to-middle, largest-to-largest so the
  // item may be rotated in any direction to go in.
  const itemDims = [item.length, item.width, item.height].sort((a, b) => a - b);
  const liftDims = [lift.lift_length, lift.lift_width, lift.lift_height].sort((a, b) => a - b);

  return itemDims.every((dim, i) => dim <= liftDims[i]);
}

export type Handling = 'lift' | 'stairs' | 'hoist';

export const HANDLING_LABEL: Record<Handling, string> = {
  lift: 'Fits lift',
  stairs: 'Staircase carry',
  hoist: 'Rope / crane lift',
};

/**
 * lift   – item fits the lift cabin in some orientation
 * stairs – no lift (or does not fit), but small/light enough for a 2-person stair carry
 * hoist  – too long or heavy for the stairs: needs a rope or crane lift through a window/balcony
 */
export function itemHandling(item: ItemSize, lift: LiftSize): Handling {
  if (doesItemFitLift(item, lift)) return 'lift';
  const longest = Math.max(item.length, item.width, item.height);
  if (longest <= MAX_STAIR_CARRY_LENGTH_CM && item.weight <= MAX_STAIR_CARRY_WEIGHT_KG) return 'stairs';
  return 'hoist';
}

const RANK: Record<Handling, number> = { lift: 0, stairs: 1, hoist: 2 };

/** Worst handling across all items of an order. */
export function orderHandling(items: ItemSize[], lift: LiftSize): Handling {
  return items.reduce<Handling>((worst, item) => {
    const h = itemHandling(item, lift);
    return RANK[h] > RANK[worst] ? h : worst;
  }, 'lift');
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
