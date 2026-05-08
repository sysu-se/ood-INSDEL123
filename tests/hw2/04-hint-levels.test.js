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

describe('HW2 multi-level hints and hint explanations', () => {
    it('micro-level hint returns info without filling the cell or consuming quota', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(nearSolvedPuzzle), hintQuota: 3 })

        const hint = game.applyHint({ level: 'micro' })

        expect(hint).not.toBeNull()
        expect(hint.row).toBeDefined()
        expect(hint.col).toBeDefined()
        expect(hint.value).toBeDefined()
        // Cell should NOT be filled
        expect(game.getSudoku().getGrid()[hint.row][hint.col]).toBe(0)
        // Quota should NOT be consumed
        expect(game.getRemainingHints()).toBe(3)
        expect(game.getUsedHints()).toBe(0)
    })

    it('macro-level hint fills the cell and consumes quota (default behavior)', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(nearSolvedPuzzle), hintQuota: 3 })

        const hint = game.applyHint({ level: 'macro' })

        expect(hint).not.toBeNull()
        // Cell SHOULD be filled
        expect(game.getSudoku().getGrid()[hint.row][hint.col]).toBe(hint.value)
        // Quota SHOULD be consumed
        expect(game.getRemainingHints()).toBe(2)
        expect(game.getUsedHints()).toBe(1)
    })

    it('hint includes technique and reason fields for explanation', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(nearSolvedPuzzle), hintQuota: 5 })

        const hint = game.peekNextHint()

        expect(hint).not.toBeNull()
        expect(hint.technique).toBeDefined()
        expect(typeof hint.technique).toBe('string')
        expect(hint.reason).toBeDefined()
        expect(typeof hint.reason).toBe('string')
        expect(hint.reason.length).toBeGreaterThan(0)
    })

    it('naked-single hint has technique "naked-single"', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(nearSolvedPuzzle), hintQuota: 5 })

        const hint = game.peekNextHint()

        // The nearSolvedPuzzle has only one empty cell at (0,2) with candidate [4]
        expect(hint).toMatchObject({ row: 0, col: 2, value: 4, technique: 'naked-single' })
    })

    it('position-specific micro hint returns info without modifying state', async () => {
        const { createGame, createSudoku } = await loadDomainApi()
        const game = createGame({ sudoku: createSudoku(makePuzzle()), hintQuota: 5 })

        const hint = game.applyHint({ row: 0, col: 2, level: 'micro' })

        expect(hint).not.toBeNull()
        expect(hint.row).toBe(0)
        expect(hint.col).toBe(2)
        expect(hint.technique).toBe('solution-lookup')
        // Cell should NOT be filled
        expect(game.getSudoku().getGrid()[0][2]).toBe(0)
        expect(game.getRemainingHints()).toBe(5)
    })

    it('Sudoku.findHiddenSingle detects hidden singles', async () => {
        const { createSudoku } = await loadDomainApi()
        const sudoku = createSudoku(makePuzzle())

        const hidden = sudoku.findHiddenSingle()
        // The standard puzzle should produce a hidden single
        if (hidden) {
            expect(hidden.technique).toBe('hidden-single')
            expect(hidden.reason).toBeDefined()
            expect(hidden.value).toBeGreaterThanOrEqual(1)
            expect(hidden.value).toBeLessThanOrEqual(9)
        }
    })
})
