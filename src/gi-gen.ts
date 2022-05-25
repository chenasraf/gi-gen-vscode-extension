import path = require('path')
import * as vscode from 'vscode'
import { downloadGiGen } from './bin-download'
import { getGiGenBinPath, getWorkspaceDir, pathExists, shellExec } from './utils'

type OverwriteAnswer = 'Overwrite' | 'Append' | 'Skip'

export async function main(context: vscode.ExtensionContext) {
  console.log('Start')

  await downloadGiGen(context)

  const useDiscoveryAnswer = await getUseAutoDiscoveryAnswer()
  if (useDiscoveryAnswer === undefined) {
    return cancel()
  }
  let langs: string[] = []
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Finding languages...' },
    async () => {
      langs = useDiscoveryAnswer
        ? await getDiscoveredLanguages(context)
        : await getAllLanguages(context)
    },
  )
  if (useDiscoveryAnswer && langs.length === 1) {
    vscode.window.showInformationMessage(`Discovered language: ${langs[0]}`)
  }
  console.log('Detected:', langs)

  const selectedLangs = await getSelectedLanguages(langs)
  if (!selectedLangs) {
    return cancel()
  }
  console.log('Selected:', selectedLangs)

  const shouldClean = await getShouldCleanAnswer()
  if (shouldClean === undefined) {
    return cancel()
  }
  const overwriteAnswer = await getOverwriteAnswer()
  if (overwriteAnswer === undefined) {
    return cancel()
  }

  if (overwriteAnswer === 'Skip') {
    vscode.window.showInformationMessage('A .gitignore file already exists, skipped')
    return
  }

  let out!: string
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Generating .gitignore file...' },
    async () => {
      out = await runGiGenMain(context, selectedLangs, {
        cleanup: shouldClean,
        overwrite: overwriteAnswer,
        autoDiscovery: useDiscoveryAnswer,
      })
    },
  )

  console.log('Output:', out)

  vscode.window.showInformationMessage(
    'A .gitignore file was generated at the root of this project',
  )
}

async function getSelectedLanguages(langs: string[]): Promise<string[] | undefined> {
  const items = langs.map((l) => ({ label: l }))
  const selectedLangs =
    langs.length > 1
      ? await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: 'Select language(s) to use in .gitignore output',
        })
      : items
  return selectedLangs?.map((i) => i.label)
}

async function getShouldCleanAnswer(): Promise<boolean | undefined> {
  const answer = await vscode.window.showQuickPick([{ label: 'Yes' }, { label: 'No' }], {
    placeHolder: 'Remove unused patterns from .gitignore output?',
  })
  if (!answer) {
    return undefined
  }
  return answer?.label === 'Yes'
}

async function getUseAutoDiscoveryAnswer(): Promise<boolean | undefined> {
  const answer = await vscode.window.showQuickPick(
    [{ label: 'Automatically' }, { label: 'Manually' }],
    {
      placeHolder: 'Discover project languages automatically?',
    },
  )
  if (!answer) {
    return undefined
  }
  return answer?.label === 'Automatically'
}

async function getOverwriteAnswer(): Promise<OverwriteAnswer | undefined> {
  let overwriteAnswer: { label: OverwriteAnswer } | undefined
  if (await pathExists(path.join(getWorkspaceDir()!.fsPath, '.gitignore'))) {
    overwriteAnswer = await vscode.window.showQuickPick<{
      label: OverwriteAnswer
    }>([{ label: 'Overwrite' }, { label: 'Append' }, { label: 'Skip' }], {
      placeHolder: 'The file .gitignore already exists om the project, choose:',
    })
    if (!overwriteAnswer) {
      return undefined
    }
    return overwriteAnswer.label
  }
  return 'Overwrite'
}

function runGiGenMain(
  context: vscode.ExtensionContext,
  languages: string[],
  { cleanup, overwrite }: { cleanup: boolean; overwrite: OverwriteAnswer; autoDiscovery: boolean },
): Promise<string> {
  const args: string[] = [
    ...(languages.length ? ['-l', languages.join(',')] : ['-d']),
    cleanup ? '-c' : '-k',
    overwrite === 'Overwrite' ? '-w' : '-a',
  ].filter(Boolean) as string[]

  return runGiGen(context, args)
}

function runGiGen(context: vscode.ExtensionContext, args: string[]): Promise<string> {
  return shellExec(getGiGenBinPath(context), args)
}

async function getDiscoveredLanguages(context: vscode.ExtensionContext): Promise<string[]> {
  const res = await shellExec(getGiGenBinPath(context), ['-detect-languages'])
  return res.split('\n').filter(Boolean)
}

async function getAllLanguages(context: vscode.ExtensionContext): Promise<string[]> {
  const res = await shellExec(getGiGenBinPath(context), ['-all-languages'])
  return res.split('\n').filter(Boolean)
}
function cancel() {
  // vscode.window.showInformationMessage("Canceled by user")
  console.log('Canceled by user')
}
