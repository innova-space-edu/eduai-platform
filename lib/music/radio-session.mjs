/** @param {{id: string, source?: string}} track */
export function isRadioTrack(track){return track.source==="radio" || track.id.startsWith("radio-")}
/** @param {number} step
 * @param {number} sourceCount
 * @returns {number | null}
 */
export function nextRadioAttempt(step,sourceCount){const next=step+1;return Math.floor(next/2)<sourceCount?next:null}
