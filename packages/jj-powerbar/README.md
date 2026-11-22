# JJ Powerbar

Show the current Jujutsu change ID and closest bookmark in Pi, falling back to the Git branch or commit outside jj repos.

```sh
pi install npm:@adix7/jj-powerbar
```

For bookmark names, add this alias to your jj config (`jj config edit --user`):

```toml
[revset-aliases]
"closest_bookmark(to)" = "heads(::to & bookmarks())"
```

The extension sets Pi status directly. To also display it in Powerbar, install `npm:@juanibiapina/pi-extension-settings` and `npm:@juanibiapina/pi-powerbar` before this package, then enable `jj-powerbar` in `/extension-settings`.
