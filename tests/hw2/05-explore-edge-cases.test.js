import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from '../hw1/helpers/domain-api.js'

describe('HW2 explore mode edge cases', () => {
    it('cannot enter explore mode while already exploring', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(makePuzzle()) })

        expect(game.beginExplore()).toBe(true)
        expect(game.beginExplore()).toBe(false) // already in explore
        expect(game.isExploring()).toBe(true)
    })

    it('commit and discard return false when not exploring', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(makePuzzle()) })

        expect(game.commitExplore()).toBe(false)
        expect(game.discardExplore()).toBe(false)
    })

    it('hints work correctly during explore mode', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(makePuzzle()), hintQuota: 5 })

        game.beginExplore()
        const hint = game.applyHint()

        expect(hint).not.toBeNull()
        expect(game.getSudoku().getGrid()[hint.row][hint.col]).toBe(hint.value)
        expect(game.getRemainingHints()).toBe(4)
        expect(game.isExploring()).toBe(true)
    })

    it('undo across explore boundary preserves state correctly', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(makePuzzle()) })

        game.guess({ row: 0, col: 2, value: 4 })
        expect(game.getSudoku().getGrid()[0][2]).toBe(4)

        game.beginExplore()
        game.guess({ row: 1, col: 1, value: 7 })

        // Undo the explore guess
        game.undo()
        expect(game.getSudoku().getGrid()[1][1]).toBe(0)

        // Undo entering explore
        game.undo()
        expect(game.isExploring()).toBe(false)
        expect(game.getSudoku().getGrid()[0][2]).toBe(4)
    })

    it('explore detects solution mismatch as failure', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(makePuzzle()) })

        game.beginExplore()
        // Fill with a wrong value (5 instead of correct 4 at row 0, col 2)
        game.guess({ row: 0, col: 2, value: 9 })

        expect(game.isExploreFailed()).toBe(true)
        expect(game.getExploreFailureReason()).toBeTruthy()
    })

    it('multiple explore sessions accumulate separate failure tracking', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(makePuzzle()) })

        // First explore session
        game.beginExplore()
        game.guess({ row: 0, col: 2, value: 5 })
        expect(game.isExploreFailed()).toBe(true)
        game.discardExplore()

        // Second explore session starts fresh failure tracking
        game.beginExplore()
        expect(game.isExploreFailed()).toBe(false)
        expect(game.isExploring()).toBe(true)

        // A correct guess should not trigger failure
        game.guess({ row: 0, col: 2, value: 4 })
        expect(game.isExploreFailed()).toBe(false)
        game.commitExplore()
    })
})
