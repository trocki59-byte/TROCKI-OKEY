import {colors, makeDeck, shuffle, okeyOf, isOkey, winning, chooseDiscard} from './rules.mjs';

const $ = id => document.getElementById(id);
const names = ['Troçki', 'Deniz', 'Leyla', 'Cem'];
const portraits = ['trocki', 'deniz', 'leyla', 'cem'];

function portrait(index) {
  return `<svg class="avatar" aria-hidden="true" focusable="false" viewBox="0 0 40 48"><use href="./icons/players.svg#${portraits[index]}"></use></svg>`;
}
const slots = 16;
let scores, round, deck, indicator, key, hands, discards, player, phase;
let selected, recent, timer, message, dragSlot, matchOver;

function tileLabel(tile) {
  if (tile.c === -1) return 'Sahte okey';
  return `${colors[tile.c]} ${tile.n}${isOkey(tile, key) ? ', okey' : ''}`;
}

function tileMarkup(tile) {
  const special = tile.c === -1;
  return `<span class="tile c${special ? key.c : tile.c}" aria-label="${tileLabel(tile)}" title="${tileLabel(tile)}">${special ? '✦' : tile.n}<i aria-hidden="true">${special ? '·' : isOkey(tile, key) ? '✦' : '•'}</i></span>`;
}

function beginMatch() {
  round = 1;
  scores = names.map(() => 20);
  matchOver = false;
  deal();
}

function deal() {
  clearTimeout(timer);
  player = (round - 1) % names.length;
  phase = 'discard';
  deck = shuffle(makeDeck());
  const index = deck.findIndex(tile => tile.c !== -1);
  [indicator] = deck.splice(index, 1);
  key = okeyOf(indicator);
  hands = names.map((_, i) => deck.splice(-14 - Number(i === player)));
  while (hands[0].length < slots) hands[0].push(null);
  discards = names.map(() => []);
  selected = recent = dragSlot = null;
  sortHand('color');
  message = player === 0 ? 'Sıra sende. Atacağın taşı seç.' : `${names[player]} ilk taşı atacak.`;
  render();
  queueBot();
}

function previousPile() {
  return discards[(player + names.length - 1) % names.length];
}

function sortHand(mode) {
  const sorted = hands[0].filter(Boolean).sort((a, b) => {
    const color = a.c - b.c;
    const number = a.n - b.n;
    return mode === 'color' ? color || number : number || color;
  });
  hands[0] = [...sorted, ...Array(slots - sorted.length).fill(null)];
}

function render() {
  const hand = hands[0];
  const human = player === 0 && phase !== 'over';
  const canDraw = human && phase === 'draw';
  const canDiscard = human && phase === 'discard' && selected !== null;
  const oldFocus = document.activeElement?.dataset.slot;
  $('round').textContent = `${round}. El`;
  $('indicator').innerHTML = tileMarkup(indicator);
  $('key').innerHTML = tileMarkup(key);
  $('stock-count').textContent = deck.length;
  $('stock').disabled = !canDraw || !deck.length;
  const left = discards[3].at(-1);
  $('previous').innerHTML = left ? tileMarkup(left) : '–';
  $('previous').setAttribute('aria-label', left ? `Solundaki taşı al: ${tileLabel(left)}` : 'Solunda atılmış taş yok');
  $('previous').disabled = !canDraw || !left;
  $('hand-count').textContent = `${hand.filter(Boolean).length} taş`;
  $('status').textContent = message;
  $('discard').disabled = !canDiscard;
  $('finish').disabled = phase !== 'over' && !canDiscard;
  $('finish').innerHTML = phase === 'over' ? (matchOver ? 'Yeni maç' : 'Sonraki el') : 'Bitir <span aria-hidden="true">✦</span>';

  $('rack').innerHTML = hand.map((tile, i) => {
    const active = Boolean(tile && tile.id === selected);
    const highlight = tile && tile.id === recent ? ' recent' : '';
    const label = tile ? tileLabel(tile) : `Boş yuva ${i + 1}`;
    return `<button type="button" data-slot="${i}" class="slot${active ? ' selected' : ''}${highlight}" aria-label="${label}"${tile ? ` aria-pressed="${active}" draggable="true"` : ''}>${tile ? tileMarkup(tile) : ''}</button>`;
  }).join('');
  if (oldFocus !== undefined) $('rack').querySelector(`[data-slot="${oldFocus}"]`)?.focus({preventScroll:true});

  names.forEach((name, i) => {
    const seat = $(`seat-${i}`);
    const active = player === i && phase !== 'over';
    seat.classList.toggle('active', active);
    seat.setAttribute('aria-label', active ? `Sıra ${name} adlı oyuncuda` : name);
    seat.innerHTML = `${portrait(i)}<b>${i === 0 ? 'Sen' : name}</b><small>${active ? 'Sıra burada' : i === 0 ? 'Oyuncu' : 'Bot'}</small>`;
  });
  $('scores').innerHTML = names.map((name, i) => `<li>${portrait(i)}${name}${i === 0 ? ' (sen)' : ''}<strong>${scores[i]}</strong></li>`).join('');
}

function moveTile(from, to) {
  if (from < 0 || from === to || !hands[0][from]) return;
  const hand = hands[0];
  [hand[from], hand[to]] = [hand[to], hand[from]];
  selected = null;
  render();
}

function selectSlot(index) {
  const hand = hands[0];
  const tile = hand[index];
  if (selected !== null) {
    const from = hand.findIndex(item => item?.id === selected);
    if (from !== index) return moveTile(from, index);
  }
  selected = selected === null && tile ? tile.id : null;
  render();
}

function draw(fromLeft) {
  if (player !== 0 || phase !== 'draw') return;
  const tile = fromLeft ? previousPile().pop() : deck.pop();
  if (!tile) return;
  hands[0][hands[0].indexOf(null)] = tile;
  recent = tile.id;
  phase = 'discard';
  message = `${tileLabel(tile)} aldın. Atacağın taşı seç.`;
  selected = null;
  render();
}

function discard(index, finish = false) {
  const hand = hands[player];
  const tile = hand[index];
  if (phase !== 'discard' || !tile) return;
  const remaining = hand.filter((item, i) => item && i !== index);
  if (finish) {
    const win = winning(remaining, key);
    if (!win) {
      message = 'Kalan 14 taş geçerli perlere ya da yedi çifte ayrılmıyor.';
      render();
      return;
    }
    const points = (win === 'pairs' ? 4 : 2) * (isOkey(tile, key) ? 2 : 1);
    if (player === 0) hand[index] = null;
    else hand.splice(index, 1);
    discards[player].push(tile);
    return endRound(player, points, win, remaining);
  }

  if (player === 0) hand[index] = null;
  else hand.splice(index, 1);
  discards[player].push(tile);
  selected = recent = null;
  player = (player + 1) % names.length;
  phase = 'draw';
  if (!deck.length) return endRound();
  message = player === 0
    ? `Cem ${tileLabel(tile)} attı. Soldan al veya desteden çek.`
    : `Sıra ${names[player]} adlı oyuncuda.`;
  render();
  queueBot();
}

function queueBot() {
  clearTimeout(timer);
  if (player !== 0 && phase !== 'over') timer = setTimeout(playBot, 580);
}

function playBot() {
  if (player === 0 || phase === 'over') return;
  if (phase === 'draw') {
    const hand = hands[player];
    const left = previousPile().at(-1);
    const choice = left && chooseDiscard([...hand, left], key);
    const keepLeft = choice && choice.index !== hand.length;
    hand.push(keepLeft ? previousPile().pop() : deck.pop());
    phase = 'discard';
  }
  const choice = chooseDiscard(hands[player], key);
  discard(choice.index, Boolean(choice.win));
}

function endRound(winner, points, win, tiles = []) {
  clearTimeout(timer);
  phase = 'over';
  selected = recent = null;
  if (winner !== undefined) {
    scores = scores.map((score, i) => i === winner ? score : Math.max(0, score - points));
  }
  matchOver = scores.includes(0);
  const best = Math.max(...scores);
  const leaders = names.filter((_, i) => scores[i] === best);
  const handResult = winner === undefined ? 'Deste tükendi' : winner === 0 ? 'Bu eli sen aldın!' : `${names[winner]} bu eli aldı`;
  const matchResult = leaders.length > 1 ? `Birincilik paylaşıldı: ${leaders.join(', ')}` : leaders[0] === names[0] ? 'Maçı sen kazandın!' : `${leaders[0]} maçı kazandı`;
  message = matchOver ? matchResult : handResult;
  render();
  $('result-kicker').textContent = matchOver ? 'MAÇ SONU' : 'EL SONU';
  $('result-title').textContent = message;
  $('result-detail').textContent = winner === undefined ? 'Puanlar aynı kaldı.' :
    `${matchOver ? handResult + '. ' : ''}${win === 'pairs' ? 'Yedi çiftle bitiş' : 'Perlerle bitiş'}. Diğer oyuncular ${points} puan kaybetti.`;
  $('result-tiles').innerHTML = tiles.map(tileMarkup).join('');
  $('next-round').textContent = matchOver ? 'Yeni maç' : 'Sonraki el';
  if (document.querySelector('dialog[open]')) return;
  $('result').showModal();
}

function continueMatch() {
  $('result').close();
  if (matchOver) beginMatch();
  else {
    round++;
    deal();
  }
}

$('stock').addEventListener('click', () => draw(false));
$('previous').addEventListener('click', () => draw(true));
$('rack').addEventListener('click', event => {
  const slot = event.target.closest('.slot');
  if (slot) selectSlot(Number(slot.dataset.slot));
});
$('rack').addEventListener('dragstart', event => {
  const slot = event.target.closest('[draggable="true"]');
  if (!slot) return;
  dragSlot = Number(slot.dataset.slot);
  event.dataTransfer.setData('text/plain', slot.dataset.slot);
  event.dataTransfer.effectAllowed = 'move';
});
$('rack').addEventListener('dragover', event => {
  if (dragSlot !== null && event.target.closest('.slot')) event.preventDefault();
});
$('rack').addEventListener('drop', event => {
  const target = event.target.closest('.slot');
  if (dragSlot === null || !target) return;
  event.preventDefault();
  moveTile(dragSlot, Number(target.dataset.slot));
  dragSlot = null;
});
$('rack').addEventListener('dragend', () => { dragSlot = null; });

for (const mode of ['color', 'value']) {
  $(`sort-${mode}`).addEventListener('click', () => { sortHand(mode); render(); });
}
$('discard').addEventListener('click', () => discard(hands[0].findIndex(tile => tile?.id === selected)));
$('finish').addEventListener('click', () => {
  if (phase === 'over') continueMatch();
  else discard(hands[0].findIndex(tile => tile?.id === selected), true);
});
$('help').addEventListener('click', () => $('rules').showModal());
$('reset').addEventListener('click', () => {
  $('confirm').returnValue = '';
  $('confirm').showModal();
});
$('confirm').addEventListener('close', () => {
  if ($('confirm').returnValue === 'reset') beginMatch();
});
$('review').addEventListener('click', () => $('result').close());
$('next-round').addEventListener('click', continueMatch);
beginMatch();
