import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import type { VolvoPlatform } from '../platform.js';

const LOW_BATTERY_THRESHOLD = 20;

export class BatteryAccessory {
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
      accessory.getService(Service.Battery) ??
      accessory.addService(Service.Battery);

    this.service
      .getCharacteristic(Characteristic.BatteryLevel)
      .onGet(() => this.getBatteryLevel());

    this.service
      .getCharacteristic(Characteristic.ChargingState)
      .onGet(() => this.getChargingState());

    this.service
      .getCharacteristic(Characteristic.StatusLowBattery)
      .onGet(() => this.getLowBatteryStatus());
  }

  /** Battery level 0–100, or undefined if the car hasn't reported one. */
  private level(): number | undefined {
    const field = this.platform.cache.get().energy?.batteryChargeLevel;
    return field?.status === 'OK' && typeof field.value === 'number'
      ? Math.max(0, Math.min(100, Math.round(field.value)))
      : undefined;
  }

  private getBatteryLevel(): CharacteristicValue {
    return this.level() ?? 0;
  }

  private getChargingState(): CharacteristicValue {
    const { Characteristic } = this.platform;
    const energy = this.platform.cache.get().energy;
    const status = energy?.chargingStatus?.status === 'OK' ? energy.chargingStatus.value : undefined;
    const connection = energy?.chargerConnectionStatus?.status === 'OK'
      ? energy.chargerConnectionStatus.value
      : undefined;
    if (status === 'CHARGING') return Characteristic.ChargingState.CHARGING;
    if (status === 'ERROR' || connection === 'FAULT') return Characteristic.ChargingState.NOT_CHARGEABLE;
    return Characteristic.ChargingState.NOT_CHARGING;
  }

  private getLowBatteryStatus(): CharacteristicValue {
    const { Characteristic } = this.platform;
    const level = this.level() ?? 100;
    return level <= LOW_BATTERY_THRESHOLD
      ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }
}
