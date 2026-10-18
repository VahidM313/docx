param([Parameter(Mandatory = $true)][string]$inputPath)
Add-Type -AssemblyName System.Drawing
$srcBmp = [System.Drawing.Bitmap]::new($inputPath)
$w = $srcBmp.Width
$h = $srcBmp.Height
Write-Output "Source image: ${w}x${h}"

# Find tight bounding box of foreground pixels (lum > 24)
$minX = $w
$minY = $h
$maxX = 0
$maxY = 0

$cleanBmp = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$blackPoint = 22.0
$whitePoint = 235.0
$range = $whitePoint - $blackPoint

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $c = $srcBmp.GetPixel($x, $y)
        $lum = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B
        if ($lum -le $blackPoint) {
            $cleanBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            $norm = ($lum - $blackPoint) / $range
            if ($norm -gt 1.0) { $norm = 1.0 }
            $alpha = [int][Math]::Round($norm * 255.0)
            $cleanBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
            if ($alpha -gt 15) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
}

$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1
Write-Output "Bounding box: ($minX, $minY) to ($maxX, $maxY) -> ${cropW}x${cropH}"

function Save-ResizedPng([int]$size, [string]$outPath, [double]$padRatio = 0.08) {
    $outBmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($outBmp)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $pad = [int][Math]::Round($size * $padRatio)
    $avail = $size - ($pad * 2)
    $srcRect = [System.Drawing.Rectangle]::new($minX, $minY, $cropW, $cropH)
    $dstRect = [System.Drawing.Rectangle]::new($pad, $pad, $avail, $avail)
    $g.DrawImage($cleanBmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()

    $outBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $outBmp.Dispose()
}

$iconsDir = "d:\Dev\crawl\docs-desktop\src-tauri\icons"
$publicDir = "d:\Dev\crawl\docs-desktop\public"

Save-ResizedPng 512 (Join-Path $publicDir "logo.png") 0.06
Save-ResizedPng 512 (Join-Path $iconsDir "icon.png") 0.06
Save-ResizedPng 256 (Join-Path $iconsDir "128x128@2x.png") 0.06
Save-ResizedPng 128 (Join-Path $iconsDir "128x128.png") 0.06
Save-ResizedPng 32  (Join-Path $iconsDir "32x32.png") 0.04

# Build multi-resolution Windows .ico (256, 64, 48, 32, 16) with PNG frames
$icoSizes = @(256, 64, 48, 32, 16)
$pngBuffers = @()
foreach ($sz in $icoSizes) {
    $tmpPath = Join-Path $iconsDir "tmp_${sz}.png"
    Save-ResizedPng $sz $tmpPath 0.04
    $pngBuffers += ,([System.IO.File]::ReadAllBytes($tmpPath))
    Remove-Item $tmpPath -Force
}

$icoPath = Join-Path $iconsDir "icon.ico"
$ms = [System.IO.MemoryStream]::new()
$bw = [System.IO.BinaryWriter]::new($ms)

# ICONDIR header (6 bytes)
$bw.Write([uint16]0) # reserved
$bw.Write([uint16]1) # type = 1 (ICO)
$bw.Write([uint16]$icoSizes.Count)

$dataOffset = 6 + (16 * $icoSizes.Count)
for ($i = 0; $i -lt $icoSizes.Count; $i++) {
    $sz = $icoSizes[$i]
    $buf = $pngBuffers[$i]
    $dimByte = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $bw.Write($dimByte)          # width
    $bw.Write($dimByte)          # height
    $bw.Write([byte]0)           # color count
    $bw.Write([byte]0)           # reserved
    $bw.Write([uint16]1)         # color planes
    $bw.Write([uint16]32)        # bits per pixel
    $bw.Write([uint32]$buf.Length)
    $bw.Write([uint32]$dataOffset)
    $dataOffset += $buf.Length
}

for ($i = 0; $i -lt $icoSizes.Count; $i++) {
    $bw.Write($pngBuffers[$i])
}

$bw.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bw.Dispose()
$ms.Dispose()
$cleanBmp.Dispose()
$srcBmp.Dispose()

Write-Output "Generated transparent icons and multi-res icon.ico successfully!"
