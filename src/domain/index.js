import solve from '@mattflow/sudoku-solver'

const SUDOKU_SIZE = 9
const EMPTY_GRID = Array.from({ length: SUDOKU_SIZE }, () => Array(SUDOKU_SIZE).fill(0))

function solvePuzzle(grid) {
  const solution = solve(grid.flat().join(''), {
    outputArray: true,
    hintCheck: false,
  })

  if (!Array.isArray(solution) || solution.length !== SUDOKU_SIZE * SUDOKU_SIZE) {
    throw new Error('unable to solve puzzle grid')
  }

  return Array.from({ length: SUDOKU_SIZE }, (_, row) =>
    Array.from({ length: SUDOKU_SIZE }, (_, col) => solution[row * SUDOKU_SIZE + col]),
  )
}

function cloneGrid(grid) {
  return grid.map((row) => [...row])
}

function createEmptyGrid() {
  return cloneGrid(EMPTY_GRID)
}

function validateGrid(grid, label = 'grid') {
  if (!Array.isArray(grid) || grid.length !== SUDOKU_SIZE) {
    throw new Error(`${label} must be a 9x9 grid`)
  }

  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== SUDOKU_SIZE) {
      throw new Error(`${label} must be a 9x9 grid`)
    }

    for (const cell of row) {
      if (!Number.isInteger(cell) || cell < 0 || cell > 9) {
        throw new Error(`${label} must only contain integers between 0 and 9`)
      }
    }
  }
}

function validateMove(move) {
  if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col) || !Number.isInteger(move.value)) {
    throw new Error('move must include integer row, col and value')
  }

  if (move.row < 0 || move.row >= SUDOKU_SIZE || move.col < 0 || move.col >= SUDOKU_SIZE) {
    throw new Error('move must target a valid cell')
  }

  if (move.value < 0 || move.value > 9) {
    throw new Error('move value must be between 0 and 9')
  }
}

function createCellKey(row, col) {
  return `${row},${col}`
}

function normalizeCandidateMarks(candidateMarks = {}) {
  const normalized = {}

  for (const [key, values] of Object.entries(candidateMarks)) {
    const uniqueValues = [...new Set((values || []).filter((value) => Number.isInteger(value) && value >= 1 && value <= 9))]
      .sort((left, right) => left - right)

    if (uniqueValues.length > 0) {
      normalized[key] = uniqueValues
    }
  }

  return normalized
}

function serializeGrid(grid) {
  return grid.flat().join('')
}

function createSudokuInternal({ puzzleGrid, currentGrid, solutionGrid }) {
  validateGrid(puzzleGrid, 'puzzleGrid')
  validateGrid(currentGrid, 'currentGrid')

  const puzzle = cloneGrid(puzzleGrid)
  const current = cloneGrid(currentGrid)
  const solution = solutionGrid ? cloneGrid(solutionGrid) : solvePuzzle(puzzle)

  validateGrid(solution, 'solutionGrid')

  for (let row = 0; row < SUDOKU_SIZE; row += 1) {
    for (let col = 0; col < SUDOKU_SIZE; col += 1) {
      if (puzzle[row][col] !== 0 && current[row][col] !== puzzle[row][col]) {
        throw new Error('currentGrid cannot change fixed puzzle cells')
      }
    }
  }

  function isFixedCell(row, col) {
    return puzzle[row][col] !== 0
  }

  function getConflicts() {
    const invalid = new Set()

    const addConflict = (row, col) => {
      invalid.add(createCellKey(row, col))
    }

    for (let row = 0; row < SUDOKU_SIZE; row += 1) {
      for (let col = 0; col < SUDOKU_SIZE; col += 1) {
        const value = current[row][col]
        if (value === 0) {
          continue
        }

        for (let index = 0; index < SUDOKU_SIZE; index += 1) {
          if (index !== col && current[row][index] === value) {
            addConflict(row, col)
            addConflict(row, index)
          }

          if (index !== row && current[index][col] === value) {
            addConflict(row, col)
            addConflict(index, col)
          }
        }

        const boxStartRow = Math.floor(row / 3) * 3
        const boxStartCol = Math.floor(col / 3) * 3
        for (let boxRow = boxStartRow; boxRow < boxStartRow + 3; boxRow += 1) {
          for (let boxCol = boxStartCol; boxCol < boxStartCol + 3; boxCol += 1) {
            if ((boxRow !== row || boxCol !== col) && current[boxRow][boxCol] === value) {
              addConflict(row, col)
              addConflict(boxRow, boxCol)
            }
          }
        }
      }
    }

    return [...invalid]
      .map((key) => {
        const [row, col] = key.split(',').map(Number)
        return { row, col }
      })
      .sort((left, right) => left.row - right.row || left.col - right.col)
  }

  function getCandidates({ row, col }) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      throw new Error('row and col are required')
    }

    if (row < 0 || row >= SUDOKU_SIZE || col < 0 || col >= SUDOKU_SIZE) {
      throw new Error('row and col must point to a valid cell')
    }

    if (current[row][col] !== 0) {
      return []
    }

    const candidates = []
    for (let value = 1; value <= 9; value += 1) {
      let valid = true

      for (let index = 0; index < SUDOKU_SIZE; index += 1) {
        if (current[row][index] === value || current[index][col] === value) {
          valid = false
          break
        }
      }

      if (!valid) {
        continue
      }

      const boxStartRow = Math.floor(row / 3) * 3
      const boxStartCol = Math.floor(col / 3) * 3
      for (let boxRow = boxStartRow; boxRow < boxStartRow + 3 && valid; boxRow += 1) {
        for (let boxCol = boxStartCol; boxCol < boxStartCol + 3; boxCol += 1) {
          if (current[boxRow][boxCol] === value) {
            valid = false
            break
          }
        }
      }

      if (valid) {
        candidates.push(value)
      }
    }

    return candidates
  }

  return {
    getPuzzleGrid() {
      return cloneGrid(puzzle)
    },

    getGrid() {
      return cloneGrid(current)
    },

    getSolutionGrid() {
      return cloneGrid(solution)
    },

    isFixedCell,

    guess(move) {
      validateMove(move)

      if (isFixedCell(move.row, move.col)) {
        throw new Error('cannot change a fixed puzzle cell')
      }

      current[move.row][move.col] = move.value
      return this.getGrid()
    },

    getCandidates,

    findNextHint() {
      for (let row = 0; row < SUDOKU_SIZE; row += 1) {
        for (let col = 0; col < SUDOKU_SIZE; col += 1) {
          if (current[row][col] !== 0) {
            continue
          }

          const candidates = getCandidates({ row, col })
          if (candidates.length === 1) {
            return { row, col, value: candidates[0], candidates }
          }
        }
      }

      return null
    },

    getConflicts,

    hasConflict() {
      return getConflicts().length > 0
    },

    isSolved() {
      for (let row = 0; row < SUDOKU_SIZE; row += 1) {
        for (let col = 0; col < SUDOKU_SIZE; col += 1) {
          if (current[row][col] === 0) {
            return false
          }
        }
      }

      return getConflicts().length === 0
    },

    clone() {
      return createSudokuInternal({
        puzzleGrid: puzzle,
        currentGrid: current,
        solutionGrid: solution,
      })
    },

    toJSON() {
      return {
        puzzleGrid: cloneGrid(puzzle),
        currentGrid: cloneGrid(current),
        solutionGrid: cloneGrid(solution),
      }
    },

    toString() {
      return current
        .map((row) => row.map((value) => (value === 0 ? '.' : String(value))).join(' '))
        .join('\n')
    },
  }
}

export function createSudoku(puzzleGrid) {
  return createSudokuInternal({
    puzzleGrid,
    currentGrid: puzzleGrid,
  })
}

export function createSudokuFromJSON(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('sudoku JSON payload is required')
  }

  return createSudokuInternal({
    puzzleGrid: json.puzzleGrid,
    currentGrid: json.currentGrid,
    solutionGrid: json.solutionGrid,
  })
}

function createGameInternal({
  sudoku,
  hintQuota = Infinity,
  remainingHints = hintQuota,
  usedHints = 0,
  candidateMarks = {},
  mode = 'normal',
  explore = null,
  history = { past: [], future: [] },
}) {
  if (!sudoku || typeof sudoku.getGrid !== 'function' || typeof sudoku.toJSON !== 'function') {
    throw new Error('game requires a valid sudoku instance')
  }

  let currentSudoku = sudoku
  let currentHintQuota = Number.isFinite(hintQuota) ? Math.max(0, hintQuota) : Infinity
  let currentRemainingHints = currentHintQuota === Infinity ? Infinity : Math.max(0, Math.min(remainingHints, currentHintQuota))
  let currentUsedHints = Math.max(0, usedHints)
  let currentCandidateMarks = normalizeCandidateMarks(candidateMarks)
  let currentMode = mode === 'explore' ? 'explore' : 'normal'
  let currentExplore = explore
    ? {
        baseSnapshot: explore.baseSnapshot,
        failedStates: new Set(explore.failedStates || []),
        failed: Boolean(explore.failed),
        failureReason: explore.failureReason || '',
      }
    : null
  let past = (history.past || []).map((snapshot) => JSON.parse(JSON.stringify(snapshot)))
  let future = (history.future || []).map((snapshot) => JSON.parse(JSON.stringify(snapshot)))

  function getSerializableExplore() {
    if (!currentExplore) {
      return null
    }

    return {
      baseSnapshot: JSON.parse(JSON.stringify(currentExplore.baseSnapshot)),
      failedStates: [...currentExplore.failedStates],
      failed: currentExplore.failed,
      failureReason: currentExplore.failureReason,
    }
  }

  function createSnapshot() {
    return {
      sudoku: currentSudoku.toJSON(),
      hintQuota: currentHintQuota,
      remainingHints: currentRemainingHints,
      usedHints: currentUsedHints,
      candidateMarks: JSON.parse(JSON.stringify(currentCandidateMarks)),
      mode: currentMode,
      explore: getSerializableExplore(),
    }
  }

  function restoreSnapshot(snapshot) {
    currentSudoku = createSudokuFromJSON(snapshot.sudoku)
    currentHintQuota = snapshot.hintQuota
    currentRemainingHints = snapshot.remainingHints
    currentUsedHints = snapshot.usedHints
    currentCandidateMarks = normalizeCandidateMarks(snapshot.candidateMarks)
    currentMode = snapshot.mode === 'explore' ? 'explore' : 'normal'
    currentExplore = snapshot.explore
      ? {
          baseSnapshot: JSON.parse(JSON.stringify(snapshot.explore.baseSnapshot)),
          failedStates: new Set(snapshot.explore.failedStates || []),
          failed: Boolean(snapshot.explore.failed),
          failureReason: snapshot.explore.failureReason || '',
        }
      : null
  }

  function pushHistory() {
    past.push(createSnapshot())
    future = []
  }

  function clearCellCandidates(row, col) {
    const key = createCellKey(row, col)
    if (currentCandidateMarks[key]) {
      delete currentCandidateMarks[key]
    }
  }

  function updateExploreFailureState() {
    if (!currentExplore) {
      return
    }

    const grid = currentSudoku.getGrid()
    const serialized = serializeGrid(grid)

    if (currentExplore.failedStates.has(serialized)) {
      currentExplore.failed = true
      currentExplore.failureReason = 'This exploration path already failed before.'
      return
    }

    if (currentSudoku.hasConflict()) {
      currentExplore.failed = true
      currentExplore.failureReason = 'This exploration path has a conflict.'
      currentExplore.failedStates.add(serialized)
      return
    }

    const solutionGrid = currentSudoku.getSolutionGrid()
    for (let row = 0; row < SUDOKU_SIZE; row += 1) {
      for (let col = 0; col < SUDOKU_SIZE; col += 1) {
        if (grid[row][col] !== 0 && grid[row][col] !== solutionGrid[row][col]) {
          currentExplore.failed = true
          currentExplore.failureReason = 'This exploration path cannot reach the known solution.'
          currentExplore.failedStates.add(serialized)
          return
        }
      }
    }

    currentExplore.failed = false
    currentExplore.failureReason = ''
  }

  function getNextProgressHint() {
    if (currentSudoku.hasConflict()) {
      return null
    }

    const directHint = currentSudoku.findNextHint()
    if (directHint) {
      return { ...directHint, kind: 'single-candidate' }
    }

    const grid = currentSudoku.getGrid()
    const solutionGrid = currentSudoku.getSolutionGrid()
    for (let row = 0; row < SUDOKU_SIZE; row += 1) {
      for (let col = 0; col < SUDOKU_SIZE; col += 1) {
        if (grid[row][col] === 0) {
          return {
            row,
            col,
            value: solutionGrid[row][col],
            candidates: currentSudoku.getCandidates({ row, col }),
            kind: 'solution',
          }
        }
      }
    }

    return null
  }

  return {
    getSudoku() {
      return currentSudoku.clone()
    },

    guess(move) {
      validateMove(move)
      pushHistory()
      currentSudoku.guess(move)
      clearCellCandidates(move.row, move.col)
      updateExploreFailureState()
      return currentSudoku.getGrid()
    },

    toggleCandidate({ row, col, value }) {
      validateMove({ row, col, value })
      if (value === 0) {
        return this.getCandidateMarks()
      }

      if (currentSudoku.isFixedCell(row, col)) {
        return this.getCandidateMarks()
      }

      pushHistory()
      currentSudoku.guess({ row, col, value: 0 })
      const key = createCellKey(row, col)
      const nextValues = currentCandidateMarks[key] ? [...currentCandidateMarks[key]] : []
      const existingIndex = nextValues.indexOf(value)

      if (existingIndex >= 0) {
        nextValues.splice(existingIndex, 1)
      } else {
        nextValues.push(value)
        nextValues.sort((left, right) => left - right)
      }

      if (nextValues.length === 0) {
        delete currentCandidateMarks[key]
      } else {
        currentCandidateMarks[key] = nextValues
      }

      updateExploreFailureState()
      return this.getCandidateMarks()
    },

    clearCandidates({ row, col }) {
      const key = createCellKey(row, col)
      if (!currentCandidateMarks[key]) {
        return this.getCandidateMarks()
      }

      pushHistory()
      delete currentCandidateMarks[key]
      return this.getCandidateMarks()
    },

    getCellCandidates(position) {
      return currentSudoku.getCandidates(position)
    },

    peekNextHint() {
      return getNextProgressHint()
    },

    applyHint(position = null) {
      if (currentRemainingHints <= 0) {
        return null
      }

      if (currentSudoku.hasConflict()) {
        return null
      }

      let hint = null
      if (position && Number.isInteger(position.row) && Number.isInteger(position.col)) {
        const grid = currentSudoku.getGrid()
        if (grid[position.row][position.col] !== 0 || currentSudoku.isFixedCell(position.row, position.col)) {
          return null
        }

        const solutionGrid = currentSudoku.getSolutionGrid()
        hint = {
          row: position.row,
          col: position.col,
          value: solutionGrid[position.row][position.col],
          candidates: currentSudoku.getCandidates(position),
          kind: 'solution',
        }
      } else {
        hint = getNextProgressHint()
      }

      if (!hint) {
        return null
      }

      pushHistory()
      currentSudoku.guess({ row: hint.row, col: hint.col, value: hint.value })
      clearCellCandidates(hint.row, hint.col)
      if (currentRemainingHints !== Infinity) {
        currentRemainingHints -= 1
      }
      currentUsedHints += 1
      updateExploreFailureState()
      return hint
    },

    setHintQuota(nextHintQuota) {
      currentHintQuota = Number.isFinite(nextHintQuota) ? Math.max(0, nextHintQuota) : Infinity
      if (currentHintQuota === Infinity) {
        currentRemainingHints = Infinity
        return
      }

      currentRemainingHints = Math.min(currentRemainingHints, currentHintQuota)
    },

    getRemainingHints() {
      return currentRemainingHints
    },

    getUsedHints() {
      return currentUsedHints
    },

    getHintQuota() {
      return currentHintQuota
    },

    beginExplore() {
      if (currentExplore) {
        return false
      }

      pushHistory()
      currentMode = 'explore'
      currentExplore = {
        baseSnapshot: createSnapshot(),
        failedStates: new Set(),
        failed: false,
        failureReason: '',
      }
      return true
    },

    commitExplore() {
      if (!currentExplore) {
        return false
      }

      pushHistory()
      currentMode = 'normal'
      currentExplore = null
      return true
    },

    discardExplore() {
      if (!currentExplore) {
        return false
      }

      const restoredSnapshot = currentExplore.baseSnapshot
      pushHistory()
      restoreSnapshot(restoredSnapshot)
      currentMode = 'normal'
      currentExplore = null
      return true
    },

    isExploring() {
      return currentMode === 'explore'
    },

    isExploreFailed() {
      return Boolean(currentExplore?.failed)
    },

    getExploreFailureReason() {
      return currentExplore?.failureReason || ''
    },

    getExploreOrigin() {
      if (!currentExplore) {
        return null
      }

      return JSON.parse(JSON.stringify(currentExplore.baseSnapshot.sudoku.currentGrid))
    },

    getCandidateMarks() {
      return JSON.parse(JSON.stringify(currentCandidateMarks))
    },

    canUndo() {
      return past.length > 0
    },

    canRedo() {
      return future.length > 0
    },

    undo() {
      if (!past.length) {
        return currentSudoku.getGrid()
      }

      future.push(createSnapshot())
      const snapshot = past.pop()
      restoreSnapshot(snapshot)
      return currentSudoku.getGrid()
    },

    redo() {
      if (!future.length) {
        return currentSudoku.getGrid()
      }

      past.push(createSnapshot())
      const snapshot = future.pop()
      restoreSnapshot(snapshot)
      return currentSudoku.getGrid()
    },

    toJSON() {
      return {
        sudoku: currentSudoku.toJSON(),
        hintQuota: currentHintQuota,
        remainingHints: currentRemainingHints,
        usedHints: currentUsedHints,
        candidateMarks: JSON.parse(JSON.stringify(currentCandidateMarks)),
        mode: currentMode,
        explore: getSerializableExplore(),
        history: {
          past: JSON.parse(JSON.stringify(past)),
          future: JSON.parse(JSON.stringify(future)),
        },
      }
    },
  }
}

export function createGame({ sudoku, hintQuota = Infinity } = {}) {
  return createGameInternal({ sudoku, hintQuota })
}

export function createGameFromJSON(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('game JSON payload is required')
  }

  return createGameInternal({
    sudoku: createSudokuFromJSON(json.sudoku),
    hintQuota: json.hintQuota,
    remainingHints: json.remainingHints,
    usedHints: json.usedHints,
    candidateMarks: json.candidateMarks,
    mode: json.mode,
    explore: json.explore,
    history: json.history,
  })
}
