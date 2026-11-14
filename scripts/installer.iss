[Setup]
AppId=Perifericos.Tarve
AppName=Periféricos
AppVersion={#Version}
AppVerName=Periféricos
AppPublisher=Periféricos
AppPublisherURL=https://github.com/omarcosr/perifericos
DefaultDirName={localappdata}\Programs\Perifericos
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
UninstallDisplayIcon={app}\Perifericos.exe
UninstallDisplayName=Periféricos
SetupIconFile={#AppIcon}
OutputBaseFilename=Perifericos-Setup-{#Version}-win32-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
RestartApplications=no

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
ptbr.Launch=Abrir Periféricos
en.Launch=Open Periféricos
ptbr.StopFailed=Feche o Periféricos pelo menu da bandeja e tente novamente.
en.StopFailed=Close Periféricos from the system tray and try again.
ptbr.StartupFailed=Abra Configurações no Periféricos para conferir a inicialização com o Windows.
en.StartupFailed=Open Settings in Periféricos to check Windows startup.
ptbr.RemoveStartupFailed=Desative Iniciar com o Windows em Configurações no Periféricos e tente novamente.
en.RemoveStartupFailed=Turn off Launch at Windows startup in Periféricos Settings, then try again.

[Files]
Source: "{#AppExe}"; DestDir: "{app}"; DestName: "Perifericos.exe"

[Icons]
Name: "{userprograms}\Periféricos"; Filename: "{app}\Perifericos.exe"; WorkingDir: "{app}"; AppUserModelID: "Perifericos.Tarve"

[InstallDelete]
Type: files; Name: "{userprograms}\Periféricos Tarve.lnk"

[Run]
Filename: "{app}\Perifericos.exe"; Description: "{cm:Launch}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: files; Name: "{app}\Perifericos.exe.old"

[Code]
function RunApp(const FileName, Arguments: String): Boolean;
var
  ExitCode: Integer;
begin
  Result := Exec(FileName, Arguments, '', SW_HIDE, ewWaitUntilTerminated, ExitCode) and (ExitCode = 0);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  ExtractTemporaryFile('Perifericos.exe');
  if not RunApp(ExpandConstant('{tmp}\Perifericos.exe'), '--stop --wait') then
    Result := ExpandConstant('{cm:StopFailed}');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    if not RunApp(ExpandConstant('{app}\Perifericos.exe'), '--migrate-startup') then
      SuppressibleMsgBox(ExpandConstant('{cm:StartupFailed}'), mbError, MB_OK, IDOK);
end;

function InitializeUninstall(): Boolean;
var
  AppExe: String;
begin
  AppExe := ExpandConstant('{app}\Perifericos.exe');
  Result := True;
  if not FileExists(AppExe) then
  begin
    if FileExists(ExpandConstant('{app}\Perifericos.exe.old')) then begin
      Result := RunApp(ExpandConstant('{app}\Perifericos.exe.old'), '--remove-startup "--startup-target=' + AppExe + '"');
      if not Result then
        SuppressibleMsgBox(ExpandConstant('{cm:RemoveStartupFailed}'), mbError, MB_OK, IDOK);
    end;
    Exit;
  end;
  Result := RunApp(AppExe, '--stop --wait');
  if not Result then
  begin
    SuppressibleMsgBox(ExpandConstant('{cm:StopFailed}'), mbError, MB_OK, IDOK);
    Exit;
  end;
  Result := RunApp(AppExe, '--remove-startup');
  if not Result then
    SuppressibleMsgBox(ExpandConstant('{cm:RemoveStartupFailed}'), mbError, MB_OK, IDOK);
end;
