$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$publicDirectory = Join-Path $PSScriptRoot '..\public'
$sourcePath = Join-Path $publicDirectory 'logo-proman.png'
$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)

try {
  foreach ($size in @(192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#f5f3ff'))
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

      # Keep the mark inside Android's maskable-icon safe zone.
      $maximumWidth = [Math]::Floor($size * 0.68)
      $maximumHeight = [Math]::Floor($size * 0.68)
      $scale = [Math]::Min(
        $maximumWidth / $sourceImage.Width,
        $maximumHeight / $sourceImage.Height
      )
      $width = [Math]::Floor($sourceImage.Width * $scale)
      $height = [Math]::Floor($sourceImage.Height * $scale)
      $left = [Math]::Floor(($size - $width) / 2)
      $top = [Math]::Floor(($size - $height) / 2)

      $graphics.DrawImage($sourceImage, $left, $top, $width, $height)
      $targetPath = Join-Path $publicDirectory "pwa-icon-$size.png"
      $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
} finally {
  $sourceImage.Dispose()
}
