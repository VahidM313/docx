# Real-cursor CLICK verification of hidden chrome.
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
}'
function Go($x, $y, $ms = 950) { [W]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds $ms }
function Click($x, $y) { Go $x $y 600; [W]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [W]::mouse_event(4,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 700 }
function Shot($f) { bun scripts/cdp-hover.ts 9223 9999,9999 200 $f | Out-Null; Write-Host "-> $f" }
function TitleT { bun scripts/title.ts 9223 }

# 1 idle hub — icon rail should be visible now
Go 700 500; Shot m1-idle.png
# 2 hover rail -> labelled sidebar panel
Go 20 400; Shot m2-rail-hover.png
# 3 real click "All documentation" row (bottom of the overlay menu)
Click 70 832; Shot m3-drawer.png
# close drawer via DOM
bun scripts/cdp-close-dialogs.ts 9223
# 4 Bookmarks row click
Click 70 104; Shot m4-bookmarks.png
bun scripts/cdp-close-dialogs.ts 9223
Write-Host "title: $(TitleT)"
