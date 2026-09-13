import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import {
  attribute,
  parseDockerPs,
  parseLsofCwds,
  parseLsofListeners,
  withoutPublishedPorts,
  type Container,
  type ContainerRow,
  type Listener,
  type ProjectRef,
  type RuntimeSnapshot,
  type Socket,
  type WorkspaceRef,
} from "../shared/runtime";

const run = promisify(execFile);

async function runTool(command: string, args: string[]): Promise<string> {
  const { stdout } = await run(command, args, {
    encoding: "utf8",
    timeout: 8_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

// lsof exits 1 when nothing matches, which is a valid empty answer
function isEmptyMatch(error: unknown): boolean {
  return typeof error === "object" && error !== null && Reflect.get(error, "code") === 1;
}

type Scopes = { workspaces: WorkspaceRef[]; projects: ProjectRef[] };

async function listScopes(context: PluginHandlerContext): Promise<Scopes> {
  const page = await context.paseo.workspaces.list();
  const workspaces: WorkspaceRef[] = [];
  const projects = new Map<string, ProjectRef>();
  for (const workspace of page.entries) {
    projects.set(workspace.projectId, {
      id: workspace.projectId,
      name: workspace.projectCustomName ?? workspace.projectDisplayName,
      rootPath: workspace.projectRootPath,
    });
    if (workspace.archivingAt !== null && workspace.archivingAt !== undefined) continue;
    workspaces.push({
      id: workspace.id,
      name: workspace.title ?? workspace.name,
      directory: workspace.workspaceDirectory ?? workspace.projectRootPath,
    });
  }
  // projects with no workspace at all still own directories worth naming
  try {
    const listed = await context.paseo.projects.list();
    for (const project of listed.projects) {
      if (!projects.has(project.projectId)) {
        projects.set(project.projectId, {
          id: project.projectId,
          name: project.projectCustomName ?? project.projectDisplayName,
          rootPath: project.projectRootPath,
        });
      }
    }
  } catch {
    // older daemons have no project listing; workspace-derived projects suffice
  }
  return { workspaces, projects: [...projects.values()] };
}

function attributeBoth(path: string | null, scopes: Scopes): { workspaceId: string | null; projectId: string | null } {
  return {
    workspaceId: attribute(path, scopes.workspaces),
    projectId: attribute(path, scopes.projects.map((project) => ({ id: project.id, directory: project.rootPath }))),
  };
}

async function listSockets(errors: string[]): Promise<Socket[]> {
  let sockets: Socket[];
  try {
    sockets = parseLsofListeners(await runTool("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pcn"]));
  } catch (error) {
    if (isEmptyMatch(error)) return [];
    errors.push(`lsof: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
  return sockets;
}

async function resolveListeners(sockets: Socket[], scopes: Scopes, errors: string[]): Promise<Listener[]> {
  const pids = [...new Set(sockets.map((socket) => socket.pid))];
  let cwds = new Map<number, string>();
  if (pids.length > 0) {
    try {
      cwds = parseLsofCwds(await runTool("lsof", ["-a", "-d", "cwd", "-p", pids.join(","), "-F", "pn"]));
    } catch (error) {
      // a process owned by another user hides its cwd; the port still shows, unassigned
      if (!isEmptyMatch(error)) errors.push(`lsof cwd: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return sockets.map((socket) => {
    const cwd = cwds.get(socket.pid) ?? null;
    return { ...socket, cwd, ...attributeBoth(cwd, scopes) };
  });
}

async function listContainerRows(errors: string[]): Promise<ContainerRow[]> {
  try {
    return parseDockerPs(await runTool("docker", ["ps", "--format", "{{json .}}"]));
  } catch (error) {
    errors.push(`docker: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return [];
  }
}

export async function snapshotRuntime(_input: object, context: PluginHandlerContext): Promise<RuntimeSnapshot> {
  const errors: string[] = [];
  const [scopes, sockets, rows] = await Promise.all([listScopes(context), listSockets(errors), listContainerRows(errors)]);
  const listeners = await resolveListeners(withoutPublishedPorts(sockets, rows), scopes, errors);
  const containers: Container[] = rows.map((row) => ({ ...row, ...attributeBoth(row.workingDir, scopes) }));
  return { ...scopes, listeners, containers, errors, takenAt: new Date().toISOString() };
}
