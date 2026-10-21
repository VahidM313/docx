Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MOS { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class W6 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MOS[] inputs, int size);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string n);
}
'@
function Snap($path) {
  $b = New-Object System.Drawing.Bitmap 1920, 1080
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.CopyFromScreen(0, 0, 0, 0, $b.Size)
  $b.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $b.Dispose()
}
"before:"; Snap "_full-before.png"
[W6]::SetCursorPos(1540, 1076) | Out-Null   # taskbar area clock corner
Start-Sleep -Milliseconds 500
$down = New-Object MOS; $down.dwFlags = 2
$up = New-Object MOS; $up.dwFlags = 4
[W6]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
[W6]::SendInput(1, @($up), 28) | Out-Null
Start-Sleep -Milliseconds 900
"after taskbar click:"; Snap "_full-after.png"
# now click inside the app on the hub Open button
[W6]::SetCursorPos(302, 568) | Out-Null
Start-Sleep -Milliseconds 500
[W6]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
[W6]::SendInput(1, @($up), 28) | Out-Null
Start-Sleep -Milliseconds 1200
"after app click:"; Snap "_full-click.png"
