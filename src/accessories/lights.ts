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

  private async setOn(value: CharacteristicValue): Promise<void> {
    if (!value) return; // ignore the auto-reset to off

    try {
      await this.platform.api.flash();
      this.platform.log.info('Flash lights command sent.');
    } catch (err) {
      this.platform.log.error('Flash lights command failed:', err);
      throw err;
    } finally {
      // Reset switch back to off after a brief delay
      setTimeout(() => {
        this.service
          .getCharacteristic(this.platform.Characteristic.On)
          .updateValue(false);
      }, 1000);
    }
  }
}
