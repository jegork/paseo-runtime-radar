import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { View } from "react-native";
import { Errors, RuntimeSection, ScrollView, Toolbar, useRuntimeSnapshot, useStyles } from "./runtime-list";

/** This workspace's ports and containers, with everything else summarised below. */
export function RuntimePanel({ theme, layout, workspaceId }: PluginWorkspacePanelProps) {
  const styles = useStyles(theme, layout.compact);
  const query = useRuntimeSnapshot();
  const snapshot = query.data;
  const mine = {
    listeners: snapshot?.listeners.filter((l) => l.workspaceId === workspaceId) ?? [],
    containers: snapshot?.containers.filter((c) => c.workspaceId === workspaceId) ?? [],
  };
  const elsewhere = {
    listeners: snapshot?.listeners.filter((l) => l.workspaceId !== workspaceId) ?? [],
    containers: snapshot?.containers.filter((c) => c.workspaceId !== workspaceId) ?? [],
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Toolbar title="Runtime" snapshot={snapshot} refetch={() => void query.refetch()} fetching={query.isFetching} styles={styles} />
      <Errors errors={snapshot?.errors ?? []} styles={styles} />
      <RuntimeSection title="This workspace" listeners={mine.listeners} containers={mine.containers} styles={styles} theme={theme} showCwd={false} />
      <View>
        <RuntimeSection title="Elsewhere on this machine" listeners={elsewhere.listeners} containers={elsewhere.containers} styles={styles} theme={theme} showCwd />
      </View>
    </ScrollView>
  );
}
