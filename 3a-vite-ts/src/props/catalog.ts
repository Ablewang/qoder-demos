import { registerProp } from "./registry";
import { registerClutter } from "./clutter";
import { registerSoftGoods } from "./soft-goods";
import { registerMachinery } from "./machinery";

registerClutter(registerProp);
registerSoftGoods(registerProp);
registerMachinery(registerProp);
