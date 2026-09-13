import type { PluginHostProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { Icon, ScrollView } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { runtimeSnapshotRpc, type Container, type Listener, type RuntimeSnapshot } from "../shared/runtime";

export const REFRESH_MS = 5_000;

export function useRuntimeSnapshot() {
  const snapshot = useRpc(runtimeSnapshotRpc);
  return useQuery({
    queryKey: ["runtime-radar", "snapshot"],
    queryFn: () => snapshot({}),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useStyles(theme: PluginHostProps["theme"], compact: boolean) {
  return useMemo(
    () => ({
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: compact ? 12 : 20, gap: compact ? 12 : 16 },
      toolbar: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
      title: { color: theme.colors.foreground, fontSize: compact ? 18 : 22, fontWeight: "600" as const, flex: 1 },
      muted: { color: theme.colors.foregroundMuted, fontSize: 12 },
      action: { color: theme.colors.accent, fontSize: 13 },
      section: { gap: 6 },
      heading: { color: theme.colors.foreground, fontSize: 14, fontWeight: "600" as const },
      row: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: theme.colors.surface1,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      port: { color: theme.colors.foreground, fontFamily: "monospace", fontSize: 13, minWidth: 56 },
      name: { color: theme.colors.foreground, fontSize: 13, flexShrink: 1 },
      detail: { color: theme.colors.foregroundMuted, fontSize: 12, flexShrink: 1 },
      dot: { width: 8, height: 8, borderRadius: 4 },
      empty: { color: theme.colors.foregroundMuted, fontSize: 13, paddingVertical: 4 },
      error: { color: theme.colors.statusWarning, fontSize: 12 },
    }),
    [theme, compact],
  );
}

type Styles = ReturnType<typeof useStyles>;

function ListenerRow({ listener, styles, theme, showCwd }: { listener: Listener; styles: Styles; theme: PluginHostProps["theme"]; showCwd: boolean }) {
  return (
    <View style={styles.row}>
      <Icon name="Radio" size={14} color={theme.colors.accent} />
      <Text style={styles.port}>{`:${listener.port}`}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {listener.command}
      </Text>
      <Text style={styles.detail} numberOfLines={1}>
        {`pid ${listener.pid}${listener.address !== "*" ? ` · ${listener.address}` : ""}${showCwd && listener.cwd !== null ? ` · ${listener.cwd}` : ""}`}
      </Text>
    </View>
  );
}

function ContainerRow({ container, styles, theme }: { container: Container; styles: Styles; theme: PluginHostProps["theme"] }) {
  const up = container.status.startsWith("Up");
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: up ? theme.colors.statusSuccess : theme.colors.statusWarning }]} />
      <Text style={styles.name} numberOfLines={1}>
        {container.name}
      </Text>
      <Text style={styles.detail} numberOfLines={1}>
        {[container.image, container.status, ...container.ports].join(" · ")}
      </Text>
    </View>
  );
}

export function RuntimeSection({
  title,
  listeners,
  containers,
  styles,
  theme,
  showCwd,
}: {
  title: string | null;
  listeners: Listener[];
  containers: Container[];
  styles: Styles;
  theme: PluginHostProps["theme"];
  showCwd: boolean;
}) {
  return (
    <View style={styles.section}>
      {title !== null ? (
        <Text style={styles.heading}>{`${title} · ${listeners.length} ports · ${containers.length} containers`}</Text>
      ) : null}
      {listeners.length === 0 && containers.length === 0 ? <Text style={styles.empty}>Nothing running.</Text> : null}
      {listeners.map((listener) => (
        <ListenerRow key={`${listener.pid}-${listener.address}-${listener.port}`} listener={listener} styles={styles} theme={theme} showCwd={showCwd} />
      ))}
      {containers.map((container) => (
        <ContainerRow key={container.id} container={container} styles={styles} theme={theme} />
      ))}
    </View>
  );
}

export function Toolbar({ title, snapshot, refetch, fetching, styles }: { title: string; snapshot: RuntimeSnapshot | undefined; refetch: () => void; fetching: boolean; styles: Styles }) {
  return (
    <View style={styles.toolbar}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>{snapshot ? new Date(snapshot.takenAt).toLocaleTimeString() : "…"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh" onPress={refetch} disabled={fetching}>
        <Text style={styles.action}>{fetching ? "Refreshing" : "Refresh"}</Text>
      </Pressable>
    </View>
  );
}

export function Errors({ errors, styles }: { errors: string[]; styles: Styles }) {
  return errors.length === 0 ? null : (
    <View>
      {errors.map((error) => (
        <Text key={error} style={styles.error}>
          {error}
        </Text>
      ))}
    </View>
  );
}

export { ScrollView };
