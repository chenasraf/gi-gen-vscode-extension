import * as vscode from 'vscode'
import * as http from 'https'
import * as fs from 'fs/promises'
import { downloadFile, getGiGenBinPath, getPlatform, pathExists } from './utils'
import path = require('path')

export function getLatestRemoteVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('Getting gi_gen latest version...')
    http.get(
      'https://api.github.com/repos/chenasraf/gi_gen/tags',
      {
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'User-Agent': 'Gi-Gen-Downloader',
        },
      },
      (response) => {
        let data = ''
        response.on('data', (chunk) => {
          data += chunk
        })
        response.on('end', () => {
          try {
            const json = JSON.parse(data)
            console.log('Got:', json[0].name)
            resolve(json[0].name)
          } catch {
            reject('Could not parse JSON, response: ' + data)
          }
        })
      },
    )
  })
}

const VERSION_KEY = 'giGenVersion'

export function getInstalledVersion(context: vscode.ExtensionContext): Promise<string> {
  return Promise.resolve(context.globalState.get<string>(VERSION_KEY)!)
}

export function setInstalledVersion(context: vscode.ExtensionContext, version: string): void {
  context.globalState.update(VERSION_KEY, version)
}

export async function downloadGiGen(context: vscode.ExtensionContext) {
  const binPath = getGiGenBinPath(context)
  const binDir = path.dirname(binPath)
  const cur = await getInstalledVersion(context)
  const remote = await getLatestRemoteVersion()
  const platform = await getPlatform()
  const binExists = await pathExists(binPath)

  if (cur !== remote || !binExists) {
    if (!(await pathExists(binDir))) {
      await fs.mkdir(binDir)
    }
    await vscode.window.withProgress(
      { title: 'Downloading GI Gen...', location: vscode.ProgressLocation.Notification },
      async () => {
        await downloadFile(
          `https://github.com/chenasraf/gi_gen/releases/download/${remote}/gi_gen-${remote}-${platform}`,
          binPath,
        )
        fs.chmod(binPath, 0o755)
        setInstalledVersion(context, remote)
      },
    )
    vscode.window.showInformationMessage('GI Gen downloaded')
  } else {
    // vscode.window.showInformationMessage('GI Gen already up to date')
    console.log('gi_gen already updated')
  }
}
