export const colors = ['Kırmızı', 'Mavi', 'Siyah', 'Sarı'];

export function makeDeck() {
  const deck = [];
  for (let c = 0; c < 4; c++) {
    for (let n = 1; n <= 13; n++) {
      for (let copy = 0; copy < 2; copy++) deck.push({c, n, id: deck.length});
    }
  }
  for (let copy = 0; copy < 2; copy++) deck.push({c: -1, n: 0, id: deck.length});
  return deck;
}

export function shuffle(tiles) {
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export const okeyOf = ({c, n}) => ({c, n: n % 13 + 1});
export const isOkey = (tile, key) => tile.c === key.c && tile.n === key.n;
const valueOf = ({c,n}) => c * 13 + n - 1;

function tileValue(tile, key) {
  if (isOkey(tile, key)) return -1;
  return valueOf(tile.c === -1 ? key : tile);
}

const melds = Array.from({length: 52}, () => []);
function addMeld(values) {
  for (const value of values) melds[value].push(values.filter(item => item !== value));
}

for (let c = 0; c < 4; c++) {
  for (let start = 1; start <= 11; start++) {
    const run = [];
    for (let end = start; end <= 14; end++) {
      if (end === 14 && start === 1) break;
      run.push(valueOf({c, n: end === 14 ? 1 : end}));
      if (run.length >= 3) addMeld(run);
    }
  }
}

for (let n = 1; n <= 13; n++) {
  const group = colors.map((_, c) => valueOf({c,n}));
  addMeld(group);
  for (const value of group) addMeld(group.filter(item => item !== value));
}

export function winning(hand, key) {
  if (hand.length !== 14) return null;
  const positions = Array(52).fill(0);
  let wild = 0;
  hand.forEach((tile, i) => {
    const value = tileValue(tile, key);
    if (value < 0) wild |= 1 << i;
    else positions[value] |= 1 << i;
  });

  const seen = new Set();
  function solve(mask) {
    if (mask === 0) return true;
    if (seen.has(mask)) return false;
    const pivot = positions.findIndex(bits => bits & mask);
    if (pivot < 0) return false;
    const pivotBits = positions[pivot] & mask;
    const remainder = mask ^ (pivotBits & -pivotBits);

    function match(values, index, available) {
      if (index === values.length) return solve(available);
      const natural = positions[values[index]] & available;
      const joker = wild & available;
      return Boolean(
        (natural && match(values, index + 1, available ^ (natural & -natural))) ||
        (joker && match(values, index + 1, available ^ (joker & -joker)))
      );
    }

    if (melds[pivot].some(values => match(values, 0, remainder))) return true;
    seen.add(mask);
    return false;
  }

  if (solve((1 << 14) - 1)) return 'normal';
  const singles = positions.filter(bits => bits && !(bits & (bits - 1))).length;
  const jokers = Number(Boolean(wild)) + Number(Boolean(wild & (wild - 1)));
  return singles <= jokers ? 'pairs' : null;
}

function potential(hand, key) {
  const counts = Array(52).fill(0);
  let score = 0;
  for (const tile of hand) {
    const value = tileValue(tile, key);
    if (value < 0) score += 10;
    else counts[value]++;
  }

  for (let value = 0; value < counts.length; value++) {
    if (!counts[value]) continue;
    let affinity = 0;
    for (const rest of melds[value]) {
      if (rest.length > 2) continue;
      const matches = Number(Boolean(counts[rest[0]])) + Number(Boolean(counts[rest[1]]));
      affinity = Math.max(affinity, matches === 2 ? 3 : matches);
    }
    score += affinity + (counts[value] > 1 ? 0.7 : 0);
  }
  return score;
}

export function chooseDiscard(hand, key) {
  let best;
  hand.forEach((tile, index) => {
    const rest = hand.filter((_, i) => i !== index);
    const win = winning(rest, key);
    const points = (win === 'pairs' ? 4 : 2) * (isOkey(tile, key) ? 2 : 1);
    const score = win ? 1000 + points : potential(rest, key);
    if (!best || score > best.score) best = {index, win, score, points};
  });
  return best;
}
