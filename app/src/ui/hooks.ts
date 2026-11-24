/* React hooks that follow the engine state. */
import { useSyncExternalStore } from 'react';
import { subscribe, getVersion, subscribeScreen, getScreenVersion } from '../core/state';
import { subscribeLive, getLiveVersion } from '../core/draw';

/** Draws the component again after every render() of the engine. */
export const useVersion = () => useSyncExternalStore(subscribe, getVersion);
/** Follows the status block over the image (verdict, picture name, worst tool, lamps). */
export const useScreen = () => useSyncExternalStore(subscribeScreen, getScreenVersion);
/** Follows the live inspection (RUN tool list). */
export const useLive = () => useSyncExternalStore(subscribeLive, getLiveVersion);
