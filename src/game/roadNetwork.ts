// The town's road network as a real graph — shared by WorldMap.tsx (which
// draws it) and ai.ts (which now routes bird movement through it instead of
// a straight line). Real-device feedback: roads used to be "just for show"
// — the network below is the single source of truth both sides read, so a
// bird visibly walking to a shop and the road drawn to that same shop are
// guaranteed to agree.
//
// Pure, dependency-free math only — same "promote it once, reuse it
// everywhere" precedent as game/isoMath.ts.

// One town-hall-or-building node in the network — grid-space (0..1
// normalized, same space as everything else in this game) x/y, plus a
// stable id (a building's own TownBuildingInstance.id, or 'townhall').
export interface RoadNode {
  id: string;
  x: number;
  y: number;
}

export interface RoadEdge {
  from: RoadNode;
  to: RoadNode;
}

// Prim's-algorithm minimum spanning tree rooted at nodes[0] (by convention,
// always the town hall — see both call sites below): starting from just
// the root, repeatedly connects whichever not-yet-connected node is
// *closest to any already-connected node* (not necessarily the root
// itself), so a building usually ends up connected to its nearest
// neighboring building rather than every building converging on one
// central point. Distance is plain Euclidean in grid space. O(n²), fine at
// this game's building-count scale (capped at 48 — see
// TOWN_BUILDING_CAP_BY_LEVEL).
export function buildRoadEdges(nodes: RoadNode[]): RoadEdge[] {
  if (nodes.length < 2) return [];
  const connected = [nodes[0]];
  const remaining = nodes.slice(1);
  const edges: RoadEdge[] = [];
  while (remaining.length > 0) {
    let bestConnectedIndex = -1;
    let bestRemainingIndex = -1;
    let bestDist = Infinity;
    for (let i = 0; i < connected.length; i++) {
      for (let j = 0; j < remaining.length; j++) {
        const d = Math.hypot(connected[i].x - remaining[j].x, connected[i].y - remaining[j].y);
        if (d < bestDist) {
          bestDist = d;
          bestConnectedIndex = i;
          bestRemainingIndex = j;
        }
      }
    }
    const newNode = remaining[bestRemainingIndex];
    edges.push({ from: connected[bestConnectedIndex], to: newNode });
    connected.push(newNode);
    remaining.splice(bestRemainingIndex, 1);
  }
  return edges;
}

// The road network's own node nearest an arbitrary point — used to find
// where a bird currently standing off the network (or heading to a spot
// off it, like a house or a random stroll point) should "get on"/"get off"
// the road system.
export function nearestRoadNode(nodes: RoadNode[], x: number, y: number): RoadNode | null {
  let best: RoadNode | null = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

// BFS shortest path (by number of edges) between two nodes already on the
// network. Since buildRoadEdges always produces a spanning *tree* (no
// cycles — exactly n-1 edges for n nodes), there is only ever one possible
// path between any two nodes regardless of search strategy, so plain BFS
// already finds the unique/shortest route without needing Dijkstra/A*'s
// edge-weighting — but written as a generic graph search (not "just walk
// the tree structure directly") so it keeps working unmodified if a future
// change ever adds extra edges (shortcuts, loops) on top of the MST.
export function findRoadPath(nodes: RoadNode[], edges: RoadEdge[], fromId: string, toId: string): RoadNode[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  if (fromId === toId) {
    const n = nodeById.get(fromId);
    return n ? [n] : [];
  }
  const adjacency = new Map<string, RoadNode[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    adjacency.get(e.from.id)?.push(e.to);
    adjacency.get(e.to.id)?.push(e.from);
  }

  const cameFrom = new Map<string, string>();
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];
  let qi = 0;
  while (qi < queue.length) {
    const current = queue[qi++];
    if (current === toId) break;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        cameFrom.set(neighbor.id, current);
        queue.push(neighbor.id);
      }
    }
  }
  if (!visited.has(toId)) return []; // disconnected — shouldn't happen for a spanning tree, but stay safe

  const pathIds: string[] = [toId];
  let cur = toId;
  while (cur !== fromId) {
    const prev = cameFrom.get(cur);
    if (!prev) return []; // safety net, shouldn't be reachable
    pathIds.push(prev);
    cur = prev;
  }
  pathIds.reverse();
  const path = pathIds.map((id) => nodeById.get(id)).filter((n): n is RoadNode => n != null);
  return path;
}

// The actual list of waypoints a bird should walk through to get from an
// arbitrary point to another arbitrary point, routed via the road network
// as far as it can carry them: walk on at the nearest node to `from`,
// follow the tree path to the node nearest `to`, then walk the "last mile"
// off-road to the real destination (which is often not a network node at
// all — a house, a random stroll point, BASIC_TRADE_SPOT, ...). If the
// network is empty (no buildings yet — only ever possible before the
// town hall itself would even be passed in, i.e. never in practice since
// callers always include it) this just falls back to a direct trip.
export function planRoadRoute(
  nodes: RoadNode[],
  edges: RoadEdge[],
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number }[] {
  if (nodes.length === 0) return [to];

  const entry = nearestRoadNode(nodes, from.x, from.y)!;
  const exit = nearestRoadNode(nodes, to.x, to.y)!;
  const pathNodes = findRoadPath(nodes, edges, entry.id, exit.id);
  const waypoints: { x: number; y: number }[] = pathNodes.length > 0 ? pathNodes.map((n) => ({ x: n.x, y: n.y })) : [entry];

  const last = waypoints[waypoints.length - 1];
  // Skip appending the real destination as its own waypoint if it's
  // already essentially where the path ends (e.g. the destination *is*
  // that building) — avoids a pointless near-zero-distance extra leg.
  if (Math.hypot(last.x - to.x, last.y - to.y) > 1e-4) waypoints.push(to);
  return waypoints;
}
