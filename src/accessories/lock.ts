import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';

export class LockAccessory {
  private readonly service;

  constructor(
    private readonly platform: VolvoPlatform,
    accessory: PlatformAccessory,
  ) {
    const { Service, Characteristic } = platform;

    accessory
      .getService(Service.AccessoryInformation)
      ?.setCharacteristic(Characteristic.Manufacturer, 'Volvo')
      .setCharacteristic(Characteristic.Model, 'Connected Vehicle');

    this.service =
      accessory.getService(Service.LockMechanism) ??
      accessory.addService(Service.LockMechanism);

    this.service
      .getCharacteristic(Characteristic.LockCurrentState)
      .onGet(() => this.getCurrentState());

    this.service
      .getCharacteristic(Characteristic.LockTargetState)
      .onGet(() => this.getTargetState())
      .onSet((value) => this.setTargetState(value));
  }

  private getCurrentState(): CharacteristicValue {
    const { Characteristic } = this.platform;
    const status = this.platform.cache.get().doors?.centralLock?.value;
    switch (status) {
      case 'LOCKED': return Characteristic.LockCurrentState.SECURED;
      case 'UNLOCKED': return Characteristic.LockCurrentState.UNSECURED;
      default: return Characteristic.LockCurrentState.UNKNOWN;
    }
  }

  private getTargetState(): CharacteristicValue {
    const { Characteristic } = this.platform;
    const status = this.platform.cache.get().doors?.centralLock?.value;
    return status === 'LOCKED'
      ? Characteristic.LockTargetState.SECURED
      : Characteristic.LockTargetState.UNSECURED;
  }

  private setTargetState(value: CharacteristicValue): void {
    const { Characteristic } = this.platform;
    const locking = value === Characteristic.LockTargetState.SECURED;

    // HomeKit shows "Locking…/Unlocking…" until LockCurrentState catches up.
    this.platform.runCommand(
      locking ? 'Lock' : 'Unlock',
      () => (locking ? this.platform.api.lock() : this.platform.api.unlock()),
      (status) => {
        // The car confirmed it; show the new state now instead of waiting for the next poll.
        if (status === 'COMPLETED') {
          this.platform.cache.setCentralLock(locking ? 'LOCKED' : 'UNLOCKED');
          this.service.updateCharacteristic(Characteristic.LockCurrentState, this.getCurrentState());
        }
      },
      () => {
        // Revert the target so HomeKit stops spinning.
        this.service.updateCharacteristic(Characteristic.LockTargetState, this.getTargetState());
      },
    );
  }
}
