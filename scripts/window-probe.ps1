Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public struct PT { public int X; public int Y; }
public class W3 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(PT p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint f);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}'
$pts = @(@(302,568), @(87,1040), @(960,540))
foreach ($p in $pts) {
  $pt = New-Object PT; $pt.X = $p[0]; $pt.Y = $p[1]
  $h = [W3]::WindowFromPoint($pt)
  $root = [W3]::GetAncestor($h, 2)
  $sb = New-Object System.Text.StringBuilder 256
  [W3]::GetWindowText($root, $sb, 256) | Out-Null
  $pid2 = 0; [W3]::GetWindowThreadProcessId($root, [ref]$pid2) | Out-Null
  $proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
  "${p[0]},${p[1]} -> root='$($sb)' proc=$($proc.ProcessName) pid=$pid2"
}
"--- integrity levels ---"
whoami /groups | Select-String "S-1-16"
$docx = Get-Process Docx -ErrorAction SilentlyContinue
"docx pid: $($docx.Id) started: $($docx.StartTime)"
