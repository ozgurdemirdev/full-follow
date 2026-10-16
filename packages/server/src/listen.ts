import type { PasswordSource } from "./auth";
import { LISTEN_LOCAL, LISTEN_NETWORK, LOOPBACK_HOSTS } from "./constants";

/**
 * Where the server listens. FF_HOST decides when set. Otherwise an FF_PASSWORD install opens to the local network as it always has
 * (the phone reaches it); a password set in the panel opens it only while the owner's "Telefondan erişim" setting is on; the first
 * run (no password) stays on this computer.
 */
export function listenHost(source: PasswordSource, phoneAccess: boolean, envHost = process.env.FF_HOST): string {
  if (envHost) return envHost;
  return source === "env" || (source === "app" && phoneAccess) ? LISTEN_NETWORK : LISTEN_LOCAL;
}

/** Whether the server may listen there: beyond this computer only with a password, so no setting or FF_HOST opens a first run to the network */
export const mayListen = (source: PasswordSource, host: string) => source !== null || LOOPBACK_HOSTS.includes(host);
