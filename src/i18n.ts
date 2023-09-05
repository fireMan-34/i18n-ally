import fs from 'fs'
import path from 'path'
import { env } from 'vscode'

export default class i18n {
  static language = env.language.toLocaleLowerCase()
  static messages: Record<string, string> = {}

  /** 似乎是国际化语言的 schema 提供 package json 动态 */
  static init(extensionPath: string) {
    let name = this.language === 'en' ? 'package.nls.json' : `package.nls.${this.language}.json`
    if (!fs.existsSync(path.join(extensionPath, name)))
      name = 'package.nls.json' // locale not exist, fallback to English

    this.messages = JSON.parse(fs.readFileSync(path.join(extensionPath, name), 'utf-8'))
  }

  static format(str: string, args: any[]) {
    /** 知识补充
     * @see https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/String/replace
     */
    return str.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined'
        ? args[number].toString()
        : match
    })
  }

  /** 翻译 */
  static t(key: string, ...args: any[]) {
    let text = this.messages[key] || ''

    if (args && args.length)
      text = this.format(text, args)

    return text
  }
}
