# Pi Plan Custom

```sh
pi install npm:@adix7/pi-plan-custom
```

- `/plan` toggles relaxed planning mode; `/plan-strict` toggles the planning tool allowlist.
- Start Pi in either mode with `--plan` or `--plan-strict`.
- Install `npm:@juanibiapina/pi-extension-settings` before this package to configure a shortcut via `/extension-settings` → Plan.
- Optional: install `npm:@juanibiapina/pi-powerbar` before this package and enable the `plan-mode` segment.

Plan mode is not a sandbox. Bash remains available; the read-only shell restriction is an instruction to the model, not an OS-level restriction.
