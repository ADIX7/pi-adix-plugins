# Pi Adix Plugins

Three independently installable Pi extensions:

| Package | Purpose |
| --- | --- |
| [`@adix7/jj-powerbar`](packages/jj-powerbar) | Jujutsu and Git status |
| [`@adix7/pi-plan-custom`](packages/pi-plan-custom) | Relaxed and strict planning modes |
| [`@adix7/powerbar-context-extra`](packages/powerbar-context-extra) | Context usage in Powerbar |

Install with `pi install npm:<package-name>`. See each package for its setup and Powerbar segment ID. If using Powerbar, install `@juanibiapina/pi-extension-settings` first and `@juanibiapina/pi-powerbar` second, before the packages above.

## Development

Tested with Pi 1.6 and Node 24. No build step: Pi loads the TypeScript entry points directly.

```sh
npm ci
npm test
npm pack --workspaces --dry-run
```

Use `pi install /absolute/path/to/pi-adix-plugins/packages/<directory>` to load a package from a checkout. Publish packages individually with `npm publish --workspace @adix7/<package> --access public` after testing and bumping their versions.
