/**
 * Calculates scores for all players after a game.
 *
 * @param {object} params
 * @param {boolean} params.isWallGame
 * @param {string} params.winnerId  - player index (0-3) or null for wall game
 * @param {number} params.basePoints
 * @param {boolean} params.noJokers - true if no jokers used
 * @param {boolean} params.selfDraw
 * @param {number} params.exposures - 0-3
 * @param {boolean} params.isQuints - only relevant when exposures === 2
 * @param {string|null} params.discarderId - player index of discarder, null if self-draw
 * @returns {number[]} array of 4 scores (indexed by player position)
 */
export function calculateScores({
  isWallGame,
  winnerId,
  basePoints,
  noJokers,
  selfDraw,
  exposures,
  isQuints,
  discarderId,
}) {
  if (isWallGame) {
    return [10, 10, 10, 10];
  }

  const scores = [0, 0, 0, 0];

  // Winner score
  let winnerPoints = basePoints;
  if (noJokers) winnerPoints += 10;
  if (selfDraw) winnerPoints += 10;
  scores[winnerId] = winnerPoints;

  // Discarder penalty (only applies on non-self-draw)
  if (!selfDraw && discarderId !== null && discarderId !== undefined) {
    let penalty = 0;
    if (exposures <= 1) penalty = -10;
    else if (exposures === 2) penalty = isQuints ? -25 : -20;
    else penalty = -25;
    scores[discarderId] = penalty;
  }

  return scores;
}
