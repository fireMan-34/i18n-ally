import path from 'path'
import { execSync } from 'child_process'
import { workspace, extensions, ExtensionContext, commands, ConfigurationScope, WorkspaceFolder } from 'vscode'
import { trimEnd, uniq } from 'lodash'
import { TagSystems } from '../tagSystems'
import { EXT_NAMESPACE, EXT_ID, EXT_LEGACY_NAMESPACE, KEY_REG_DEFAULT, KEY_REG_ALL, DEFAULT_LOCALE_COUNTRY_MAP } from '../meta'
import { KeyStyle, DirStructureAuto, SortCompare, TargetPickingStrategy } from '.'
import i18n from '~/i18n'
import { CaseStyles } from '~/utils/changeCase'
import { ExtractionBabelOptions, ExtractionHTMLOptions } from '~/extraction/parsers/options'
import { resolveRefactorTemplate } from '~/utils/resolveRefactorTemplate'

/**
 * @name 配置模块
 */
export class Config {
  /** @name 配置 */
  static readonly reloadConfigs = [
    'disabled',
    'localesPaths',
    'pathMatcher',
    'includeSubfolders',
    'enabledFrameworks',
    'enabledParsers',
    'dirStructure',
    'encoding',
    'namespace',
    'defaultNamespace',
    'disablePathParsing',
    'readonly',
    'languageTagSystem',
    'ignoreFiles',
    'parserOptions',
    'parsers.extendFileExtensions',
  ]

  /** 刷新配置 */
  static readonly refreshConfigs = [
    'sourceLanguage',
    'ignoredLocales',
    'displayLanguage',
    'regex.key',
    'regex.usageMatch',
    'regex.usageMatchAppend',
  ]

  /** 用法刷新配置 */
  static readonly usageRefreshConfigs = [
    'keysInUse',
    'derivedKeyRules',
  ]

  static ctx: ExtensionContext

  /** 获取项目路径 */
  static get root() {
    return workspace.rootPath!
  }

  /**  禁用 */
  static get disabled() {
    return Config.getConfig<boolean>('disabled') ?? false
  }

  /** 自动检测 */
  static get autoDetection() {
    return Config.getConfig<boolean>('autoDetection') ?? true
  }

  /** 展示语言 */
  // languages
  static get displayLanguage(): string {
    return this.normalizeLocale(Config.getConfig<string>('displayLanguage') || '')
  }

  /** 设置展示语言 */
  static set displayLanguage(value) {
    this.setConfig('displayLanguage', value, true)
  }

  /** 源语言 */
  static get sourceLanguage(): string {
    return this.normalizeLocale(this.getConfig<string>('sourceLanguage') || '', '') || this.displayLanguage || 'en'
  }

  /** 设置源语言 */
  static set sourceLanguage(value) {
    this.setConfig('sourceLanguage', this.normalizeLocale(value))
  }

  /** 标签系统
   * @see https://tc39.es/ecma402/#sec-intl.getcanonicallocales
   */
  static get tagSystem() {
    const tag = this.getConfig('languageTagSystem') || 'bcp47'
    return TagSystems[tag]
  }

  /** 标准国际化 */
  static normalizeLocale(locale: string, fallback?: string, strict?: boolean) {
    return this.tagSystem.normalize(locale, fallback, strict)
  }

  /** @see https://www.hubaye.com/after/post/218.html */
  static getBCP47(locale: string) {
    return this.tagSystem.toBCP47(this.tagSystem.normalize(locale))
  }

  /** 忽略的国际化 */
  static get ignoredLocales(): string[] {
    const ignored = this.getConfig('ignoredLocales')
    if (!ignored)
      return []
    if (ignored && typeof ignored === 'string')
      return [ignored]
    if (Array.isArray(ignored))
      return ignored
    return []
  }

  static set ignoredLocales(value) {
    this.setConfig('ignoredLocales', value, true)
  }

  /** 字符风格 */
  static get _keyStyle(): KeyStyle {
    const style = this.getConfig<KeyStyle>('keystyle') || 'auto'
    if (style === 'auto' && this.disablePathParsing)
      return 'flat'
    return style
  }

  static set _keyStyle(value: KeyStyle) {
    this.setConfig('keystyle', value, false)
  }

  /** 注释 */
  static get annotations(): boolean {
    return this.getConfig<boolean>('annotations') ?? true
  }

  static set annotations(value: boolean) {
    this.setConfig('annotations', value, true)
  }

  /** 最长注释长度 */
  static get annotationMaxLength(): number {
    return this.getConfig<number>('annotationMaxLength') || 40
  }

  static set annotationMaxLength(value: number) {
    this.setConfig('annotationMaxLength', value, true)
  }

  /** 注释风格符 */
  static get annotationDelimiter(): string {
    return this.getConfig<string>('annotationDelimiter') || ''
  }

  /** 注释位置 */
  static get annotationInPlace(): boolean {
    return this.getConfig<boolean>('annotationInPlace') ?? true
  }

  /** 命名空间 */
  static get namespace(): boolean | undefined {
    return this.getConfig<boolean>('namespace')
  }

  /** 默认命名空间 */
  static get defaultNamespace(): string | undefined {
    return this.getConfig<string>('defaultNamespace')
  }

  /** 激活框架 */
  static get enabledFrameworks(): string[] | undefined {
    let ids = this.getConfig<string | string[]>('enabledFrameworks')
    if (!ids || !ids.length)
      return undefined
    if (typeof ids === 'string')
      ids = [ids]
    return ids
  }

  /** 激活分析 */
  static get enabledParsers(): string[] | undefined {
    let ids = this.getConfig<string | string[]>('enabledParsers')
    if (!ids || !ids.length)
      return undefined
    if (typeof ids === 'string')
      ids = [ids]
    return ids
  }

  /** 结构 */
  static get _dirStructure(): DirStructureAuto {
    return (this.getConfig('dirStructure')) as (DirStructureAuto) || 'auto'
  }

  static set _dirStructure(value: DirStructureAuto) {
    this.setConfig('dirStructure', value, true)
  }

  /** key 排序 */
  static get sortKeys(): boolean {
    return this.getConfig<boolean>('sortKeys') || false
  }

  /** 比较排序  */
  static get sortCompare(): SortCompare {
    return this.getConfig<SortCompare>('sortCompare') || 'binary'
  }

  /** 国际化排序 */
  static get sortLocale(): string | undefined {
    return this.getConfig<string>('sortLocale')
  }

  /** 只读 */
  static get readonly(): boolean {
    return this.getConfig<boolean>('readonly') || false
  }

  /** 包含子目录 */
  static get includeSubfolders(): boolean {
    return this.getConfig<boolean>('includeSubfolders') || false
  }

  /** 变更重载 */
  static get fullReloadOnChanged(): boolean {
    return this.getConfig<boolean>('fullReloadOnChanged') || false
  }

  /** 首选界限符 */
  static get preferredDelimiter(): string {
    return this.getConfig<string>('preferredDelimiter') || '-'
  }

  /** 路径匹配者 */
  static get _pathMatcher(): string | undefined {
    return this.getConfig('pathMatcher')
  }

  /** 正则 key */
  static get regexKey(): string {
    return this.getConfig('regex.key')
      || this.getConfig('keyMatchRegex') // back compatible, deprecated.
      || (Config.disablePathParsing ? KEY_REG_ALL : KEY_REG_DEFAULT)
  }

  /** 正则惯例匹配 */
  static get _regexUsageMatch(): string[] | undefined {
    const config = this.getConfig<string[]>('regex.usageMatch')
    if (config && config.length)
      return config
  }

  /** 正则匹配附加 */
  static get _regexUsageMatchAppend(): string[] {
    return this.getConfig<string[]>('regex.usageMatchAppend') || []
  }

  /** 全量校验 */
  static get keepFulfilled(): boolean {
    return this.getConfig<boolean>('keepFulfilled') || false
  }

  /** 翻译静默密钥 */
  static get translateFallbackToKey(): boolean {
    return this.getConfig<boolean>('translate.fallbackToKey') || false
  }

  /** 翻译保存候选者 */
  static get translateSaveAsCandidates(): boolean {
    return this.getConfig<boolean>('translate.saveAsCandidates') || false
  }

  /** ruby 框架根路径 */
  static get frameworksRubyRailsScopeRoot(): string {
    return this.getConfig<string>('frameworks.ruby-rails.scopeRoot') || ''
  }

  /** ts 解析模块路径 */
  static get parsersTypescriptTsNodePath(): string {
    const config = this.getConfig<string>('parsers.typescript.tsNodePath')!
    if (config === 'ts-node')
      return config

    return `node "${path.resolve(this.extensionPath!, config)}"`
  }

  /** ts 编译路径 */
  static get parsersTypescriptCompilerOption(): any {
    return this.getConfig<any>('parsers.typescript.compilerOptions') || {}
  }

  /** 解析文件扩展 */
  static get parsersExtendFileExtensions(): any {
    return this.getConfig<any>('parsers.extendFileExtensions') || {}
  }

  /** 切换多语言显示隐藏 */
  static toggleLocaleVisibility(locale: string, visible?: boolean) {
    const ignored = this.ignoredLocales
    if (visible == null)
      visible = !ignored.includes(locale)
    if (!visible) {
      ignored.push(locale)
      this.ignoredLocales = ignored
    }
    else {
      this.ignoredLocales = ignored.filter(i => i !== locale)
    }
  }

  /** 国际化路径 */
  // locales
  static get _localesPaths(): string[] | undefined {
    const paths = this.getConfig('localesPaths')
    let localesPaths: string[]
    if (!paths)
      return
    else if (typeof paths === 'string')
      localesPaths = paths.split(',')
    else
      localesPaths = paths
    if (!localesPaths)
      return
    return localesPaths.map(i => trimEnd(i, '/\\').replace(/\\/g, '/'))
  }

  static set _localesPaths(paths: string[] | undefined) {
    this.setConfig('localesPaths', paths)
  }

  /** 获取国际化路径作用访问 */
  static getLocalesPathsInScope(scope: WorkspaceFolder): string[] | undefined {
    const paths = this.getConfig('localesPaths', scope)

    let localesPaths: string[]
    if (!paths)
      return
    else if (typeof paths === 'string')
      localesPaths = paths.split(',')
    else
      localesPaths = paths
    if (!localesPaths)
      return
    return localesPaths.map(i => trimEnd(i, '/\\').replace(/\\/g, '/'))
  }

  /** 更新国际化路径 */
  static updateLocalesPaths(paths: string[]) {
    this._localesPaths = uniq((this._localesPaths || []).concat(paths))
  }

  /** 主题注释 */
  static get themeAnnotation(): string {
    return this.getConfig<string>('theme.annotation')!
  }

  /** 注释主题忽略 */
  static get themeAnnotationMissing(): string {
    return this.getConfig<string>('theme.annotationMissing')!
  }

  /** 注释主题边框 */
  static get themeAnnotationBorder(): string {
    return this.getConfig<string>('theme.annotationBorder')!
  }

  /** 注释主题边框 */
  static get themeAnnotationMissingBorder(): string {
    return this.getConfig<string>('theme.annotationMissingBorder')!
  }

  /** 获取自身扩展 */
  static get extension() {
    return extensions.getExtension(EXT_ID)
  }

  /** 获取扩展路径 */
  static get extensionPath() {
    return this.ctx.extensionPath
  }

  /** 编码 */
  static get encoding() {
    return this.getConfig<string>('encoding') || 'utf-8'
  }

  /** 缩进 */
  static get indent() {
    return this.getConfig<number>('indent') ?? 2
  }

  /** 制表风格 */
  static get tabStyle() {
    return this.getConfig<string>('tabStyle') === 'tab' ? '\t' : ' '
  }

  /** 翻译输入源 */
  static get translatePromptSource() {
    return this.getConfig<boolean>('translate.promptSource') ?? false
  }

  /** 调度并行 */
  static get translateParallels() {
    return this.getConfig<number>('translate.parallels') || 5
  }

  /** 翻译引擎 */
  static get translateEngines() {
    return this.getConfig<string[]>('translate.engines') || ['google']
  }

  /** 样板模板 */
  static get refactorTemplates() {
    return resolveRefactorTemplate(this.getConfig<string[]>('refactor.templates') || [])
  }

  /** 禁用路径解析 */
  static get disablePathParsing() {
    return this.getConfig<boolean>('disablePathParsing') ?? false
  }

  /** 忽略文件 */
  static get ignoreFiles() {
    return this.getConfig<string[]>('ignoreFiles') ?? []
  }

  /** 可用键 */
  static get keysInUse() {
    return this.getConfig<string[]>('keysInUse') || []
  }

  static set keysInUse(value) {
    this.setConfig('keysInUse', value)
  }

  /** 使用导出 key 规则 */
  static get usageDerivedKeyRules() {
    return this.getConfig<string[]>('usage.derivedKeyRules')
      ?? this.getConfig<string[]>('derivedKeyRules') // back compatible, deprecated.
      ?? undefined
  }

  /** 使用扫描忽略 */
  static get usageScanningIgnore() {
    return this.getConfig<string[]>('usage.scanningIgnore') || []
  }

  /** 编辑优先 */
  static get preferEditor() {
    return this.getConfig<boolean>('editor.preferEditor') || false
  }

  /** 激活审核 */
  static get reviewEnabled() {
    return this.getConfig<boolean>('review.enabled') ?? true
  }

  /** 审核流转 */
  static get reviewGutters() {
    return this.getConfig<boolean>('review.gutters') ?? true
  }

  /** 审核用户名 */
  private static _reviewUserName: string | undefined
  static get reviewUserName() {
    const config = this.getConfig<string>('review.user.name')
    if (config)
      return config
    if (!Config._reviewUserName) {
      try {
        Config._reviewUserName = execSync('git config user.name').toString().trim()
      }
      catch (e) {
        return i18n.t('review.unknown_user')
      }
    }

    return Config._reviewUserName
  }

  private static _reviewUserEmail: string | undefined

  /** 审核用户邮件 */
  static get reviewUserEmail() {
    const config = this.getConfig<string>('review.user.email')
    if (config)
      return config
    if (!Config._reviewUserEmail) {
      try {
        Config._reviewUserEmail = execSync('git config user.email').toString().trim()
      }
      catch (e) {
        return ''
      }
    }

    return Config._reviewUserEmail
  }

  /** 审核用户名 */
  static get reviewUser() {
    return {
      name: Config.reviewUserName,
      email: Config.reviewUserEmail,
    }
  }

  /** 审核移除评论 */
  static get reviewRemoveCommentOnResolved() {
    return this.getConfig<boolean>('review.removeCommentOnResolved') ?? false
  }

  /** 翻译覆盖已存在 */
  static get translateOverrideExisting() {
    return this.getConfig<boolean>('translate.overrideExisting') ?? false
  }

  /** key 生成策略  */
  static get keygenStrategy() {
    return this.getConfig<string>('extract.keygenStrategy') ?? 'slug'
  }

  /**  key 生成风格 */
  static get keygenStyle(): CaseStyles {
    return this.getConfig<CaseStyles>('extract.keygenStyle') ?? 'default'
  }

  /** key 前缀 */
  static get keyPrefix() {
    return this.getConfig<string>('extract.keyPrefix') ?? ''
  }

  /** 摘录国际化长度 */
  static get extractKeyMaxLength() {
    return this.getConfig<number>('extract.keyMaxLength') ?? Infinity
  }

  /** 自动摘录长度 */
  static get extractAutoDetect() {
    return this.getConfig<boolean>('extract.autoDetect') ?? false
  }

  static set extractAutoDetect(v: boolean) {
    this.setConfig('extract.autoDetect', v, false)
    commands.executeCommand('setContext', 'i18n-ally.extract.autoDetect', v)
  }

  /** 自动摘录选项 */
  static get extractParserHTMLOptions() {
    return this.getConfig<ExtractionHTMLOptions>('extract.parsers.html') ?? {}
  }

  /** 摘录babel 配置 */
  static get extractParserBabelOptions() {
    return this.getConfig<ExtractionBabelOptions>('extract.parsers.babel') ?? {}
  }

  /** 摘录忽略  */
  static get extractIgnored() {
    return this.getConfig<string[]>('extract.ignored') ?? []
  }

  static set extractIgnored(v) {
    this.setConfig('extract.ignored', v)
  }

  /** 摘录忽略文件们 */
  static get extractIgnoredByFiles() {
    return this.getConfig<Record<string, string[]>>('extract.ignoredByFiles') ?? {}
  }

  static set extractIgnoredByFiles(v) {
    this.setConfig('extract.ignoredByFiles', v)
  }

  /** 展示配置  */
  static get showFlags() {
    return this.getConfig<boolean>('showFlags') ?? true
  }

  /** 解析项 */
  static get parserOptions() {
    return this.getConfig<any>('parserOptions') ?? {}
  }

  /** 国际化解析语言 map */
  static get localeCountryMap() {
    return Object.assign(
      DEFAULT_LOCALE_COUNTRY_MAP,
      this.getConfig<Record<string, string>>('localeCountryMap'),
    )
  }

  /** 国际化挑选策略 */
  static get targetPickingStrategy(): TargetPickingStrategy {
    return this.getConfig<TargetPickingStrategy | undefined>('extract.targetPickingStrategy')
      ?? TargetPickingStrategy.None
  }

  /** 获取国际化配置 跨插件解析 */
  // config
  private static getConfig<T = any>(key: string, scope?: ConfigurationScope | undefined): T | undefined {
    let config = workspace
      .getConfiguration(EXT_NAMESPACE, scope)
      .get<T>(key)

    // compatible to vue-i18n-ally
    if (config === undefined) {
      config = workspace
        .getConfiguration(EXT_LEGACY_NAMESPACE)
        .get<T>(key)
    }

    return config
  }

  /** 更新多项目配置 */
  private static async setConfig(key: string, value: any, isGlobal = false) {
    // transfer legacy config
    if (workspace
      .getConfiguration(EXT_LEGACY_NAMESPACE)
      .get<any>(key)
    ) {
      await workspace.getConfiguration(EXT_LEGACY_NAMESPACE)
        .update(key, undefined, isGlobal)
    }

    // update value
    return await workspace
      .getConfiguration(EXT_NAMESPACE)
      .update(key, value, isGlobal)
  }

  /** 百度密钥内容 */
  static get baiduApiSecret() {
    return this.getConfig<string | null | undefined>('translate.baidu.apiSecret')
  }

  /** 百度 app id */
  static get baiduAppid() {
    return this.getConfig<string | null | undefined>('translate.baidu.appid')
  }

  /** 谷歌 验证 key */
  static get googleApiKey() {
    return this.getConfig<string | null | undefined>('translate.google.apiKey')
  }

  /** 深度翻译 key */
  static get deeplApiKey() {
    return this.getConfig<string | null | undefined>('translate.deepl.apiKey')
  }

  /** deep 免费 api 入口 */
  static get deeplUseFreeApiEntry() {
    return this.getConfig<boolean>('translate.deepl.useFreeApiEntry')
  }

  /** deep 日志 */
  static get deeplLog(): boolean {
    return !!this.getConfig('translate.deepl.enableLog')
  }

  /** libreTranslate api 入口 */
  static get libreTranslateApiRoot() {
    return this.getConfig<string | null | undefined>('translate.libre.apiRoot')
  }

  /** openApi key */
  static get openaiApiKey() {
    return this.getConfig<string | null | undefined>('translate.openai.apiKey')
  }

  /** openApi 入口 */
  static get openaiApiRoot() {
    return this.getConfig<string | null | undefined>('translate.openai.apiRoot')
  }

  /** openApi 模型 */
  static get openaiApiModel() {
    return this.getConfig<string>('translate.openai.apiModel') ?? 'gpt-3.5-turbo'
  }

  /** 遥测技术 */
  static get telemetry(): boolean {
    return workspace.getConfiguration().get('telemetry.enableTelemetry') as boolean
  }
}
