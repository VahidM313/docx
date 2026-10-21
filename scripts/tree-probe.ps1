Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public struct RC2 { public int L; public int T; public int R; public int B; }
public class Dump {
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC2 r);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  static uint target;
  public static void DumpTree(IntPtr top) {
    var sb = new StringBuilder(128); GetWindowText(top, sb, 128);
    var cn = new StringBuilder(128); GetClassName(top, cn, 128);
    var r = new RC2(); GetWindowRect(top, out r);
    Console.WriteLine(string.Format("TOP {0} '{1}' class={2} rect=({3},{4})-({5},{6})", top, sb, cn, r.L, r.T, r.R, r.B));
    EnumChildWindows(top, delegate(IntPtr h, IntPtr l) {
      var s2 = new StringBuilder(128); GetClassName(h, s2, 128);
      var r2 = new RC2(); GetWindowRect(h, out r2);
      Console.WriteLine(string.Format("  child {0} class={1} rect=({2},{3})-({4},{5})", h, s2, r2.L, r2.T, r2.R, r2.B));
      return true;
    }, IntPtr.Zero);
  }
  public static void Find() {
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == target) DumpTree(h);
      return true;
    }, IntPtr.Zero);
  }
  public static void SetTarget(uint t) { target = t; }
}
'@
[Dump]::SetTarget([uint32](Get-Process Docx).Id)
[Dump]::Find()
