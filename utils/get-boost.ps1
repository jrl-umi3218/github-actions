# Use the boost_1_77_0-msvc-14.1-64.exe for Windows 2016
$Url = "https://sourceforge.net/projects/boost/files/boost-binaries/1.77.0/boost_1_77_0-msvc-14.2-64.exe"
(New-Object System.Net.WebClient).DownloadFile($Url, "$env:TEMP\boost.exe")
Start-Process -Wait -FilePath "$env:TEMP\boost.exe" "/SILENT","/SP-","/SUPPRESSMSGBOXES","/DIR=C:\hostedtoolcache\windows\Boost\1.77.0\x86_64"
