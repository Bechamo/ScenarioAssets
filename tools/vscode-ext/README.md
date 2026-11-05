# Clarkesim Scenarios (VS Code extension)

Browse the configs, STF tests and missions in `assets/`, and launch Clarkesim's `Simulator` with them.

## Develop

Requires Node.js 18+.

```powershell
cd tools/vscode-ext
npm install
code .          # then press F5
```

F5 compiles the extension and opens an Extension Development Host on the ScenerioAssets folder (`../..`).

## Features

- **Clarkesim** activity-bar view with three groups: Configs (by aircraft), STF tests, and Missions. Click a file to open it.
- **▶ Run in Clarkesim** on a config (in the tree, the Explorer right-click menu, or the editor title bar) runs
  `<simulatorPath> -c <config.yaml>` with the Clarkesim repo as the working directory, in a dedicated terminal.
- **Run with STF…** on a config, or **Run this STF with config…** on an `.stf` file, writes a copy of the YAML with
  `run_stc:` pointing at the chosen STF (to the extension's global storage) and runs that copy.
- The `Clarkesim` output channel logs each command line and exit code.

The aircraft is taken from the folder (`assets/yamls/<aircraft>/…`), then from the filename prefix
(`lincoln_…`). If neither matches, you're asked to pick one.

## Settings

| Setting | Default | Notes |
|---|---|---|
| `csim.clarkesimPath` | *(empty → `../Clarkesim`)* | Clarkesim repo; used as the run's working directory |
| `csim.simulatorPath` | `${clarkesimPath}/_build/${aircraft}/src/Simulator` | `.exe` is tried automatically on Windows |
| `csim.extraArgs` | `[]` | Appended after `-c <config>` |
| `csim.assetsPath` | `assets` | Relative to the workspace folder |
| `csim.showArchive` | `false` | Show `yamls/archive` |

## Package

```powershell
npm run package   # produces csim-scenarios-0.0.1.vsix
```

Install it with **Extensions → … → Install from VSIX…**.
