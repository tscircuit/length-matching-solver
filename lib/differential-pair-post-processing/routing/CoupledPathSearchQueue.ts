import type { CoupledPathSearchState } from "./types"

export class CoupledPathSearchQueue {
  private readonly heap: CoupledPathSearchState[] = []

  get length(): number {
    return this.heap.length
  }

  push(state: CoupledPathSearchState): void {
    this.heap.push(state)
    let stateIndex = this.heap.length - 1
    while (stateIndex > 0) {
      const parentIndex = Math.floor((stateIndex - 1) / 2)
      const parent = this.heap[parentIndex]!
      if (
        parent.score < state.score ||
        (parent.score === state.score &&
          `${parent.layer}:${parent.gridY}:${parent.gridX}` <=
            `${state.layer}:${state.gridY}:${state.gridX}`)
      ) {
        break
      }
      this.heap[stateIndex] = parent
      stateIndex = parentIndex
    }
    this.heap[stateIndex] = state
  }

  pop(): CoupledPathSearchState | undefined {
    const first = this.heap[0]
    const last = this.heap.pop()
    if (!first || !last || this.heap.length === 0) return first
    let stateIndex = 0
    while (true) {
      const leftIndex = stateIndex * 2 + 1
      const rightIndex = leftIndex + 1
      if (leftIndex >= this.heap.length) break
      let childIndex = leftIndex
      if (
        rightIndex < this.heap.length &&
        this.heap[rightIndex]!.score < this.heap[leftIndex]!.score
      ) {
        childIndex = rightIndex
      }
      if (this.heap[childIndex]!.score >= last.score) break
      this.heap[stateIndex] = this.heap[childIndex]!
      stateIndex = childIndex
    }
    this.heap[stateIndex] = last
    return first
  }
}
