import solve from '@mattflow/sudoku-solver'

// ─── Constants ───────────────────────────────────────────────────────────────
const SUDOKU_SIZE = 9
const EMPTY_GRID = Array.from({ length: SUDOKU_SIZE }, () => Array(SUDOKU_SIZE).fill(0))

// ─── Solver Wrapper ──────────────────────────────────────────────────────────
// Uses the external solver library to compute the unique solution for a puzzle.
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

// ─── Grid Utilities ──────────────────────────────────────────────────────────

/** Deep-copy a 9×9 grid to avoid shared-reference pollution. */
function cloneGrid(grid) {
  return grid.map((row) => [...row])
}

function createEmptyGrid() {
  return cloneGrid(EMPTY_GRID)
}

/**
 * Validate that `grid` is a well-formed 9×9 integer matrix with values 0–9.
 * Throws on any structural or value violation.
 */
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

/** Validate a move object { row, col, value }. */
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

/** Create a unique string key for a cell position, used in Maps and Sets. */
function createCellKey(row, col) {
  return `${row},${col}`
}

/** Normalize candidate marks: deduplicate, sort, and filter invalid values. */
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

/** Serialize a 9×9 grid into an 81-character string for hashing / comparison. */
function serializeGrid(grid) {
  return grid.flat().join('')
}

// ─── Sudoku (Domain Object) ─────────────────────────────────────────────────
// Encapsulates the puzzle rules: conflict detection, candidate computation,
// hint inference (naked-single and hidden-single), and solution access.
// This is a pure domain object — no session or UI logic here.

function createSudokuInternal({ puzzleGrid, currentGrid, solutionGrid }) {
  validateGrid(puzzleGrid, 'puzzleGrid')
  validateGrid(currentGrid, 'currentGrid')

  const puzzle = cloneGrid(puzzleGrid)
  const current = cloneGrid(currentGrid)
  const solution = solutionGrid ? cloneGrid(solutionGrid) : solvePuzzle(puzzle)

  validateGrid(solution, 'solutionGrid')

  // Ensure the current grid hasn't altered any fixed (given) cells.
  for (let row = 0; row < SUDOKU_SIZE; row += 1) {
    for (let col = 0; col < SUDOKU_SIZE; col += 1) {
      if (puzzle[row][col] !== 0 && current[row][col] !== puzzle[row][col]) {
        throw new Error('currentGrid cannot change fixed puzzle cells')
      }
    }
  }

  /** Check whether a cell is pre-filled by the original puzzle. */
  function isFixedCell(row, col) {
    return puzzle[row][col] !== 0
  }

  /**
   * Scan the board for all conflicting cells (row / column / box duplicates).
   * Returns an array of { row, col } objects sorted in reading order.
   */
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

        // Check row and column peers
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

        // Check 3×3 box peers
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

  /**
   * Compute the set of legal candidate values for a given empty cell,
   * by eliminating values already present in the same row, column, and box.
   * Returns [] if the cell is already filled.
   */
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

      // Eliminate values present in the same row or column
      for (let index = 0; index < SUDOKU_SIZE; index += 1) {
        if (current[row][index] === value || current[index][col] === value) {
          valid = false
          break
        }
      }

      if (!valid) {
        continue
      }

      // Eliminate values present in the same 3×3 box
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

  /**
   * Hidden-single detection: find a digit that has only one valid placement
   * within a row, column, or 3×3 box. This is a more advanced inference
   * technique than naked-single (which only checks one cell's candidates).
   *
   * Returns { row, col, value, candidates, technique, reason } or null.
   */
  function findHiddenSingle() {
    // Check each row for hidden singles
    for (let row = 0; row < SUDOKU_SIZE; row += 1) {
      for (let digit = 1; digit <= 9; digit += 1) {
        // Skip if digit already placed in this row
        if (current[row].includes(digit)) continue

        const positions = []
        for (let col = 0; col < SUDOKU_SIZE; col += 1) {
          if (current[row][col] === 0) {
            const cellCandidates = getCandidates({ row, col })
            if (cellCandidates.includes(digit)) {
              positions.push(col)
            }
          }
        }

        if (positions.length === 1) {
          const col = positions[0]
          return {
            row,
            col,
            value: digit,
            candidates: getCandidates({ row, col }),
            technique: 'hidden-single',
            reason: `Digit ${digit} can only go in column ${col} within row ${row}`,
          }
        }
      }
    }

    // Check each column for hidden singles
    for (let col = 0; col < SUDOKU_SIZE; col += 1) {
      for (let digit = 1; digit <= 9; digit += 1) {
        let alreadyPlaced = false
        for (let r = 0; r < SUDOKU_SIZE; r += 1) {
          if (current[r][col] === digit) { alreadyPlaced = true; break }
        }
        if (alreadyPlaced) continue

        const positions = []
        for (let row = 0; row < SUDOKU_SIZE; row += 1) {
          if (current[row][col] === 0) {
            const cellCandidates = getCandidates({ row, col })
            if (cellCandidates.includes(digit)) {
              positions.push(row)
            }
          }
        }

        if (positions.length === 1) {
          const row = positions[0]
          return {
            row,
            col,
            value: digit,
            candidates: getCandidates({ row, col }),
            technique: 'hidden-single',
            reason: `Digit ${digit} can only go in row ${row} within column ${col}`,
          }
        }
      }
    }

    // Check each 3×3 box for hidden singles
    for (let boxRow = 0; boxRow < SUDOKU_SIZE; boxRow += 3) {
      for (let boxCol = 0; boxCol < SUDOKU_SIZE; boxCol += 3) {
        for (let digit = 1; digit <= 9; digit += 1) {
          let alreadyPlaced = false
          for (let r = boxRow; r < boxRow + 3 && !alreadyPlaced; r += 1) {
            for (let c = boxCol; c < boxCol + 3; c += 1) {
              if (current[r][c] === digit) { alreadyPlaced = true; break }
            }
          }
          if (alreadyPlaced) continue

          const positions = []
          for (let r = boxRow; r < boxRow + 3; r += 1) {
            for (let c = boxCol; c < boxCol + 3; c += 1) {
              if (current[r][c] === 0) {
                const cellCandidates = getCandidates({ r, col: c })
                // Use manual call since we need {row, col} format
                const cands = getCandidates({ row: r, col: c })
                if (cands.includes(digit)) {
                  positions.push({ row: r, col: c })
                }
              }
            }
          }

          if (positions.length === 1) {
            const { row, col } = positions[0]
            return {
              row,
              col,
              value: digit,
              candidates: getCandidates({ row, col }),
              technique: 'hidden-single',
              reason: `Digit ${digit} can only go at (${row},${col}) within box (${boxRow / 3},${boxCol / 3})`,
            }
          }
        }
      }
    }

    return null
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

    /**
     * Apply a user's guess to the board. Throws if the cell is fixed.
     * Returns the updated grid snapshot.
     */
    guess(move) {
      validateMove(move)

      if (isFixedCell(move.row, move.col)) {
        throw new Error('cannot change a fixed puzzle cell')
      }

      current[move.row][move.col] = move.value
      return this.getGrid()
    },

    getCandidates,

    /**
     * Find the next naked-single hint: a cell with exactly one candidate.
     * Enhanced with technique and reason fields for hint explanation.
     * Returns { row, col, value, candidates, technique, reason } or null.
     */
    findNextHint() {
      for (let row = 0; row < SUDOKU_SIZE; row += 1) {
        for (let col = 0; col < SUDOKU_SIZE; col += 1) {
          if (current[row][col] !== 0) {
            continue
          }

          const candidates = getCandidates({ row, col })
          if (candidates.length === 1) {
            return {
              row,
              col,
              value: candidates[0],
              candidates,
              technique: 'naked-single',
              reason: `Cell (${row},${col}) has only one candidate: ${candidates[0]}`,
            }
          }
        }
      }

      return null
    },

    /**
     * Find a hidden-single hint: a digit that has only one valid position
     * within any row, column, or box. This goes beyond naked-single analysis.
     */
    findHiddenSingle,

    getConflicts,

    hasConflict() {
      return getConflicts().length > 0
    },

    /** Check whether every cell is filled and no conflicts exist. */
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

    /** Create an independent deep copy of this Sudoku instance. */
    clone() {
      return createSudokuInternal({
        puzzleGrid: puzzle,
        currentGrid: current,
        solutionGrid: solution,
      })
    },

    /** Serialize to a plain JSON-safe object for persistence. */
    toJSON() {
      return {
        puzzleGrid: cloneGrid(puzzle),
        currentGrid: cloneGrid(current),
        solutionGrid: cloneGrid(solution),
      }
    },

    /** Pretty-print the current grid with dots for empty cells. */
    toString() {
      return current
        .map((row) => row.map((value) => (value === 0 ? '.' : String(value))).join(' '))
        .join('\n')
    },
  }
}

/** Public factory: create a new Sudoku from a puzzle grid (auto-solves). */
export function createSudoku(puzzleGrid) {
  return createSudokuInternal({
    puzzleGrid,
    currentGrid: puzzleGrid,
  })
}

/** Restore a Sudoku instance from a previously serialized JSON payload. */
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

// ─── Game (Session / Aggregate Root) ─────────────────────────────────────────
// Manages session-level concerns: hint quota, explore mode, candidate marks,
// history (undo/redo), and serialization. Delegates domain rules to Sudoku.

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
  // Deep-copy past and future stacks to prevent external reference leaks.
  let past = (history.past || []).map((snapshot) => JSON.parse(JSON.stringify(snapshot)))
  let future = (history.future || []).map((snapshot) => JSON.parse(JSON.stringify(snapshot)))

  /** Convert explore state to a plain, serializable object. */
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

  /** Capture the entire game state as an immutable snapshot (for history). */
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

  /** Restore the full game state from a previously captured snapshot. */
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

  /** Push current state to the undo stack and clear redo stack. */
  function pushHistory() {
    past.push(createSnapshot())
    future = []
  }

  /** Remove candidate marks for a cell (called after filling a value). */
  function clearCellCandidates(row, col) {
    const key = createCellKey(row, col)
    if (currentCandidateMarks[key]) {
      delete currentCandidateMarks[key]
    }
  }

  /**
   * After every move in explore mode, re-evaluate failure status:
   *  1. Check if the current state matches a previously failed state (memory).
   *  2. Check for direct row/col/box conflicts.
   *  3. Check if any filled cell disagrees with the cached solution.
   */
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

  /**
   * Determine the best available hint using a priority cascade:
   *  1. Naked-single (a cell with exactly one candidate)
   *  2. Hidden-single (a digit with only one valid position in a unit)
   *  3. Solution-lookup (fall back to the cached solution)
   *
   * Returns a hint object with { row, col, value, candidates, kind, technique, reason }
   * or null if the board is in conflict.
   */
  function getNextProgressHint() {
    if (currentSudoku.hasConflict()) {
      return null
    }

    // Priority 1: naked-single (most instructive — only one candidate)
    const nakedHint = currentSudoku.findNextHint()
    if (nakedHint) {
      return {
        ...nakedHint,
        kind: 'single-candidate',
        // technique and reason already set by findNextHint()
      }
    }

    // Priority 2: hidden-single (digit has only one valid slot in a unit)
    const hiddenHint = currentSudoku.findHiddenSingle()
    if (hiddenHint) {
      return {
        ...hiddenHint,
        kind: 'single-candidate',
        // technique and reason already set by findHiddenSingle()
      }
    }

    // Priority 3: solution-lookup (last resort — directly reveal the answer)
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
            technique: 'solution-lookup',
            reason: `No logical deduction available; answer revealed from the known solution`,
          }
        }
      }
    }

    return null
  }

  return {
    /** Return a defensive clone of the underlying Sudoku instance. */
    getSudoku() {
      return currentSudoku.clone()
    },

    /** Apply a user guess, record history, and update explore failure state. */
    guess(move) {
      validateMove(move)
      pushHistory()
      currentSudoku.guess(move)
      clearCellCandidates(move.row, move.col)
      updateExploreFailureState()
      return currentSudoku.getGrid()
    },

    /** Toggle a candidate mark for a cell (pencil-mark mode). */
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

    /** Remove all candidate marks for a specific cell. */
    clearCandidates({ row, col }) {
      const key = createCellKey(row, col)
      if (!currentCandidateMarks[key]) {
        return this.getCandidateMarks()
      }

      pushHistory()
      delete currentCandidateMarks[key]
      return this.getCandidateMarks()
    },

    /** Delegate to Sudoku.getCandidates for a specific cell. */
    getCellCandidates(position) {
      return currentSudoku.getCandidates(position)
    },

    /** Preview the next available hint without consuming quota. */
    peekNextHint() {
      return getNextProgressHint()
    },

    /**
     * Apply a hint to the board with optional level control.
     *
     * Options:
     *   position  — { row, col } to request a hint for a specific cell
     *   level     — 'micro' returns hint info only (no fill, no quota consumed)
     *               'macro' fills the cell and consumes one hint (default)
     *
     * Examples:
     *   game.applyHint()                           → auto-pick + fill
     *   game.applyHint({ level: 'micro' })         → auto-pick, info only
     *   game.applyHint({ row: 0, col: 2 })         → specific cell + fill
     *   game.applyHint({ row: 0, col: 2, level: 'micro' }) → specific cell, info only
     */
    applyHint(options = null) {
      // Determine hint level (defaults to 'macro' for backward compatibility)
      const level = (options && options.level) || 'macro'

      if (currentRemainingHints <= 0) {
        return null
      }

      if (currentSudoku.hasConflict()) {
        return null
      }

      let hint = null
      if (options && Number.isInteger(options.row) && Number.isInteger(options.col)) {
        // Position-specific hint request
        const grid = currentSudoku.getGrid()
        if (grid[options.row][options.col] !== 0 || currentSudoku.isFixedCell(options.row, options.col)) {
          return null
        }

        const solutionGrid = currentSudoku.getSolutionGrid()
        hint = {
          row: options.row,
          col: options.col,
          value: solutionGrid[options.row][options.col],
          candidates: currentSudoku.getCandidates(options),
          kind: 'solution',
          technique: 'solution-lookup',
          reason: `Answer for cell (${options.row},${options.col}) revealed from the known solution`,
        }
      } else {
        // Auto-pick the best available hint
        hint = getNextProgressHint()
      }

      if (!hint) {
        return null
      }

      // Micro level: return hint information only, do NOT modify the board
      if (level === 'micro') {
        return hint
      }

      // Macro level (default): fill the cell and consume one hint
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

    /** Set the maximum hint quota for this game session. */
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

    // ─── Explore Mode ──────────────────────────────────────────────────
    // Explore mode lets the player try speculative moves. On entry a
    // base snapshot is saved; on discard the game reverts to that snapshot;
    // on commit the speculative moves become permanent.

    /** Enter explore mode. Returns false if already exploring. */
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

    /** Commit explore results into the main session. */
    commitExplore() {
      if (!currentExplore) {
        return false
      }

      pushHistory()
      currentMode = 'normal'
      currentExplore = null
      return true
    },

    /** Discard explore and revert to the base snapshot. */
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

    /** Get the grid state from the point when explore started. */
    getExploreOrigin() {
      if (!currentExplore) {
        return null
      }

      return JSON.parse(JSON.stringify(currentExplore.baseSnapshot.sudoku.currentGrid))
    },

    /** Return a deep copy of all candidate marks. */
    getCandidateMarks() {
      return JSON.parse(JSON.stringify(currentCandidateMarks))
    },

    // ─── History (Undo / Redo) ─────────────────────────────────────────
    // History stores full GameSnapshot objects, so undo/redo restores
    // the complete game state including hints, candidates, and explore.

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

    /** Serialize the entire game (including history) for persistence. */
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

/** Public factory: create a new Game session wrapping a Sudoku instance. */
export function createGame({ sudoku, hintQuota = Infinity } = {}) {
  return createGameInternal({ sudoku, hintQuota })
}

/** Restore a Game session from a previously serialized JSON payload. */
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
