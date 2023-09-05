import { ExtensionContext } from 'vscode'
import { flatten } from 'lodash'
import { version } from '../package.json'
import { Global, Config, KeyDetector, CurrentFile } from '~/core'
import commandsModules, { Commands } from '~/commands'
import viewsModules from '~/views'
import { Log } from '~/utils'
import i18n from '~/i18n'
import editorModules from '~/editor'

export async function activate(ctx: ExtensionContext) {
  Log.info(`🈶 Activated, v${version}`)

  // * 挂载上下文
  Config.ctx = ctx
  //* 初始化上下文路径 国际化 package json
  i18n.init(ctx.extensionPath)
  //* 国家化检测
  KeyDetector.init(ctx)

  // 激活插件
  // activate the extension
  await Global.init(ctx)
  // * 观察所有文件
  CurrentFile.watch(ctx)

  // 载入模块
  const modules = [
    // 命令行模块
    commandsModules,
    // 编辑模块
    editorModules,
    // 视图模块
    viewsModules,
  ]
  // 拍扁执行
  const disposables = flatten(modules.map(m => m(ctx)))
  disposables.forEach(d => ctx.subscriptions.push(d))
}

export function deactivate() {
  Log.info('🈚 Deactivated')
}

export {
  Global,
  CurrentFile,
  KeyDetector,
  Config,
  Log,
  Commands,
}
