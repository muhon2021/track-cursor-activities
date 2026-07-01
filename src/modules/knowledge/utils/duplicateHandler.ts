import type { KnowledgeFile } from "../api/file";

export type DuplicateResolutionStrategy = "overwrite" | "version" | "skip";

export interface DuplicateFile {
  selectedFile: File;
  existingFile: KnowledgeFile;
}

export interface DuplicateResolution {
  file: File;
  strategy: DuplicateResolutionStrategy;
  existingFileId?: string;
}

export function findDuplicateFiles(selectedFiles: File[], existingFiles: KnowledgeFile[]): DuplicateFile[] {
  const existingByName = new Map(existingFiles.map((file) => [file.name.toLowerCase(), file]));

  return selectedFiles.reduce<DuplicateFile[]>((duplicates, selectedFile) => {
    const existingFile = existingByName.get(selectedFile.name.toLowerCase());

    if (existingFile) {
      duplicates.push({ selectedFile, existingFile });
    }

    return duplicates;
  }, []);
}

export function buildDuplicateResolutions(
  selectedFiles: File[],
  duplicates: DuplicateFile[],
  strategy: DuplicateResolutionStrategy,
): DuplicateResolution[] {
  const duplicateNames = new Set(duplicates.map((duplicate) => duplicate.selectedFile.name.toLowerCase()));
  const duplicateByName = new Map(duplicates.map((duplicate) => [duplicate.selectedFile.name.toLowerCase(), duplicate]));
  const nonDuplicates = selectedFiles
    .filter((file) => !duplicateNames.has(file.name.toLowerCase()))
    .map((file) => ({ file, strategy: "version" as const }));

  if (strategy === "skip") {
    return nonDuplicates;
  }

  const duplicateResolutions = duplicates.map((duplicate) => ({
    file:
      strategy === "version"
        ? createVersionedFile(duplicate.selectedFile, selectedFiles, duplicateByName)
        : duplicate.selectedFile,
    strategy,
    existingFileId: strategy === "overwrite" ? duplicate.existingFile.id : undefined,
  }));

  return [...nonDuplicates, ...duplicateResolutions];
}

function createVersionedFile(
  file: File,
  selectedFiles: File[],
  duplicateByName: Map<string, DuplicateFile>,
): File {
  const extensionIndex = file.name.lastIndexOf(".");
  const baseName = extensionIndex > 0 ? file.name.slice(0, extensionIndex) : file.name;
  const extension = extensionIndex > 0 ? file.name.slice(extensionIndex) : "";
  const usedNames = new Set([
    ...selectedFiles.map((selectedFile) => selectedFile.name.toLowerCase()),
    ...Array.from(duplicateByName.values()).map((duplicate) => duplicate.existingFile.name.toLowerCase()),
  ]);

  let version = 1;
  let nextName = `${baseName} (${version})${extension}`;

  while (usedNames.has(nextName.toLowerCase())) {
    version += 1;
    nextName = `${baseName} (${version})${extension}`;
  }

  return new File([file], nextName, { type: file.type, lastModified: file.lastModified });
}
