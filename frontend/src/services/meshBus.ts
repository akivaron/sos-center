import type { SOSSignal } from "../types";

type BroadcastFn = (body: string) => Promise<void>;
type SOSListener = (payload: SOSSignal) => void;
type LocationListener = (payload: {
  user_id: string;
  name: string;
  longitude: number;
  latitude: number;
  accuracy: number | null;
  source: "mesh";
  updated_at: string;
}) => void;

let broadcastFn: BroadcastFn | null = null;
let sosListener: SOSListener | null = null;
let locationListener: LocationListener | null = null;

const SOS_TAG = "__resq_sos__";
const LOCATION_TAG = "__resq_loc__";

export const meshBus = {
  setBroadcast(fn: BroadcastFn | null) {
    broadcastFn = fn;
  },
  setSOSListener(fn: SOSListener | null) {
    sosListener = fn;
  },
  setLocationListener(fn: LocationListener | null) {
    locationListener = fn;
  },
  async broadcastSOS(signal: SOSSignal): Promise<boolean> {
    if (!broadcastFn) return false;
    try {
      await broadcastFn(JSON.stringify({ [SOS_TAG]: true, signal }));
      return true;
    } catch {
      return false;
    }
  },
  async broadcastLocation(payload: {
    user_id: string;
    name: string;
    longitude: number;
    latitude: number;
    accuracy: number | null;
    source: "mesh";
    updated_at: string;
  }): Promise<boolean> {
    if (!broadcastFn) return false;
    try {
      await broadcastFn(JSON.stringify({ [LOCATION_TAG]: true, loc: payload }));
      return true;
    } catch {
      return false;
    }
  },
  receiveRaw(body: string): boolean {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (parsed[SOS_TAG] === true && parsed.signal) {
        const signal = parsed.signal as SOSSignal;
        signal.via_mesh = true;
        sosListener?.(signal);
        return true;
      }
      if (parsed[LOCATION_TAG] === true && parsed.loc) {
        const loc = parsed.loc as {
          user_id: string;
          name: string;
          longitude: number;
          latitude: number;
          accuracy: number | null;
          source: "mesh";
          updated_at: string;
        };
        locationListener?.(loc);
        return true;
      }
    } catch {
      /* not a structured mesh frame */
    }
    return false;
  },
};
