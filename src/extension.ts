// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { downloadGiGen } from './bin-download'
import { main } from './gi-gen'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Extension "gi-gen" is now active')

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  // let dlCmd = vscode.commands.registerCommand('gi-gen.download', () => downloadGiGen(context))
  let genCmd = vscode.commands.registerCommand('gi-gen.generate', () => main(context))
  // context.subscriptions.push(dlCmd)
  context.subscriptions.push(genCmd)
}

// this method is called when your extension is deactivated
export function deactivate() {}
