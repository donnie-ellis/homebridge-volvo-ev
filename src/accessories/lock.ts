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
    const status = this.platform.cache.get().lock?.carLocked?.value;
    switch (status) {
      case 'LOCKED': return Characteristic.LockCurrentState.SECURED;
      case 'UNLOCKED': return Characteristic.LockCurrentState.UNSECURED;
      default: return Characteristic.LockCurrentState.UNKNOWN;
    }
  }

  private getTargetState(): CharacteristicValue {
    const { Characteristic } = this.platform;
    const status = this.platform.cache.get().lock?.carLocked?.value;
    return status === 'LOCKED'
      ? Characteristic.LockTargetState.SECURED
      : Characteristic.LockTargetState.UNSECURED;
  }

  private async setTargetState(value: CharacteristicValue): Promise<void> {
    const { Characteristic } = this.platform;
    try {
      if (value === Characteristic.LockTargetState.SECURED) {
        await this.platform.api.lock();
        this.platform.log.info('Lock command sent.');
      } else {
        await this.platform.api.unlock();
        this.platform.log.info('Unlock command sent.');
      }
      await this.platform.refreshCache();
    } catch (err) {
      this.platform.log.error('Lock command failed:', err);
      throw err;
    }
  }
}
