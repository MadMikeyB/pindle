const GAME_CONFIG = {
  maxRows: 6,
  pinLength: 4,
};

const STORAGE_KEY_PREFIX = 'pindle-state-';
const THEME_STORAGE_KEY = 'pindle-theme';

function createState(config) {
  return {
    rowIndex: 0,
    colIndex: 0,
    isGameOver: false,
    guesses: Array.from({ length: config.maxRows }, () => Array(config.pinLength).fill('')),
    results: Array.from({ length: config.maxRows }, () => Array(config.pinLength).fill('')),
  };
}

function getDom() {
  return {
    tiles: [...document.querySelectorAll('.pindle-game__tile')],
    keyButtons: [...document.querySelectorAll('.pindle-keyboard__key')],
    messageEl: document.querySelector('.js-message'),
    hintButton: document.querySelector('.js-hint'),
    shareButton: document.querySelector('.js-share'),
    themeButtons: [...document.querySelectorAll('.js-theme-btn')],
  };
}

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(themePreference) {
  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }
  return systemTheme();
}

function setTheme(themePreference, dom) {
  const appliedTheme = resolveTheme(themePreference);
  document.documentElement.setAttribute('data-theme', appliedTheme);

  dom.themeButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.theme === themePreference);
  });
}

function loadThemePreference() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function saveThemePreference(themePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, themePreference);
}

function countPossibleCombinations(pinLength) {
  return 10 ** pinLength;
}

function generateDailyPin(date, pinLength) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Deterministic seed: same date always gives the same PIN.
  let seed = year * 10000 + month * 100 + day;
  let pin = '';

  for (let i = 0; i < pinLength; i += 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    pin += String(seed % 10);
  }

  return pin;
}

function dateStamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function tileAt(tiles, row, col, pinLength) {
  return tiles[row * pinLength + col];
}

function updateMessage(dom, text) {
  if (dom.messageEl) {
    dom.messageEl.textContent = text;
  }
}

function updateMessageWithCount(dom, mainText, countText) {
  if (!dom.messageEl) {
    return;
  }

  dom.messageEl.innerHTML = mainText + '<small>' + countText + '</small>';
}

function setShareVisible(dom, isVisible) {
  if (!dom.shareButton || !dom.messageEl) {
    return;
  }

  dom.shareButton.classList.toggle('is-hidden', !isVisible);
  dom.messageEl.classList.toggle('is-hidden', isVisible);
}

function hasSubmittedResultRow(resultRow) {
  return resultRow.some((tileState) => tileState);
}

function sameFeedback(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function countRemainingCandidates(state, config) {
  let possible = 0;
  const max = 10 ** config.pinLength;

  for (let n = 0; n < max; n += 1) {
    const candidate = String(n).padStart(config.pinLength, '0');
    let fitsAllRows = true;

    for (let row = 0; row < config.maxRows; row += 1) {
      if (!hasSubmittedResultRow(state.results[row])) {
        continue;
      }

      const guess = state.guesses[row].join('');
      const expected = state.results[row];
      const actual = scoreGuess(guess, candidate, config.pinLength);

      if (!sameFeedback(actual, expected)) {
        fitsAllRows = false;
        break;
      }
    }

    if (fitsAllRows) {
      possible += 1;
    }
  }

  return possible;
}

function updatePossibleCountMessage(state, dom, config, prefixText) {
  const remaining = countRemainingCandidates(state, config).toLocaleString();
  const mainText = prefixText || 'Guess the 4-digit PIN';
  const countText = remaining + ' combinations left';
  updateMessageWithCount(dom, mainText, countText);
}

function storageKeyForDate(dateStampValue) {
  return STORAGE_KEY_PREFIX + dateStampValue;
}

function saveState(state, config) {
  const payload = {
    rowIndex: state.rowIndex,
    colIndex: state.colIndex,
    isGameOver: state.isGameOver,
    guesses: state.guesses,
    results: state.results,
    hintUsed: state.hintUsed,
    didWin: state.didWin,
  };

  localStorage.setItem(storageKeyForDate(config.todayStamp), JSON.stringify(payload));
}

function loadState(config) {
  const raw = localStorage.getItem(storageKeyForDate(config.todayStamp));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.guesses) || !Array.isArray(parsed.results)) {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function renderBoard(state, dom, config) {
  for (let row = 0; row < config.maxRows; row += 1) {
    for (let col = 0; col < config.pinLength; col += 1) {
      const tile = tileAt(dom.tiles, row, col, config.pinLength);
      const digit = state.guesses[row][col];
      const result = state.results[row][col];

      tile.textContent = digit;
      tile.classList.remove('is-active', 'is-correct', 'is-present', 'is-absent');

      if (!state.isGameOver && row === state.rowIndex && col === state.colIndex) {
        tile.classList.add('is-active');
      }

      if (result === 'correct') {
        tile.classList.add('is-correct');
      } else if (result === 'present') {
        tile.classList.add('is-present');
      } else if (result === 'absent') {
        tile.classList.add('is-absent');
      }
    }
  }
}

function scoreGuess(guessString, secretPin, pinLength) {
  const feedback = Array(pinLength).fill('absent');
  const remainingCounts = {};

  for (let i = 0; i < pinLength; i += 1) {
    if (guessString[i] === secretPin[i]) {
      feedback[i] = 'correct';
    } else {
      const secretDigit = secretPin[i];
      remainingCounts[secretDigit] = (remainingCounts[secretDigit] || 0) + 1;
    }
  }

  for (let i = 0; i < pinLength; i += 1) {
    if (feedback[i] === 'correct') {
      continue;
    }

    const guessDigit = guessString[i];
    if (remainingCounts[guessDigit] > 0) {
      feedback[i] = 'present';
      remainingCounts[guessDigit] -= 1;
    }
  }

  return feedback;
}

function paintKeyboardDigitStates(state, dom, config) {
  const priority = { absent: 1, present: 2, correct: 3 };
  const bestByDigit = {};

  for (let row = 0; row < config.maxRows; row += 1) {
    for (let col = 0; col < config.pinLength; col += 1) {
      const digit = state.guesses[row][col];
      const tileState = state.results[row][col];
      if (!digit || !tileState) {
        continue;
      }

      const currentBest = bestByDigit[digit];
      if (!currentBest || priority[tileState] > priority[currentBest]) {
        bestByDigit[digit] = tileState;
      }
    }
  }

  dom.keyButtons.forEach((button) => {
    const key = button.dataset.key;
    button.classList.remove('is-correct', 'is-present', 'is-absent');

    if (!/^\d$/.test(key)) {
      return;
    }

    const bestState = bestByDigit[key];
    if (bestState === 'correct') {
      button.classList.add('is-correct');
    } else if (bestState === 'present') {
      button.classList.add('is-present');
    } else if (bestState === 'absent') {
      button.classList.add('is-absent');
    }
  });
}

function addDigit(state, dom, config, digit) {
  if (state.colIndex >= config.pinLength) {
    return;
  }

  state.guesses[state.rowIndex][state.colIndex] = digit;
  state.colIndex += 1;
  renderBoard(state, dom, config);
  saveState(state, config);
}

function backspaceDigit(state, dom, config) {
  if (state.colIndex <= 0) {
    return;
  }

  state.colIndex -= 1;
  state.guesses[state.rowIndex][state.colIndex] = '';
  renderBoard(state, dom, config);
  saveState(state, config);
}

function submitGuess(state, dom, config) {
  if (state.colIndex < config.pinLength) {
    updateMessage(dom, 'Need 4 digits before submitting');
    return;
  }

  const guessString = state.guesses[state.rowIndex].join('');
  const feedback = scoreGuess(guessString, config.secretPin, config.pinLength);
  state.results[state.rowIndex] = feedback;

  renderBoard(state, dom, config);
  paintKeyboardDigitStates(state, dom, config);

  const isWin = feedback.every((tileState) => tileState === 'correct');
  if (isWin) {
    state.isGameOver = true;
    state.didWin = true;
    setShareVisible(dom, true);
    updateMessage(dom, 'You cracked it: ' + config.secretPin);
    renderBoard(state, dom, config);
    saveState(state, config);
    return;
  }

  state.rowIndex += 1;
  state.colIndex = 0;

  if (state.rowIndex >= config.maxRows) {
    state.isGameOver = true;
    state.didWin = false;
    updateMessage(dom, 'PIN was ' + config.secretPin);
    renderBoard(state, dom, config);
    saveState(state, config);
    return;
  }

  updatePossibleCountMessage(state, dom, config, '');
  renderBoard(state, dom, config);
  saveState(state, config);
}

function guessCountUsed(state) {
  for (let i = 0; i < state.results.length; i += 1) {
    if (state.results[i].some((result) => result)) {
      continue;
    }
    return i;
  }
  return state.results.length;
}

function getHint(state, config) {
  const unlockedIndexes = [];

  for (let index = 0; index < config.pinLength; index += 1) {
    let alreadyKnown = false;
    for (let row = 0; row < config.maxRows; row += 1) {
      if (state.results[row][index] === 'correct') {
        alreadyKnown = true;
        break;
      }
    }

    if (!alreadyKnown) {
      unlockedIndexes.push(index);
    }
  }

  const source =
    unlockedIndexes.length > 0
      ? unlockedIndexes
      : Array.from({ length: config.pinLength }, (_, index) => index);
  const randomIndex = source[Math.floor(Math.random() * source.length)];
  return { index: randomIndex, digit: config.secretPin[randomIndex] };
}

function emojiForState(tileState) {
  if (tileState === 'correct') {
    return '🟩';
  }
  if (tileState === 'present') {
    return '🟨';
  }
  return '⬛';
}

function buildShareText(state, config) {
  const usedRows = guessCountUsed(state);
  const score = state.results[state.rowIndex].every((tileState) => tileState === 'correct')
    ? String(state.rowIndex + 1)
    : 'X';

  const hintLabel = state.hintUsed ? 'Hint used: yes' : 'Hint used: no';
  const lines = ['Pindle ' + config.todayStamp + ' ' + score + '/' + config.maxRows, hintLabel, ''];

  for (let row = 0; row < usedRows; row += 1) {
    const line = state.results[row].map(emojiForState).join('');
    lines.push(line);
  }

  lines.push('');
  lines.push(window.location.href);

  return lines.join('\n');
}

async function copyShareResult(state, dom, config) {
  const shareText = buildShareText(state, config);
  const originalLabel = dom.shareButton ? dom.shareButton.textContent : 'Share Result';

  function setShareLabel(label) {
    if (dom.shareButton) {
      dom.shareButton.textContent = label;
    }
  }

  function restoreShareLabel() {
    window.setTimeout(() => {
      setShareLabel(originalLabel);
    }, 1400);
  }

  async function copyWithClipboardApi() {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function copyWithExecCommand() {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.inset = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch (_error) {
      return false;
    }
  }

  const copiedViaClipboardApi = await copyWithClipboardApi();
  const copiedViaExecCommand = copiedViaClipboardApi ? false : copyWithExecCommand();

  if (copiedViaClipboardApi || copiedViaExecCommand) {
    setShareLabel('Copied!');
    restoreShareLabel();
    return;
  }

  setShareLabel('Copy blocked');
  restoreShareLabel();
}

function handleInputKey(state, dom, config, rawKey) {
  if (state.isGameOver) {
    return;
  }

  const key = rawKey.toLowerCase();

  if (/^\d$/.test(key)) {
    addDigit(state, dom, config, key);
    return;
  }

  if (key === 'backspace') {
    backspaceDigit(state, dom, config);
    return;
  }

  if (key === 'enter') {
    submitGuess(state, dom, config);
  }
}

function bindEvents(state, dom, config) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === 'Backspace' || /^\d$/.test(event.key)) {
      event.preventDefault();
    }
    handleInputKey(state, dom, config, event.key);
  });

  dom.keyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.key;
      if (!key) {
        return;
      }
      handleInputKey(state, dom, config, key);
    });
  });

  if (dom.hintButton) {
    dom.hintButton.addEventListener('click', () => {
      if (state.isGameOver) {
        return;
      }

      if (state.hintUsed) {
        updateMessage(dom, 'Hint already used');
        return;
      }

      const wantsHint = window.confirm('Are you sure you want a hint?');
      if (!wantsHint) {
        return;
      }

      state.hintUsed = true;
      const hint = getHint(state, config);
      updatePossibleCountMessage(state, dom, config, 'Hint: includes the digit ' + hint.digit);
      saveState(state, config);
    });
  }

  if (dom.shareButton) {
    dom.shareButton.addEventListener('click', async () => {
      await copyShareResult(state, dom, config);
    });
  }

  dom.themeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const themePreference = button.dataset.theme;
      saveThemePreference(themePreference);
      setTheme(themePreference, dom);
    });
  });

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentPreference = loadThemePreference();
    if (currentPreference === 'system') {
      setTheme('system', dom);
    }
  });
}

function init() {
  const dom = getDom();
  const themePreference = loadThemePreference();
  setTheme(themePreference, dom);

  const now = new Date();
  const config = {
    ...GAME_CONFIG,
    secretPin: generateDailyPin(now, GAME_CONFIG.pinLength),
    todayStamp: dateStamp(now),
  };
  const state = {
    ...createState(config),
    hintUsed: false,
    didWin: false,
  };

  const savedState = loadState(config);
  if (savedState) {
    state.rowIndex = savedState.rowIndex;
    state.colIndex = savedState.colIndex;
    state.isGameOver = savedState.isGameOver;
    state.guesses = savedState.guesses;
    state.results = savedState.results;
    state.hintUsed = Boolean(savedState.hintUsed);
    state.didWin = Boolean(savedState.didWin);
  }

  setShareVisible(dom, false);
  bindEvents(state, dom, config);
  renderBoard(state, dom, config);

  if (state.isGameOver && state.didWin) {
    setShareVisible(dom, true);
  }

  if (state.isGameOver && !state.didWin) {
    updateMessage(dom, 'Out of tries. PIN was ' + config.secretPin);
    return;
  }

  if (state.isGameOver && state.didWin) {
    updateMessage(dom, 'You cracked it: ' + config.secretPin);
    return;
  }

  if (!savedState) {
    updatePossibleCountMessage(state, dom, config);
    saveState(state, config);
    return;
  }

  if (!state.isGameOver) {
    updatePossibleCountMessage(state, dom, config);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
