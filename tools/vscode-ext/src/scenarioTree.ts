import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { assetsDir, configsDir, settings } from './config';

export type Category = 'config' | 'stf' | 'mission';

export interface ScenarioNode {
  kind: 'group' | 'folder' | 'file';
  category: Category;
  uri: vscode.Uri;
  label: string;
}

/** Configs come from Clarkesim's config/; STF tests and missions from the ScenarioAssets root. */
const GROUPS: { label: string; dir: () => string | undefined; category: Category }[] = [
  { label: 'Configs', dir: () => configsDir(), category: 'config' },
  { label: 'STF tests', dir: () => sub(assetsDir(), 'stf'), category: 'stf' },
  { label: 'Missions', dir: () => sub(assetsDir(), 'mission'), category: 'mission' },
];

function sub(root: string | undefined, dir: string): string | undefined {
  return root ? path.join(root, dir) : undefined;
}

const EXTENSIONS: Record<Category, string[]> = {
  config: ['.yaml', '.yml'],
  stf: ['.stf'],
  mission: ['.plan'],
};

export class ScenarioTreeProvider implements vscode.TreeDataProvider<ScenarioNode> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  refresh(): void { this.changed.fire(); }

  getTreeItem(node: ScenarioNode): vscode.TreeItem {
    if (node.kind !== 'file') {
      const item = new vscode.TreeItem(node.label,
        node.kind === 'group' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = node.kind === 'group' ? groupIcon(node.category) : vscode.ThemeIcon.Folder;
      item.contextValue = `csim.${node.kind}`;
      item.tooltip = node.uri.fsPath;
      return item;
    }
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.resourceUri = node.uri;
    item.contextValue = `csim.${node.category}`;
    item.tooltip = node.uri.fsPath;
    item.command = { command: 'vscode.open', title: 'Open', arguments: [node.uri] };
    if (node.category === 'config') {
      const mode = /_(silsim|pilsim|hilsim|px4)/i.exec(node.label)?.[1];
      if (mode) { item.description = mode.toLowerCase(); }
    }
    return item;
  }

  async getChildren(node?: ScenarioNode): Promise<ScenarioNode[]> {
    if (!node) {
      const groups: ScenarioNode[] = [];
      for (const g of GROUPS) {
        const dir = g.dir();
        if (dir && fs.existsSync(dir)) {
          groups.push({ kind: 'group', category: g.category, label: g.label, uri: vscode.Uri.file(dir) });
        }
      }
      return groups;
    }
    if (node.kind === 'file') { return []; }

    const showArchive = settings().get<boolean>('showArchive', false);
    const entries = await fs.promises.readdir(node.uri.fsPath, { withFileTypes: true });
    const folders: ScenarioNode[] = [];
    const files: ScenarioNode[] = [];
    for (const e of entries) {
      if (e.name.startsWith('_') || e.name.startsWith('.')) { continue; }
      const uri = vscode.Uri.file(path.join(node.uri.fsPath, e.name));
      if (e.isDirectory()) {
        if (!showArchive && e.name.toLowerCase() === 'archive') { continue; }
        folders.push({ kind: 'folder', category: node.category, uri, label: e.name });
      } else if (EXTENSIONS[node.category].includes(path.extname(e.name).toLowerCase())) {
        files.push({ kind: 'file', category: node.category, uri, label: e.name });
      }
    }
    const byLabel = (a: ScenarioNode, b: ScenarioNode) => a.label.localeCompare(b.label);
    return [...folders.sort(byLabel), ...files.sort(byLabel)];
  }
}

function groupIcon(c: Category): vscode.ThemeIcon {
  return new vscode.ThemeIcon(c === 'config' ? 'settings-gear' : c === 'stf' ? 'beaker' : 'map');
}
