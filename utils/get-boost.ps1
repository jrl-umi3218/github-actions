# Use the boost_1_77_0-msvc-14.1-64.exe for Windows 2016
function DownloadFileWithRetry
{
  param(
    [Parameter(Mandatory = $true)]
    $Url,
    [Parameter(Mandatory = $true)]
    $Out,
    [ValidateNotNullOrEmpty()]
    $MaxTry=10
  )
  $Try = 1
  while($Try -le $MaxTry)
  {
    if($Try -ne 1)
    {
      Write-Host "Download failed, try $Try out of $MaxTry"
    }
    try
    {
      (New-Object System.Net.WebClient).DownloadFile($Url, $Out)
      break
    }
    catch
    {
      if(Test-Path $Out)
      {
        Remove-Item $Out
      }
      $Try++
    }
  }
  if(Test-Path $Out)
  {
    Write-Host "Download succeeded after $Try tries"
    Get-FileHash $Out | Format-List
  }
}
$Url = "https://sourceforge.net/projects/boost/files/boost-binaries/1.77.0/boost_1_77_0-msvc-14.2-64.exe"
$Out = "$env:TEMP\boost.exe"
DownloadFileWithRetry -Url "$Url" -Out "$Out"
Start-Process -Wait -FilePath "$Out" "/SILENT","/SP-","/SUPPRESSMSGBOXES","/DIR=C:\hostedtoolcache\windows\Boost\1.77.0\x86_64"
