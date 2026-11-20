export function doesItemFitLift(
  item: { length: number; width: number; height: number },
  lift: { lift_length: number | null; lift_width: number | null; lift_height: number | null }
) {
  // If customer has no lift data, assume it doesn't fit (needs stairs)
  if (!lift.lift_length || !lift.lift_width || !lift.lift_height) return false;

  const itemDims = [item.length, item.width, item.height].sort((a, b) => a - b);
  const liftDims = [lift.lift_length, lift.lift_width, lift.lift_height].sort((a, b) => a - b);

  return (
    itemDims[0] <= liftDims[0] &&
    itemDims[1] <= liftDims[1] &&
    itemDims[2] <= liftDims[2]
  );
}