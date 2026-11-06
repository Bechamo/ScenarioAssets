import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/** Workspace folder that contains the assets (first folder with an stf/ or mission/ folder, else the first folder). */
export function workspaceRoot(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const assets = settings().get<string>('assetsPath', '.');
  const hasAssets = (f: vscode.WorkspaceFolder) =>
    ['stf', 'mission'].some(d => fs.existsSync(path.join(f.uri.fsPath, assets, d)));
  return folders.find(hasAssets) ?? folders[0];
}

export function settings(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('csim');
}

export function assetsDir(): string | undefined {
  const root = workspaceRoot();
  if (!root) { return undefined; }
  const dir = path.join(root.uri.fsPath, settings().get<string>('assetsPath', '.'));
  return fs.existsSync(dir) ? dir : undefined;
}

/** Clarkesim's config/ folder, which holds the aircraft configs. */
export function configsDir(): string | undefined {
  const dir = path.join(clarkesimPath(), 'config');
  return fs.existsSync(dir) ? dir : undefined;
}

export function clarkesimPath(): string {
  const configured = settings().get<string>('clarkesimPath', '').trim();
  const ws = workspaceRoot()?.uri.fsPath ?? '';
  if (configured) { return path.resolve(ws, expandVars(configured, {})); }
  // ScenarioAssets is either checked out as Clarkesim's src/submodules/ScenarioAssets,
  // or cloned next to it as ../Clarkesim.
  const candidates = [path.resolve(ws, '..', '..', '..'), path.resolve(ws, '..', 'Clarkesim')];
  return candidates.find(c => fs.existsSync(path.join(c, 'config')) && fs.existsSync(path.join(c, 'src', 'submodules')))
    ?? candidates[1];
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

const NON_AIRCRAFT = ['archive', 'stf'];

/** Aircraft folders under Clarkesim's config/ (excluding archive, stf and _docs). */
export function knownAircraft(): string[] {
  const dir = configsDir();
  if (!dir || !fs.existsSync(dir)) { return []; }
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !NON_AIRCRAFT.includes(d.name.toLowerCase()))
    .map(d => d.name)
    .sort();
}
