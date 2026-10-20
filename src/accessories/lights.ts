import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';

export class LightsAccessory {
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
      accessory.getService(Service.Switch) ??
      accessory.addService(Service.Switch);

    this.service
      .getCharacteristic(Characteristic.On)
      .onGet(() => false) // always reports off — momentary action
      .onSet((value) => this.setOn(value));
  }

  private setOn(value: CharacteristicValue): void {
    if (!value) return; // ignore the auto-reset to off

    this.platform.runCommand('Flash lights', () => this.platform.api.flash());

    // Momentary: reset the switch back to off after a brief delay
    setTimeout(() => {
      this.service
        .getCharacteristic(this.platform.Characteristic.On)
        .updateValue(false);
    }, 1000);
  }
}
