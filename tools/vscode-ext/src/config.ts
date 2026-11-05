import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/** Workspace folder that contains the assets (first folder that has one, else the first folder). */
export function workspaceRoot(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const assets = settings().get<string>('assetsPath', 'assets');
  return folders.find(f => fs.existsSync(path.join(f.uri.fsPath, assets))) ?? folders[0];
}

export function settings(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('csim');
}

export function assetsDir(): string | undefined {
  const root = workspaceRoot();
  if (!root) { return undefined; }
  const dir = path.join(root.uri.fsPath, settings().get<string>('assetsPath', 'assets'));
  return fs.existsSync(dir) ? dir : undefined;
}

export function yamlsDir(): string | undefined {
  const a = assetsDir();
  return a ? path.join(a, 'yamls') : undefined;
}

export function clarkesimPath(): string {
  const configured = settings().get<string>('clarkesimPath', '').trim();
  const ws = workspaceRoot()?.uri.fsPath ?? '';
  if (configured) { return path.resolve(ws, expandVars(configured, {})); }
  return path.resolve(ws, '..', 'Clarkesim');
}

function expandVars(s: string, vars: Record<string, string>): string {
  const all: Record<string, string> = { workspaceFolder: workspaceRoot()?.uri.fsPath ?? '', ...vars };
  return s.replace(/\$\{(\w+)\}/g, (m, k) => (k in all ? all[k] : m));
}

/** Resolve the Simulator binary for an aircraft. Returns the candidate path and whether it exists. */
export function simulatorPath(aircraft: string): { path: string; exists: boolean } {
  const template = settings().get<string>('simulatorPath', '${clarkesimPath}/_build/${aircraft}/src/Simulator');
  const p = path.normalize(expandVars(template, { clarkesimPath: clarkesimPath(), aircraft }));
  const candidates = process.platform === 'win32' && !p.toLowerCase().endsWith('.exe') ? [p + '.exe', p] : [p];
  const found = candidates.find(c => fs.existsSync(c));
  return { path: found ?? candidates[0], exists: !!found };
}

/** Aircraft folders under assets/yamls (excluding archive and _docs). */
export function knownAircraft(): string[] {
  const dir = yamlsDir();
  if (!dir || !fs.existsSync(dir)) { return []; }
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && d.name.toLowerCase() !== 'archive')
    .map(d => d.name)
    .sort();
}
