import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';
import type { DoorState } from '../api/types.js';

export type DoorKey = keyof DoorState;

export class DoorAccessory {
  private readonly service;

  constructor(
    private readonly platform: VolvoPlatform,
    accessory: PlatformAccessory,
    private readonly doorKey: DoorKey,
  ) {
    const { Service, Characteristic } = platform;

    accessory
      .getService(Service.AccessoryInformation)
      ?.setCharacteristic(Characteristic.Manufacturer, 'Volvo')
      .setCharacteristic(Characteristic.Model, 'Connected Vehicle');

    this.service =
      accessory.getService(Service.ContactSensor) ??
      accessory.addService(Service.ContactSensor);

    this.service
      .getCharacteristic(Characteristic.ContactSensorState)
      .onGet(() => this.getContactState());
  }

  private getContactState(): CharacteristicValue {
    const { Characteristic } = this.platform;
    const status = this.platform.cache.get().doors?.[this.doorKey]?.value;
    return status === 'CLOSED'
      ? Characteristic.ContactSensorState.CONTACT_DETECTED
      : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
  }
}
