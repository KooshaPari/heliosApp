let laneIdCounter = 0;

export function generateLaneId(): string {
  laneIdCounter += 1;
  return `lane_${Date.now()}_${laneIdCounter.toString(36)}`;
}

export function resetLaneIdCounter(): void {
  laneIdCounter = 0;
}
