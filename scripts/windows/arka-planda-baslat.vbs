rem Full Follow sunucusunu pencere acmadan arka planda baslatir. Kayitlar: data\server.log
rem Bilgisayar acilinca calismasi icin: Win+R, shell:startup, bu dosyanin kisayolunu oraya koy.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
sh.Run "cmd /c node packages\server\dist\main.js >> data\server.log 2>&1", 0, False
