# Publishing (VS Marketplace + Open VSX)

Publisher: `dimy-osman`  
Extension: `kitchen-co-mcp`

Tokens are **not** in this repo. They are stored only on this machine at:

`%USERPROFILE%\.cursor\secrets\marketplace-pats.env`

Also in Windows Credential Manager as `cursor/vsce-pat` and `cursor/ovsx-pat`.

```powershell
# load secrets then publish
Get-Content "$env:USERPROFILE\.cursor\secrets\marketplace-pats.env" | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $k,$v = $_ -split '=',2
  Set-Item -Path "Env:$k" -Value $v
}
npx vsce publish -p $env:VSCE_PAT
npx ovsx publish -p $env:OVSX_PAT
Remove-Item Env:VSCE_PAT, Env:OVSX_PAT -ErrorAction SilentlyContinue
```

Live listings (after publish):

- https://marketplace.visualstudio.com/items?itemName=dimy-osman.kitchen-co-mcp
- https://open-vsx.org/extension/dimy-osman/kitchen-co-mcp
