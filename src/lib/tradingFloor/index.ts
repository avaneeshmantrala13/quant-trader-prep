/**
 * THE TRADING FLOOR — pure engine barrel. React code imports everything it needs
 * from here; the module stays framework-free and deterministic.
 */
export * from "./types";
export * from "./config";
export * from "./bot";
export * from "./scoring";
export * from "./benchmark";
export * from "./engine";
export * from "./packs";
export { diceBinaryScenario, diceQuantityScenario, probSumOver } from "./scenarios/dice";
export { fermiScenario } from "./scenarios/fermi";
