import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { clarkesimPath, configsDir, knownAircraft, settings, simulatorPath, workspaceRoot } from './config';

export const output = vscode.window.createOutputChannel('Clarkesim');

/**
 * Work out which aircraft build a config belongs to:
 *   1. <Clarkesim>/config/<aircraft>/x.yaml  -> <aircraft>
 *   2. filename prefix, e.g. lincoln_silsim_reference.yaml -> lincoln
 *   3. ask the user
 */
export async function resolveAircraft(configPath: string): Promise<string | undefined> {
  const known = knownAircraft();
  const lower = known.map(k => k.toLowerCase());

  const dir = configsDir();
  if (dir) {
    const parts = path.relative(dir, configPath).split(path.sep);
    if (parts.length > 1 && parts[0] !== '..' && lower.includes(parts[0].toLowerCase())) {
      return parts[0];
    }
  }
  const parent = path.basename(path.dirname(configPath)).toLowerCase();
  if (lower.includes(parent)) { return known[lower.indexOf(parent)]; }

  const prefix = path.basename(configPath).split('_')[0].toLowerCase();
  if (lower.includes(prefix)) { return known[lower.indexOf(prefix)]; }

  return vscode.window.showQuickPick(known, {
    title: `Which aircraft build should run ${path.basename(configPath)}?`,
    placeHolder: 'Aircraft',
  });
}

/** Launch Simulator with a config. `displayName` is used for the task/terminal name. */
export async function runConfig(configPath: string, displayName?: string, aircraftHint?: string): Promise<void> {
  const aircraft = aircraftHint ?? await resolveAircraft(configPath);
  if (!aircraft) { return; }

  const sim = simulatorPath(aircraft);
  const cwd = clarkesimPath();
  if (!sim.exists) {
    const pick = await vscode.window.showErrorMessage(
      `Simulator for "${aircraft}" not found at ${sim.path}. Build that aircraft in Clarkesim first, or fix the csim.simulatorPath setting.`,
      'Open Settings', 'Run Anyway');
    if (pick === 'Open Settings') { await vscode.commands.executeCommand('csim.openSettings'); return; }
    if (pick !== 'Run Anyway') { return; }
  }
  if (!fs.existsSync(cwd)) {
    vscode.window.showErrorMessage(`Clarkesim folder not found: ${cwd}. Set csim.clarkesimPath.`);
    return;
  }

  const args = ['-c', configPath, ...settings().get<string[]>('extraArgs', [])];
  const name = displayName ?? path.basename(configPath);
  output.appendLine(`[${new Date().toLocaleTimeString()}] ${name}: (cwd ${cwd}) ${sim.path} ${args.join(' ')}`);

  const task = new vscode.Task(
    { type: 'csim', config: configPath, aircraft },
    workspaceRoot() ?? vscode.TaskScope.Workspace,
    name,
    'csim',
    new vscode.ProcessExecution(sim.path, args, { cwd }),
    [],
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: true,
  };
  await vscode.tasks.executeTask(task);
}

/**
 * Write a copy of `configPath` with `run_stc:` pointed at `stfPath`, then run it.
 * Relative paths inside the YAML resolve against the Clarkesim cwd, not the YAML's
 * location, so moving the copy to storage doesn't break them.
 */
export async function runConfigWithStf(ctx: vscode.ExtensionContext, configPath: string, stfPath: string): Promise<void> {
  const text = await fs.promises.readFile(configPath, 'utf8');
  const re = /^(\s*)run_stc:.*$/m;   // only uncommented keys (comment lines start with '#')
  if (!re.test(text)) {
    vscode.window.showErrorMessage(`${path.basename(configPath)} has no run_stc entry, so an STF can't be injected.`);
    return;
  }
  const stf = stfPath.replace(/\\/g, '/');
  const patched = text.replace(re, `$1run_stc: "${stf}"`);

  const runsDir = path.join(ctx.globalStorageUri.fsPath, 'runs');
  await fs.promises.mkdir(runsDir, { recursive: true });
  const base = `${path.parse(configPath).name}__${path.parse(stfPath).name}`;
  const tmp = path.join(runsDir, `${base}.yaml`);
  await fs.promises.writeFile(tmp, patched, 'utf8');

  const aircraft = await resolveAircraft(configPath);   // resolve from the original location
  if (!aircraft) { return; }
  await runConfig(tmp, `${path.basename(configPath)} + ${path.basename(stfPath)}`, aircraft);
}

/** Report exit codes for our tasks. */
export function watchTaskExits(): vscode.Disposable {
  return vscode.tasks.onDidEndTaskProcess(e => {
    if (e.execution.task.definition.type !== 'csim') { return; }
    const name = e.execution.task.name;
    output.appendLine(`[${new Date().toLocaleTimeString()}] ${name}: exited with code ${e.exitCode}`);
    if (e.exitCode === 0) {
      vscode.window.showInformationMessage(`Clarkesim run "${name}" finished.`);
    } else if (e.exitCode !== undefined) {
      vscode.window.showWarningMessage(`Clarkesim run "${name}" exited with code ${e.exitCode}.`, 'Show Log')
        .then(p => { if (p) { output.show(); } });
    }
  });
}
