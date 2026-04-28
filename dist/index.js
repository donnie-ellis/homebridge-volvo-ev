"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_NAME = exports.PLUGIN_NAME = void 0;
const platform_js_1 = require("./platform.js");
exports.PLUGIN_NAME = 'homebridge-volvo-ev';
exports.PLATFORM_NAME = 'VolvoEV';
exports.default = (api) => {
    api.registerPlatform(exports.PLUGIN_NAME, exports.PLATFORM_NAME, platform_js_1.VolvoPlatform);
};
//# sourceMappingURL=index.js.map