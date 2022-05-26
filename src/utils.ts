import * as vscode from 'vscode'
import * as fs from 'fs'
import * as http from 'https'
import * as cp from 'child_process'
import * as fsP from 'fs/promises'
import { F_OK } from 'constants'
import path = require('path')

export function downloadFile(source: string, target: string): Promise<string> {
  console.log(`Downloading ${source} to ${target}`)
  return new Promise((resolve, reject) => {
    try {
      const file = fs.createWriteStream(target)
      file.on('finish', () => {
        console.log('Download Completed')
        file.close()
        resolve(target)
      })

      file.on('error', (err) => {
        console.error(err)
        reject(err)
      })

      http.get(source, (response) => {
        if (response.statusCode === 302) {
          file.close()
          return resolve(downloadFile(response.headers.location!, target))
        }
        response.pipe(file)
      })
    } catch (e) {
      console.error('Error while downloading', source)
      console.error(e)
    }
  })
}

export type AvailablePlatform =
  | 'macos-arm'
  | 'macos-intel'
  | 'windows'
  | 'linux-arm'
  | 'linux-386'
  | 'linux-amd64'

export async function getPlatform(): Promise<AvailablePlatform> {
  const { platform } = process
  switch (platform) {
    case 'darwin':
      return `macos-${await getMacArch()}`
    case 'linux':
      return `linux-${await getLinuxArch()}`
    case 'cygwin':
    case 'win32':
      return 'windows'
    default:
      throw new TypeError(`Unsupported platform: ${platform}`)
  }
}

export async function getLinuxArch(): Promise<'arm' | 'amd64' | '386'> {
  const res = await shellExec('uname', ['-m'])
  switch (res) {
    case 'i386':
    case 'i686':
      return '386'
    case 'arm':
      return 'arm'
    case 'x86_64':
    case 'amd64':
    default:
      return 'amd64'
  }
}

export async function getMacArch(): Promise<'arm' | 'intel'> {
  try {
    await shellExec('sysctl', ['sysctl.proc_translated'])
    return 'arm'
  } catch {
    return 'intel'
  }
}

export function quoteWrap(s: string): string {
  if (!s.includes(' ')) {
    return s
  }
  return `"${s}"`
}

export function shellExec(cmd: string, args?: string[]): Promise<string> {
  const wd = getWorkspaceDir()
  const input = [quoteWrap(cmd), ...(args ?? []).map(quoteWrap)].join(' ')
  console.log('Executing', input, 'in', wd?.fsPath)
  return new Promise((resolve, reject) => {
    cp.exec(input, { cwd: wd!.fsPath }, (err, stdout, stderr) => {
      console.log('stdout:', stdout)
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

export function getWorkspaceDir() {
  return vscode.workspace.workspaceFolders?.[0].uri
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fsP.access(filePath, F_OK)
    return true
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      return false
    }
    throw e
  }
}

export function getGiGenBinPath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, 'gi_gen')
}
