import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from '../hw1/helpers/domain-api.js'

describe('HW2 game-state history and serialization', () => {
  it('undo and redo restore candidate marks and hint counters', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()), hintQuota: 2 })

    game.toggleCandidate({ row: 0, col: 2, value: 1 })
    game.applyHint({ row: 0, col: 2 })

    expect(game.getCandidateMarks()['0,2']).toBeUndefined()
    expect(game.getUsedHints()).toBe(1)
    expect(game.getRemainingHints()).toBe(1)

    game.undo()
    expect(game.getCandidateMarks()['0,2']).toEqual([1])
    expect(game.getUsedHints()).toBe(0)
    expect(game.getRemainingHints()).toBe(2)

    game.redo()
    expect(game.getCandidateMarks()['0,2']).toBeUndefined()
    expect(game.getUsedHints()).toBe(1)
    expect(game.getRemainingHints()).toBe(1)
  })

  it('round-trips game state with explore metadata through JSON', async () => {
    const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()), hintQuota: 4 })

    game.beginExplore()
    game.toggleCandidate({ row: 0, col: 2, value: 1 })
    game.guess({ row: 0, col: 2, value: 5 })

    const restored = createGameFromJSON(JSON.parse(JSON.stringify(game.toJSON())))

    expect(restored.isExploring()).toBe(true)
    expect(restored.isExploreFailed()).toBe(true)
    expect(restored.getUsedHints()).toBe(0)
    expect(restored.getCandidateMarks()['0,2']).toBeUndefined()
    expect(restored.getSudoku().getGrid()[0][2]).toBe(5)
  })
})
