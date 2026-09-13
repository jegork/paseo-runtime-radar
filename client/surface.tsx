import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { Pressable, Text, View } from "react-native";
import { Errors, RuntimeSection, ScrollView, Toolbar, useRuntimeSnapshot, useStyles } from "./runtime-list";

/** Every workspace with its ports and containers, then whatever could not be attributed. */
export function RuntimeSurface({ theme, layout, navigation }: PluginSurfaceProps) {
  const styles = useStyles(theme, layout.compact);
  const query = useRuntimeSnapshot();
  const snapshot = query.data;
  const workspaces = snapshot?.workspaces ?? [];
  const active = workspaces.filter(
    (w) => snapshot?.listeners.some((l) => l.workspaceId === w.id) || snapshot?.containers.some((c) => c.workspaceId === w.id),
  );
  // a project's main checkout with no open workspace still owns its processes
  const projects = (snapshot?.projects ?? []).filter(
    (p) =>
      snapshot?.listeners.some((l) => l.workspaceId === null && l.projectId === p.id) ||
      snapshot?.containers.some((c) => c.workspaceId === null && c.projectId === p.id),
  );
  const unassigned = {
    listeners: snapshot?.listeners.filter((l) => l.workspaceId === null && l.projectId === null) ?? [],
    containers: snapshot?.containers.filter((c) => c.workspaceId === null && c.projectId === null) ?? [],
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Toolbar title="Runtime radar" snapshot={snapshot} refetch={() => void query.refetch()} fetching={query.isFetching} styles={styles} />
      <Errors errors={snapshot?.errors ?? []} styles={styles} />
      {snapshot && active.length === 0 ? <Text style={styles.empty}>No workspace has a port or container attached.</Text> : null}
      {active.map((workspace) => (
        <View key={workspace.id} style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open workspace ${workspace.name}`}
            disabled={navigation === undefined}
            onPress={() => navigation?.openWorkspace({ workspaceId: workspace.id })}
          >
            <Text style={styles.heading}>{workspace.name}</Text>
            <Text style={styles.muted} numberOfLines={1}>
              {workspace.directory}
            </Text>
          </Pressable>
          <RuntimeSection
            title={null}
            listeners={snapshot?.listeners.filter((l) => l.workspaceId === workspace.id) ?? []}
            containers={snapshot?.containers.filter((c) => c.workspaceId === workspace.id) ?? []}
            styles={styles}
            theme={theme}
            showCwd={false}
          />
        </View>
      ))}
      {projects.map((project) => (
        <View key={project.id} style={styles.section}>
          <Text style={styles.heading}>{`${project.name} · no open workspace`}</Text>
          <Text style={styles.muted} numberOfLines={1}>
            {project.rootPath}
          </Text>
          <RuntimeSection
            title={null}
            listeners={snapshot?.listeners.filter((l) => l.workspaceId === null && l.projectId === project.id) ?? []}
            containers={snapshot?.containers.filter((c) => c.workspaceId === null && c.projectId === project.id) ?? []}
            styles={styles}
            theme={theme}
            showCwd={false}
          />
        </View>
      ))}
      <RuntimeSection title="Not attached to any project" listeners={unassigned.listeners} containers={unassigned.containers} styles={styles} theme={theme} showCwd />
    </ScrollView>
  );
}
