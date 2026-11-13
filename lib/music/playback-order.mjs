/** @param {string[]} order
 * @param {ReadonlySet<string>} playableIds
 * @param {string | undefined} currentId
 * @param {boolean} shuffle
 * @param {boolean} repeatAll
 * @param {Set<string>} visited
 * @param {() => number} [random]
 * @returns {string | undefined}
 */
export function nextPlaybackId(order, playableIds, currentId, shuffle, repeatAll, visited, random = Math.random) {
  const playable = order.filter((id) => playableIds.has(id));
  if (!playable.length) return undefined;
  if (!shuffle) {
    return order.slice(order.indexOf(currentId ?? "") + 1).find((id) => playableIds.has(id)) ??
      (repeatAll ? playable[0] : undefined);
  }
  if (currentId) visited.add(currentId);
  let candidates = playable.filter((id) => !visited.has(id));
  if (!candidates.length && repeatAll) {
    visited.clear();
    if (currentId && playable.length > 1) visited.add(currentId);
    candidates = playable.filter((id) => !visited.has(id));
  }
  return candidates[Math.floor(random() * candidates.length)];
}
