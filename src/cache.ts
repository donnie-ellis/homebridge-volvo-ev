import type { CentralLockStatus, DoorState, WindowState, EnergyState, EngineState } from './api/types.js';

export interface VehicleSnapshot {
  doors?: DoorState;
  windows?: WindowState;
  energy?: EnergyState;
  engine?: EngineState;
  lastUpdated?: number; // unix ms
}

export class VehicleCache {
  private snapshot: VehicleSnapshot = {};

  update(partial: Partial<VehicleSnapshot>): void {
    Object.assign(this.snapshot, partial, { lastUpdated: Date.now() });
  }

  /** Optimistically record a lock state the car has confirmed, ahead of the next poll. */
  setCentralLock(value: CentralLockStatus): void {
    if (this.snapshot.doors) {
      this.snapshot.doors = { ...this.snapshot.doors, centralLock: { value } };
    }
  }

  get(): Readonly<VehicleSnapshot> {
    return this.snapshot;
  }
}
