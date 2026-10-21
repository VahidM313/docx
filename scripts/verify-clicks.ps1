$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI5 { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class WC {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI5[] inputs, int size);
}
'@ -ErrorAction SilentlyContinue
function Go($x, $y, $ms = 1400) { [WC]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds $ms }
function Click($x, $y) {
  [WC]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds 800
  $down = New-Object MI5; $down.dwFlags = 2
  $up = New-Object MI5; $up.dwFlags = 4
  [WC]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
  [WC]::SendInput(1, @($up), 28) | Out-Null
  Start-Sleep -Milliseconds 900
}
function Snap($f) { bun scripts/cdp-hover.ts 9223 9999,9999 200 $f | Out-Null }
function Dlg { bun scripts/cdp-eval.ts 9223 "document.querySelectorAll('[role=dialog]').length" }

cmd /c "taskkill /F /IM Docx.exe 2>nul"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9223"
Start-Process "C:\Users\vahid\OneDrive\Desktop\Docx.exe"
Start-Sleep -Seconds 7
bun scripts/cdp-reset-pins.ts 9223; bun scripts/cdp-reset-flags.ts 9223
# wait for the hub to actually mount (splash gone)
$cnt = 0
for ($i = 0; $i -lt 40; $i++) {
  $n = bun scripts/cdp-eval.ts 9223 "document.querySelectorAll('button').length" | Out-String
  if ($n -match '"value":\s*(\d+)') { $cnt = [int]$Matches[1] }
  if ($cnt -gt 6) { break }
  Start-Sleep -Milliseconds 500
}
Write-Host "hub buttons: $cnt"

Write-Host "=== 1. hover rail -> pe of overlay ==="
Go 20 400
bun scripts/cdp-eval.ts 9223 --file _overlay-dump.js
Write-Host "=== 2. real click Bookmarks row (css 80,98) ==="
Click 80 98
Snap v1-bookmarks.png; "dialogs: $(Dlg)"
bun scripts/cdp-close-dialogs.ts 9223

Write-Host "=== 3. real click All documentation row (css 80,834) ==="
Go 20 400; Start-Sleep -Milliseconds 300
Click 80 834
Snap v2-drawer.png; "dialogs: $(Dlg)"
bun scripts/cdp-close-dialogs.ts 9223

Write-Host "=== 4. topbar hover + real click pin (css 1328,21) ==="
Go 700 3
bun scripts/cdp-eval.ts 9223 --file _pins-read.js
Click 1328 21
Snap v3-pin.png
bun scripts/cdp-eval.ts 9223 --file _pins-read.js
Write-Host "=== 5. unpin again ==="
Click 1328 21
bun scripts/cdp-eval.ts 9223 --file _pins-read.js
Go 700 500
