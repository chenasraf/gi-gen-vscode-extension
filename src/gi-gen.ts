import * as vscode from 'vscode'
import * as cp from 'child_process'
import * as fs from 'fs/promises'
import { F_OK } from 'constants'

type OverwriteAnswer = 'Overwrite' | 'Append' | 'Skip'

export async function main() {
  console.log('Start')

  const langs = await getDetectedLanguages()

  console.log('Detected:', langs)
  console.log('Open QuickPick')

  const selectedLangs = await getSelectedLanguages(langs)

  const shouldClean = await getShouldCleanAnswer()
  let overwriteAnswer: OverwriteAnswer = await getOverwriteAnswer()
  if (overwriteAnswer === 'Skip') {
    vscode.window.showInformationMessage('A .gitignore file already exists, skipped')
    return
  }

  const out = await runGiGen(
    selectedLangs!.map((i) => i.label),
    shouldClean,
    overwriteAnswer,
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

async function getOverwriteAnswer() {
  let overwriteAnswer: OverwriteAnswer = 'Overwrite'
  if (await pathExists(getWorkspaceDir()!.fsPath)) {
    overwriteAnswer = (await vscode.window.showQuickPick<{
      label: OverwriteAnswer
    }>([{ label: 'Overwrite' }, { label: 'Append' }, { label: 'Skip' }], {
      placeHolder: 'The file .gitignore already exists om the project, choose:',
    }))!.label
  }
  return overwriteAnswer
}

function runGiGen(
  languages: string[],
  cleanup: boolean,
  overwriteAnswer: OverwriteAnswer,
): Promise<string> {
  const args: string[] = [
    languages.length ? '-l ' + languages.join(',') : '-d',
    cleanup ? '-c' : '-k',
    overwriteAnswer === 'Overwrite' ? '-w' : '-a',
  ].filter(Boolean) as string[]

  return shellExec('gi_gen', args)
}

async function getDetectedLanguages(): Promise<string[]> {
  const res = await shellExec('gi_gen', ['-detect-languages'])
  return res.split('\n').filter(Boolean)
}

function shellExec(cmd: string, args?: string[]): Promise<string> {
  const wd = getWorkspaceDir()
  const input = [cmd, ...(args ?? [])].join(' ')
  console.log('Executing', input, 'in', wd?.fsPath)
  return new Promise((resolve, reject) => {
    cp.exec(input, { cwd: wd!.fsPath }, (err, stdout, stderr) => {
      // console.log('stdout:', stdout)
      // console.log('stderr:', stderr)
      if (err) {
        reject(err)
        return
      }
      if (stderr) {
        reject(stderr)
        return
      }
      resolve(stdout)
    })
  })
}

function getWorkspaceDir() {
  return vscode.workspace.workspaceFolders?.[0].uri
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, F_OK)
    return true
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      return false
    }
    throw e
  }
}
