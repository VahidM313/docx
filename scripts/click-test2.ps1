$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class W7 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI[] inputs, int size);
}
'@
function Go($x, $y, $ms = 850) { [W7]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds $ms }
function Click($x, $y) {
  Go $x $y
  $down = New-Object MI; $down.dwFlags = 2
  $up = New-Object MI; $up.dwFlags = 4
  [W7]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 140
  [W7]::SendInput(1, @($up), 28) | Out-Null
  Start-Sleep -Milliseconds 800
}
# back to hub via rail Home icon (phys 37,45)
Click 37 45
Start-Sleep -Milliseconds 800

bun scripts/cdp-eval.ts 9223 "localStorage.setItem('docx_ui_pins_v1','{\"topbar\":false,\"sidebar\":false,\"tabs\":false}');location.reload();'reset'"
Start-Sleep -Seconds 5

function Dlg { bun scripts/cdp-eval.ts 9223 "document.querySelectorAll('[role=\"dialog\"]').length" }
function Snap($f) { bun scripts/cdp-hover.ts 9223 9999,9999 250 $f | Out-Null; Write-Host "-> $f" }

# A) hover rail -> real click "All documentation"
Go 20 400; Snap m1-panel.png
Click 70 832; Snap m2-drawer.png; "dialogs: $(Dlg)"
bun scripts/cdp-close-dialogs.ts 9223

# B) hover rail -> real click Bookmarks
Go 20 400; Start-Sleep -Milliseconds 400
Click 70 104; Snap m3-bookmarks.png; "dialogs: $(Dlg)"
bun scripts/cdp-close-dialogs.ts 9223

# C) topbar: hover top edge, real click the PIN button
Go 700 3; Snap m4-topbar-open.png
Click 1328 21; Snap m5-topbar-pinned.png
bun scripts/cdp-eval.ts 9223 "localStorage.getItem('docx_ui_pins_v1')"

# D) unpin again
Click 1328 21; bun scripts/cdp-eval.ts 9223 "localStorage.getItem('docx_ui_pins_v1')"

# E) gear menu: click gear, then move DOWN into the portal menu and screenshot
Go 700 3; Start-Sleep -Milliseconds 300
Click 1306 21; Snap m6-gear-menu.png
Go 1290 160; Snap m7-gear-into-menu.png
Click 900 500
bun scripts/cdp-eval.ts 9223 "localStorage.setItem('docx_ui_pins_v1','{\"topbar\":false,\"sidebar\":false,\"tabs\":false}');'pins reset'"
