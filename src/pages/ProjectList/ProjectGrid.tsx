import type { DirectoryMeta, ProjectMeta } from '../../types/electron'
import { DirectoryCard } from './DirectoryCard'
import { ProjectCard } from './ProjectCard'

interface Props {
  directories: DirectoryMeta[]
  projects: ProjectMeta[]
  currentRelPath: string | null
  isSearchMode?: boolean
  selectedIds: Set<string>
  onSelect: (id: string, e: React.MouseEvent) => void
  onOpenDirectory: (relPath: string) => void
  onOpenProject: (folderName: string) => void
  onRenameDirectory: (dir: DirectoryMeta) => void
  onRenameProject: (project: ProjectMeta) => void
  onTrashDirectory: (relPath: string) => void
  onTrashProject: (folderName: string) => void
}

function parentOf(relPath: string): string | null {
  const i = relPath.lastIndexOf('/')
  return i === -1 ? null : relPath.slice(0, i)
}

export function ProjectGrid({
  directories,
  projects,
  currentRelPath,
  isSearchMode = false,
  selectedIds,
  onSelect,
  onOpenDirectory,
  onOpenProject,
  onRenameDirectory,
  onRenameProject,
  onTrashDirectory,
  onTrashProject,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {directories.map(dir => (
        <DirectoryCard
          key={dir.relPath}
          directory={dir}
          parentRelPath={isSearchMode ? parentOf(dir.relPath) : currentRelPath}
          isSelected={selectedIds.has(`dir::${dir.relPath}`)}
          onSelect={e => onSelect(`dir::${dir.relPath}`, e)}
          onOpen={() => onOpenDirectory(dir.relPath)}
          onRename={() => onRenameDirectory(dir)}
          onTrash={() => onTrashDirectory(dir.relPath)}
        />
      ))}
      {projects.map(project => (
        <ProjectCard
          key={project.folderName}
          project={project}
          currentDirRelPath={isSearchMode ? parentOf(project.folderName) : currentRelPath}
          isSelected={selectedIds.has(`proj::${project.folderName}`)}
          onSelect={e => onSelect(`proj::${project.folderName}`, e)}
          onOpen={() => onOpenProject(project.folderName)}
          onRename={() => onRenameProject(project)}
          onTrash={() => onTrashProject(project.folderName)}
        />
      ))}
    </div>
  )
}
