import path = require('path')
import * as vscode from 'vscode'
import { downloadGiGen } from './bin-download'
import { getGiGenBinPath, getWorkspaceDir, pathExists, shellExec } from './utils'

type OverwriteAnswer = 'Overwrite' | 'Append' | 'Skip'

export async function main(context: vscode.ExtensionContext) {
  console.log('Start')

  const useDiscoveryAnswer = await getUseAutoDiscoveryAnswer()
  let langs: string[] = []
  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Finding languages...' },
    async () => {
      langs = useDiscoveryAnswer
        ? await getDetectedLanguages(context)
        : await getAllLanguages(context)
    },
  )
  const selectedLangs = await getSelectedLanguages(langs)
  const shouldClean = await getShouldCleanAnswer()
  const overwriteAnswer: OverwriteAnswer = await getOverwriteAnswer()

  console.log('Detected:', langs)
  console.log('Open QuickPick')

  if (overwriteAnswer === 'Skip') {
    vscode.window.showInformationMessage('A .gitignore file already exists, skipped')
    return
  }
  let out!: string
  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Generating .gitignore file...' },
    async () => {
      out = await runGiGen(
        context,
        selectedLangs!.map((i) => i.label),
        { cleanup: shouldClean, overwrite: overwriteAnswer, autoDiscovery: useDiscoveryAnswer },
      )
    },
  )

  console.log('Output:', out)

  vscode.window.showInformationMessage(
    'A .gitignore file was generated at the root of this project',
  )
}

async function getSelectedLanguages(langs: string[]) {
  const items = langs.map((l) => ({ label: l }))
  const selectedLangs =
    langs.length > 1
      ? await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: 'Select language(s) to use in .gitignore output',
        })
      : items
  return selectedLangs
}

async function getShouldCleanAnswer() {
  return (
    (
      await vscode.window.showQuickPick([{ label: 'Yes' }, { label: 'No' }], {
        placeHolder: 'Remove unused patterns from .gitignore output?',
      })
    )?.label === 'Yes'
  )
}

async function getUseAutoDiscoveryAnswer() {
  return (
    (
      await vscode.window.showQuickPick([{ label: 'Automatically' }, { label: 'Manually' }], {
        placeHolder: 'Discover project languages automatically?',
      })
    )?.label === 'Automatically'
  )
}

async function getOverwriteAnswer() {
  let overwriteAnswer: OverwriteAnswer = 'Overwrite'
  if (await pathExists(path.join(getWorkspaceDir()!.fsPath, '.gitignore'))) {
    overwriteAnswer =
      (
        await vscode.window.showQuickPick<{
          label: OverwriteAnswer
        }>([{ label: 'Overwrite' }, { label: 'Append' }, { label: 'Skip' }], {
          placeHolder: 'The file .gitignore already exists om the project, choose:',
        })
      )?.label ?? 'Skip'
  }
  return overwriteAnswer
}

function runGiGen(
  context: vscode.ExtensionContext,
  languages: string[],
  {
    cleanup,
    overwrite,
    autoDiscovery,
  }: { cleanup: boolean; overwrite: OverwriteAnswer; autoDiscovery: boolean },
): Promise<string> {
  const args: string[] = [
    ...(languages.length ? ['-l', languages.join(',')] : ['-d']),
    cleanup ? '-c' : '-k',
    overwrite === 'Overwrite' ? '-w' : '-a',
  ].filter(Boolean) as string[]

  return shellExec(getGiGenBinPath(context), args)
}

async function getDetectedLanguages(context: vscode.ExtensionContext): Promise<string[]> {
  const res = await shellExec(getGiGenBinPath(context), ['-detect-languages'])
  return res.split('\n').filter(Boolean)
}

async function getAllLanguages(context: vscode.ExtensionContext): Promise<string[]> {
  const res = await shellExec(getGiGenBinPath(context), ['-all-languages'])
  return res.split('\n').filter(Boolean)
}
