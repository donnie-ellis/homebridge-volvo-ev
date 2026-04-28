"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LightsAccessory = void 0;
class LightsAccessory {
    constructor(platform, accessory) {
        this.platform = platform;
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
    async setOn(value) {
        if (!value)
            return; // ignore the auto-reset to off
        try {
            await this.platform.api.flash();
            this.platform.log.info('Flash lights command sent.');
        }
        catch (err) {
            this.platform.log.error('Flash lights command failed:', err);
            throw err;
        }
        finally {
            // Reset switch back to off after a brief delay
            setTimeout(() => {
                this.service
                    .getCharacteristic(this.platform.Characteristic.On)
                    .updateValue(false);
            }, 1000);
        }
    }
}
exports.LightsAccessory = LightsAccessory;
//# sourceMappingURL=lights.js.map