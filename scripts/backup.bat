@echo off
REM ============================================================================
REM Lance la sauvegarde automatique de la base TinOR.
REM À utiliser avec le Planificateur de tâches Windows (voir
REM README_SAUVEGARDE.md pour la configuration complète).
REM ============================================================================
cd /d "%~dp0.."
node scripts\backup.js >> backups\journal_sauvegarde.log 2>&1
