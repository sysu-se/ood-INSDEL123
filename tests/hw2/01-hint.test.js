import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from '../hw1/helpers/domain-api.js'

const nearSolvedPuzzle = [
  [5, 3, 0, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
]

describe('HW2 hint behavior', () => {
  it('returns legal candidates for an empty cell', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    expect(sudoku.getCandidates({ row: 0, col: 2 })).toEqual([1, 2, 4])
  })

  it('finds the next single-candidate hint and applies it through Game', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(nearSolvedPuzzle), hintQuota: 3 })

    const hint = game.peekNextHint()
    expect(hint).toMatchObject({ row: 0, col: 2, value: 4, kind: 'single-candidate' })

    const applied = game.applyHint()
    expect(applied).toMatchObject({ row: 0, col: 2, value: 4 })
    expect(game.getSudoku().getGrid()[0][2]).toBe(4)
    expect(game.getRemainingHints()).toBe(2)
    expect(game.getUsedHints()).toBe(1)
  })

  it('does not emit hints for a conflicting board', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()), hintQuota: 2 })

    game.guess({ row: 0, col: 2, value: 5 })

    expect(game.peekNextHint()).toBeNull()
    expect(game.applyHint()).toBeNull()
    expect(game.getRemainingHints()).toBe(2)
  })
})
