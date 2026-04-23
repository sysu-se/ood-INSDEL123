import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from '../hw1/helpers/domain-api.js'

describe('HW2 explore mode', () => {
  it('can enter explore mode and discard back to the origin snapshot', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    expect(game.beginExplore()).toBe(true)
    expect(game.isExploring()).toBe(true)

    game.guess({ row: 0, col: 2, value: 4 })
    expect(game.getSudoku().getGrid()[0][2]).toBe(4)

    expect(game.discardExplore()).toBe(true)
    expect(game.isExploring()).toBe(false)
    expect(game.getSudoku().getGrid()[0][2]).toBe(0)
  })

  it('can commit explore progress back into the main session', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.beginExplore()
    game.guess({ row: 0, col: 2, value: 4 })

    expect(game.commitExplore()).toBe(true)
    expect(game.isExploring()).toBe(false)
    expect(game.getSudoku().getGrid()[0][2]).toBe(4)
  })

  it('marks conflicting explore paths as failed and remembers them', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.beginExplore()
    game.guess({ row: 0, col: 2, value: 5 })

    expect(game.isExploreFailed()).toBe(true)
    expect(game.getExploreFailureReason()).toContain('conflict')

    game.discardExplore()
    game.undo()

    expect(game.isExploring()).toBe(true)
    expect(game.isExploreFailed()).toBe(true)
  })
})
