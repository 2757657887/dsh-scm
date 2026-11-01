export interface GraphCommit { hash: string; parents: readonly string[] }
export interface GraphRow { lane: number; edges: {from: number; to: number}[]; width: number }
/** Carry parent lanes through topo-ordered rows, including merges and branches. */
export function graphRows(commits: readonly GraphCommit[]): GraphRow[] {
  let lanes: string[] = []
  return commits.map(c => {
    let lane = lanes.indexOf(c.hash)
    if (lane < 0) { lane = lanes.length; lanes.push(c.hash) }
    const before = [...lanes]
    lanes.splice(lane, 1)
    c.parents.forEach((parent, i) => { if (!lanes.includes(parent)) lanes.splice(Math.min(lane + i, lanes.length), 0, parent) })
    const edges: {from: number; to: number}[] = []
    before.forEach((hash, from) => { if (from !== lane && lanes.includes(hash)) edges.push({ from, to: lanes.indexOf(hash) }) })
    c.parents.forEach(parent => edges.push({ from: lane, to: lanes.indexOf(parent) }))
    return { lane, edges, width: Math.max(before.length, lanes.length, 1) }
  })
}
