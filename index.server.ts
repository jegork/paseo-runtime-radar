import type { PluginServerContext } from "@getpaseo/plugin/server";
import { snapshotRuntime } from "./server/runtime.server";
import { runtimeSnapshotRpc } from "./shared/runtime";

export default function contribute(server: PluginServerContext) {
  server.handle(runtimeSnapshotRpc, snapshotRuntime);
  return () => {};
}
