@echo off
rem CLI `bo` para cmd/PowerShell: usa o runtime do app se BO_NODE estiver definido, senão o Node.
setlocal
set ELECTRON_RUN_AS_NODE=1
if defined BO_NODE (
  "%BO_NODE%" "%~dp0bo.js" %*
) else (
  node "%~dp0bo.js" %*
)
