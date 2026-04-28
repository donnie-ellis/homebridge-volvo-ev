export interface VolvoApiResponse<T> {
  data: T;
}

// --- Doors ---

export type DoorStatus = 'OPEN' | 'CLOSED' | 'AJAR';

export interface DoorState {
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

// --- Lock ---

export type LockStatus = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN';

export interface LockState {
  carLocked: { value: LockStatus };
}

// --- Recharge (Battery) ---

export type ChargingSystemStatus =
  | 'CHARGING_SYSTEM_CHARGING'
  | 'CHARGING_SYSTEM_IDLE'
  | 'CHARGING_SYSTEM_FAULT'
  | 'CHARGING_SYSTEM_UNSPECIFIED';

export interface RechargeState {
  batteryChargeLevel: { value: number }; // 0–100
  chargingSystemStatus: { value: ChargingSystemStatus };
  electricRange: { value: number }; // km
  estimatedChargingTime: { value: number }; // minutes
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
