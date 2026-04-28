"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowAccessory = void 0;
class WindowAccessory {
    constructor(platform, accessory, windowKey) {
        this.platform = platform;
        this.windowKey = windowKey;
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
    getContactState() {
        const { Characteristic } = this.platform;
        const status = this.platform.cache.get().windows?.[this.windowKey]?.value;
        return status === 'CLOSED'
            ? Characteristic.ContactSensorState.CONTACT_DETECTED
            : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    }
}
exports.WindowAccessory = WindowAccessory;
//# sourceMappingURL=window.js.map