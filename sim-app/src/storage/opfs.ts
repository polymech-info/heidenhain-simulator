import { treeFromPaths, type SampleTree } from "@/storage/tree";

const ROOT = "heidenhain";

async function homeDir() {
  if (!navigator.storage?.getDirectory) throw new Error("OPFS is not available");
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(ROOT, { create: true });
}

async function descend(dir: FileSystemDirectoryHandle, parts: string[], create: boolean) {
  let current = dir;
  for (const part of parts) {
    if (!part || part === "." || part === "..") throw new Error("Invalid program path");
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

async function writeNew(dir: FileSystemDirectoryHandle, rel: string, text: string, overwrite: boolean) {
  const parts = rel.split("/");
  const name = parts.pop();
  if (!name) throw new Error("Invalid program path");
  const parent = await descend(dir, parts, true);
  if (!overwrite) {
    try {
      await parent.getFileHandle(name);
      return;
    } catch (err) {
      if (!(err instanceof DOMException) || err.name !== "NotFoundError") throw err;
    }
  }
  const handle = await parent.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function seedMissing(dir: FileSystemDirectoryHandle, files: Record<string, string>) {
  for (const [rel, text] of Object.entries(files)) await writeNew(dir, rel, text, false);
}

export async function writeFile(dir: FileSystemDirectoryHandle, rel: string, text: string) {
  await writeNew(dir, rel, text, true);
}

export async function readFile(dir: FileSystemDirectoryHandle, rel: string) {
  const parts = rel.split("/");
  const name = parts.pop();
  if (!name) throw new Error("Invalid program path");
  const parent = await descend(dir, parts, false);
  const handle = await parent.getFileHandle(name);
  return (await handle.getFile()).text();
}

async function listFiles(dir: FileSystemDirectoryHandle, prefix: string, out: string[]) {
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith(".")) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") await listFiles(handle as FileSystemDirectoryHandle, path, out);
    else if (name.toLowerCase().endsWith(".h")) out.push(path);
  }
}

export async function listTree(dir: FileSystemDirectoryHandle): Promise<SampleTree> {
  const paths: string[] = [];
  await listFiles(dir, "", paths);
  return treeFromPaths(paths);
}

export async function openOpfsRoot() {
  return homeDir();
}
