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
      using (WebClient wc = new WebClient())
      {
          wc.Headers.Add("User-Agent: Other"); 
          wc.DownloadFile($Url, $Out);
      }
      break
    }
    catch
    {
      Write-Output $_
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
$Url = "https://sourceforge.net/projects/boost/files/boost-binaries/1.83.0/boost_1_83_0-msvc-14.3-64.exe"
$Out = "$env:TEMP\boost.exe"
echo "$Out" 
DownloadFileWithRetry -Url "$Url" -Out "$Out"
Start-Process -Wait -FilePath "$Out" -ArgumentList "/SILENT", "/SP-", "/SUPPRESSMSGBOXES", "/DIR=C:\hostedtoolcache\windows\Boost\1.83.0\x86_64"
