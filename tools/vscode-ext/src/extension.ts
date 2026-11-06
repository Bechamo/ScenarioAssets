import * as vscode from 'vscode';
import * as path from 'path';
import { assetsDir, configsDir, settings } from './config';
import { output, runConfig, runConfigWithStf, watchTaskExits } from './runner';
import { ScenarioNode, ScenarioTreeProvider } from './scenarioTree';

export function activate(ctx: vscode.ExtensionContext): void {
  const tree = new ScenarioTreeProvider();

  ctx.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider('csim.scenarios', tree),
    watchTaskExits(),

    vscode.commands.registerCommand('csim.refresh', () => tree.refresh()),
    vscode.commands.registerCommand('csim.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:bechamo.csim-scenarios')),

    vscode.commands.registerCommand('csim.runConfig', async (arg?: unknown) => {
      const uri = toUri(arg);
      if (!uri) { return; }
      await runConfig(uri.fsPath);
    }),

    vscode.commands.registerCommand('csim.runConfigWithStf', async (arg?: unknown) => {
      const config = toUri(arg);
      if (!config) { return; }
      const stf = await pickFile(assetsDir(), 'stf/**/*.stf', 'Pick an STF test to run with ' + path.basename(config.fsPath));
      if (stf) { await runConfigWithStf(ctx, config.fsPath, stf.fsPath); }
    }),

    vscode.commands.registerCommand('csim.runStf', async (arg?: unknown) => {
      const stf = toUri(arg);
      if (!stf) { return; }
      const config = await pickFile(configsDir(), '**/*.{yaml,yml}', 'Pick a config to run ' + path.basename(stf.fsPath) + ' with');
      if (config) { await runConfigWithStf(ctx, config.fsPath, stf.fsPath); }
    }),
  );

  // Keep the tree in sync with the assets and config folders.
  for (const dir of [assetsDir(), configsDir()]) {
    if (!dir) { continue; }
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(dir, '**/*'));
    ctx.subscriptions.push(watcher,
      watcher.onDidCreate(() => tree.refresh()),
      watcher.onDidDelete(() => tree.refresh()));
  }
  ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('csim')) { tree.refresh(); }
  }));
}

export function deactivate(): void { /* nothing */ }

/** Commands get a Uri (explorer/editor), a ScenarioNode (our tree), or nothing (palette). */
function toUri(arg: unknown): vscode.Uri | undefined {
  if (arg instanceof vscode.Uri) { return arg; }
  if (arg && typeof arg === 'object' && 'uri' in arg) { return (arg as ScenarioNode).uri; }
  return vscode.window.activeTextEditor?.document.uri;
}

async function pickFile(base: string | undefined, glob: string, title: string): Promise<vscode.Uri | undefined> {
  if (!base) { vscode.window.showErrorMessage('Folder not found. Check the csim.assetsPath and csim.clarkesimPath settings.'); return; }
  const exclude = settings().get<boolean>('showArchive', false) ? '**/_docs/**' : '{**/archive/**,**/_docs/**}';
  const files = await vscode.workspace.findFiles(new vscode.RelativePattern(base, glob), exclude);
  const items = files
    .map(u => ({ label: path.basename(u.fsPath), description: path.relative(base, path.dirname(u.fsPath)), uri: u }))
    .sort((a, b) => (a.description + a.label).localeCompare(b.description + b.label));
  return (await vscode.window.showQuickPick(items, { title, matchOnDescription: true }))?.uri;
}
