import { get, set } from 'idb-keyval';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  compileQueriesForScopes,
  validateProjectImport,
  type ProviderId,
  type ReconProject,
} from '@reconforge/core';
import { templatesForPacks } from '@reconforge/templates';
import { createDemoProject } from '../lib/demo.js';

const STORAGE_KEY = 'reconforge.projects.v1';
const LEGACY_KEY = 'reconforge.active-project.v1';

interface ProjectWorkspace {
  version: 1;
  activeProjectId: string | null;
  projects: ReconProject[];
  deletedProjects: ReconProject[];
}

interface ProjectContextValue {
  project: ReconProject | null;
  projects: ReconProject[];
  deletedProjects: ReconProject[];
  loading: boolean;
  updateProject: (project: ReconProject | null) => void;
  mutateProject: (update: (current: ReconProject) => ReconProject) => void;
  selectProject: (id: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  restoreLastDeleted: () => void;
  importProject: (project: ReconProject) => void;
  loadDemo: () => void;
}

const emptyWorkspace: ProjectWorkspace = {
  version: 1,
  activeProjectId: null,
  projects: [],
  deletedProjects: [],
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([get<unknown>(STORAGE_KEY), get<unknown>(LEGACY_KEY)])
      .then(([stored, legacy]) => {
        if (!active) return;
        const restored = restoreWorkspace(stored, legacy);
        setWorkspace(restored);
        void set(STORAGE_KEY, restored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const commit = useCallback((update: (current: ProjectWorkspace) => ProjectWorkspace) => {
    setWorkspace((current) => {
      const next = update(current);
      void set(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const updateProject = useCallback(
    (next: ReconProject | null) => {
      commit((current) => {
        if (!next) return { ...current, activeProjectId: null };
        const projects = current.projects.some((item) => item.id === next.id)
          ? current.projects.map((item) => (item.id === next.id ? next : item))
          : [next, ...current.projects];
        return { ...current, activeProjectId: next.id, projects };
      });
    },
    [commit],
  );

  const mutateProject = useCallback(
    (update: (current: ReconProject) => ReconProject) => {
      commit((current) => {
        if (!current.activeProjectId) return current;
        return {
          ...current,
          projects: current.projects.map((item) =>
            item.id === current.activeProjectId ? update(item) : item,
          ),
        };
      });
    },
    [commit],
  );

  const selectProject = useCallback(
    (id: string) =>
      commit((current) =>
        current.projects.some((item) => item.id === id)
          ? { ...current, activeProjectId: id }
          : current,
      ),
    [commit],
  );

  const deleteProject = useCallback(
    (id: string) =>
      commit((current) => {
        const removed = current.projects.find((item) => item.id === id);
        if (!removed) return current;
        const projects = current.projects.filter((item) => item.id !== id);
        return {
          ...current,
          projects,
          activeProjectId:
            current.activeProjectId === id ? (projects[0]?.id ?? null) : current.activeProjectId,
          deletedProjects: [removed, ...current.deletedProjects].slice(0, 5),
        };
      }),
    [commit],
  );

  const duplicateProject = useCallback(
    (id: string) =>
      commit((current) => {
        const source = current.projects.find((item) => item.id === id);
        if (!source) return current;
        const now = new Date().toISOString();
        const copy: ReconProject = {
          ...structuredClone(source),
          id: crypto.randomUUID(),
          name: `${source.name} (copy)`.slice(0, 120),
          createdAt: now,
          updatedAt: now,
        };
        return { ...current, activeProjectId: copy.id, projects: [copy, ...current.projects] };
      }),
    [commit],
  );

  const restoreLastDeleted = useCallback(
    () =>
      commit((current) => {
        const [restored, ...deletedProjects] = current.deletedProjects;
        if (!restored) return current;
        return {
          ...current,
          activeProjectId: restored.id,
          projects: [restored, ...current.projects.filter((item) => item.id !== restored.id)],
          deletedProjects,
        };
      }),
    [commit],
  );

  const importProject = useCallback(
    (incoming: ReconProject) => {
      commit((current) => {
        incoming = recompileImportedProject(incoming);
        const duplicate = current.projects.some((item) => item.id === incoming.id);
        const project = duplicate
          ? {
              ...incoming,
              id: crypto.randomUUID(),
              name: `${incoming.name} (imported copy)`.slice(0, 120),
            }
          : incoming;
        return {
          ...current,
          activeProjectId: project.id,
          projects: [project, ...current.projects],
        };
      });
    },
    [commit],
  );

  const loadDemo = useCallback(
    () =>
      commit((current) => {
        const existing = current.projects.find((item) => item.id === 'synthetic-example-demo');
        if (existing) return { ...current, activeProjectId: existing.id };
        const demo = createDemoProject();
        return { ...current, activeProjectId: demo.id, projects: [demo, ...current.projects] };
      }),
    [commit],
  );

  const project = workspace.projects.find((item) => item.id === workspace.activeProjectId) ?? null;
  const value = useMemo(
    () => ({
      project,
      projects: workspace.projects,
      deletedProjects: workspace.deletedProjects,
      loading,
      updateProject,
      mutateProject,
      selectProject,
      deleteProject,
      duplicateProject,
      restoreLastDeleted,
      importProject,
      loadDemo,
    }),
    [
      project,
      workspace.projects,
      workspace.deletedProjects,
      loading,
      updateProject,
      mutateProject,
      selectProject,
      deleteProject,
      duplicateProject,
      restoreLastDeleted,
      importProject,
      loadDemo,
    ],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

function restoreWorkspace(stored: unknown, legacy: unknown): ProjectWorkspace {
  if (typeof stored === 'object' && stored !== null && 'projects' in stored) {
    const candidate = stored as Partial<ProjectWorkspace>;
    const projects = validateStoredProjects(candidate.projects);
    const deletedProjects = validateStoredProjects(candidate.deletedProjects).slice(0, 5);
    const activeProjectId = projects.some((item) => item.id === candidate.activeProjectId)
      ? (candidate.activeProjectId ?? null)
      : (projects[0]?.id ?? null);
    return { version: 1, activeProjectId, projects, deletedProjects };
  }
  const [legacyProject] = validateStoredProjects([legacy]);
  return legacyProject
    ? {
        version: 1,
        activeProjectId: legacyProject.id,
        projects: [legacyProject],
        deletedProjects: [],
      }
    : emptyWorkspace;
}

function validateStoredProjects(value: unknown): ReconProject[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item) => {
    try {
      return [recompileImportedProject(validateProjectImport(JSON.stringify(item)))];
    } catch {
      return [];
    }
  });
}

function recompileImportedProject(project: ReconProject): ReconProject {
  const scopes = [project.scope, ...(project.additionalScopes ?? [])];
  const provider = project.queries[0]?.provider ?? 'google-link';
  const safeProvider: ProviderId = provider === 'mock' ? 'google-link' : provider;
  return {
    ...project,
    queries: compileQueriesForScopes(scopes, templatesForPacks(project.selectedPackIds), {
      provider: safeProvider,
      authorizationConfirmed: true,
    }),
  };
}

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error('useProject must be used inside ProjectProvider.');
  return value;
}
