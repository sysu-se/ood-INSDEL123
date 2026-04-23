# EVOLUTION

## 1. 你如何实现提示功能？

我把提示拆成了两层职责。

- `Sudoku` 负责纯领域计算：
  - `getCandidates({ row, col })` 计算某个空格当前合法候选集合
  - `findNextHint()` 查找当前局面下可直接推出的下一步（当前最小实现采用“唯一候选”）
  - `getConflicts()` / `hasConflict()` 判断当前棋盘是否合法
- `Game` 负责交互语义：
  - 管理 hint 配额、已使用次数
  - 暴露 `peekNextHint()` / `applyHint()` 给 UI 调用
  - 把 hint 使用纳入统一 history，让 undo/redo 能回滚 hint 消耗和棋盘变化

实现上，`applyHint()` 不再对“当前可变盘面”重新调用求解器，而是在创建 `Sudoku` 时就基于原题缓存一个合法解。这样：

- 若当前局面无冲突，则优先返回 `findNextHint()` 的唯一候选提示
- 若没有唯一候选，但仍需要直接给出答案式提示，则从缓存解中取值
- 若当前局面已冲突，则 hint 返回 `null`，避免不稳定行为

## 2. 你认为提示功能更属于 Sudoku 还是 Game？为什么？

我认为提示功能横跨两者，但重心不同：

- `Sudoku` 应负责“能提示什么”
  - 候选数计算
  - 冲突检测
  - 下一步可推导位置
- `Game` 应负责“何时提示、如何提示、提示会消耗什么”
  - hint 次数限制
  - 应用提示后的状态变化
  - hint 是否进入 undo/redo
  - UI 要展示的剩余提示数

原因是：候选数和合法性判断本质上是棋局规则，属于 `Sudoku`；但 hint 次数、交互命令和历史回滚是会话行为，属于 `Game`。如果全部塞进 `Sudoku`，会把会话逻辑污染到领域对象里；如果全部塞进 `Game`，又会让规则计算离开棋盘本身。

## 3. 你如何实现探索模式？

我把 Explore 设计成 `Game` 的一种会话状态，而不是 UI 层的临时变量。

`Game` 新增了这些能力：

- `beginExplore()`
- `commitExplore()`
- `discardExplore()`
- `isExploring()`
- `isExploreFailed()`
- `getExploreFailureReason()`

进入 explore 时，`Game` 会记录一个 `baseSnapshot` 作为探索起点；探索中的所有输入仍然走统一的 `game.guess()`。每次落子后：

1. 检查是否出现直接冲突
2. 检查当前盘面是否与缓存解矛盾
3. 若失败，则把这个失败局面序列化后写入 `failedStates`

这样就满足了题目要求：

- 冲突：可以立即判定探索失败
- 回溯：`discardExplore()` 直接恢复到探索起点
- 记忆：再次走到已知失败盘面时会再次标记失败

本次实现没有做多层嵌套 explore，也没有引入 DAG 合并，因为题目明确不要求这部分。

## 4. 主局面与探索局面的关系是什么？

主局面与探索局面不是共享同一个可变 `Sudoku` 实例，而是通过快照复制来建立关系。

具体做法：

- 进入 explore 时，保存一份 `baseSnapshot`
- 探索过程只修改当前 `Game` 持有的工作局面
- 放弃 explore 时恢复 `baseSnapshot`
- 提交 explore 时直接保留当前工作局面并清空 explore 元数据

这样做的好处是：

- 不会有共享引用污染
- 不需要手动合并差异
- 放弃/提交逻辑都很直接
- 更适合当前作业规模

## 5. 你的 history 结构在本次作业中是否发生了变化？

发生了明显变化。

Homework 1.1 的一个主要问题是 history 很容易退化成“只保存 grid 的快照”，这样 undo/redo 只能回滚数字，无法回滚 hint、候选标记、explore 状态等完整游戏语义。

这次我改成了统一的 `GameSnapshot` 历史。每个快照至少包含：

- `sudoku` 当前状态
- hint 配额 / 剩余次数 / 已使用次数
- candidate marks
- 当前模式（normal / explore）
- explore 元数据（起点、失败缓存、失败原因）

所以现在 undo/redo 回滚的是“完整游戏状态”，而不是单纯数字变化。

## 6. Homework 1 中的哪些设计，在 Homework 2 中暴露出了局限？

主要有四点。

### (1) history 与内部表示耦合过深
如果 Game 只保存 `number[][]`，一旦状态里增加 hint、候选数、探索模式，就会出现回滚不完整的问题。

### (2) 交互状态散落在独立 store 中
上一版最明显的问题是数字、hint、候选标记分别由不同 store 管理。用户看到的是同一局游戏，但 undo/redo 却只能回滚其中一部分状态，业务上不一致。

### (3) 领域边界不清
如果组件直接修改二维数组，或者通过外露实例绕开 adapter 调领域对象，领域层就无法真正成为聚合根。

### (4) hint 过度依赖外部求解器对当前盘面的即时求解
这会导致错误盘面上的 hint 行为不稳定。题目一旦加入 Explore，这个缺点就会被放大，因为探索天然会制造大量“暂时错误”的局面。

## 7. 如果重做一次 Homework 1，你会如何修改原设计？

如果重做 Homework 1，我会从一开始就做下面几件事：

1. 明确 `Sudoku` 是棋盘规则对象，`Game` 是聚合根
2. 所有用户命令都先经过 `Game`
3. Svelte store 只做 adapter / 外表化，不再直接保存业务真相
4. history 从第一版开始就保存完整游戏快照，而不是只保存 grid
5. hint、候选数、notes 这些“看起来像 UI 状态”的内容，只要会影响业务一致性，就纳入 `Game`

这样 Homework 2 的 Hint / Explore 就会是自然演进，而不是对已有结构进行补丁式修补。
