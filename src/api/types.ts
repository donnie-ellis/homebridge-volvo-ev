export interface VolvoApiResponse<T> {
  data: T;
}

// --- Doors ---

export type DoorStatus = 'OPEN' | 'CLOSED' | 'AJAR';

export type CentralLockStatus = 'LOCKED' | 'UNLOCKED' | 'UNSPECIFIED';

/** GET /connected-vehicle/v2/vehicles/{vin}/doors — doors plus central lock. */
export interface DoorState {
  centralLock?: { value: CentralLockStatus };
  frontLeft: { value: DoorStatus };
  frontRight: { value: DoorStatus };
  rearLeft: { value: DoorStatus };
  rearRight: { value: DoorStatus };
  hood: { value: DoorStatus };
  tailgate: { value: DoorStatus };
}

// --- Windows ---

export type WindowStatus = 'OPEN' | 'CLOSED' | 'AJAR';

export interface WindowState {
  frontLeft: { value: WindowStatus };
  frontRight: { value: WindowStatus };
  rearLeft: { value: WindowStatus };
  rearRight: { value: WindowStatus };
}

// --- Energy (Battery) ---

/**
 * Energy API v2 field envelope. Unsupported fields arrive as
 * { status: 'ERROR', code: 'NOT_SUPPORTED' } with no value.
 */
export interface EnergyField<T> {
  status: 'OK' | 'ERROR';
  value?: T;
  unit?: string;
  updatedAt?: string;
  code?: string;
}

export type ChargingStatus = 'CHARGING' | 'DISCHARGING' | 'DONE' | 'ERROR' | 'IDLE' | 'SCHEDULED';
export type ChargerConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'FAULT';

/** GET /energy/v2/vehicles/{vin}/state — top-level object, no `data` wrapper. */
export interface EnergyState {
  batteryChargeLevel?: EnergyField<number>; // percentage
  electricRange?: EnergyField<number>; // km
  chargingStatus?: EnergyField<ChargingStatus>;
  chargerConnectionStatus?: EnergyField<ChargerConnectionStatus>;
}

// --- Engine / Climatization ---

export type EngineStatus = 'RUNNING' | 'STOPPED';

export interface EngineState {
  status: { value: EngineStatus };
}

// --- Commands ---

export interface CommandResponse {
  invokeStatus: 'COMPLETED' | 'FAILED' | 'UNKNOWN';
}
