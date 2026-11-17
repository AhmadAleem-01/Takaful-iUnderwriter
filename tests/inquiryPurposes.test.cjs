const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function runtimeTableResolver() {
  const source = fs.readFileSync(path.join(__dirname, '../node_modules/@microsoft/power-apps/dist/internal/data/core/data/executors/dataverseDataOperationExecutor.js'), 'utf8')
  const ast = ts.createSourceFile('executor.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const declaration = ast.statements.find((node) => ts.isClassDeclaration(node))
  const methods = declaration.members.filter((node) => ['_loadDatabaseReferencesFromRuntime', '_getDataverseDataSourceInfo'].includes(node.name?.getText(ast)))
  class PowerDataRuntimeError extends Error {
    constructor(code, message) { super(message); this.code = code }
  }
  const context = { Log: { trackEvent() {} }, ErrorCodes: {}, PowerDataRuntimeError }
  vm.runInNewContext(`this.Resolver = class { ${methods.map((node) => node.getText(ast)).join('\n')} }`, context)
  return new context.Resolver()
}

function load(relativePath, requireModule) {
  const context = { exports: {}, require: requireModule }
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}

test('purpose lookup is registered before another service initializes the shared SDK client', async () => {
  const { dataSourcesInfo } = load('.power/schemas/appschemas/dataSourcesInfo.ts')
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../power.config.json'), 'utf8'))
  assert.match(JSON.stringify(config), /"aur_inquiry_purposes":\{"entitySetName":"aur_inquiry_purposes"/)
  assert.equal(dataSourcesInfo.aur_inquiry_purposes.primaryKey, 'aur_inquiry_purposeid')
  let firstRegistry
  let requested
  const resolver = runtimeTableResolver()
  const tables = Object.values(config.databaseReferences).flatMap((db) => Object.values(db.dataSources))
  resolver._getMetadataClient = async () => ({ getAppDataSourceConfigsAsync: async () => ({
    success: true,
    data: tables.map((table) => ({ ...table, runtimeUrl: 'https://example.crm.dynamics.com/api/data/v9.2' })),
  }) })
  resolver._extractInstanceUrlFromRuntimeUrl = () => 'https://example.crm.dynamics.com'
  resolver.getDatabaseReferences = () => resolver._loadDatabaseReferencesFromRuntime()
  await assert.rejects(() => resolver._getDataverseDataSourceInfo('inquirypurposes'), /No Dataverse data source found/)
  const getClient = (registry) => {
    firstRegistry ??= registry
    return { retrieveMultipleRecordsAsync: async (name) => {
      assert.ok(firstRegistry[name], `Missing data source: ${name}`)
      const runtimeSource = await resolver._getDataverseDataSourceInfo(name)
      assert.equal(runtimeSource.entitySetName, 'aur_inquiry_purposes')
      requested = name
      return { success: true, data: [{ aur_inquiry_purposeid: 'purpose-id', aur_name: 'For Quotation' }] }
    } }
  }
  getClient(dataSourcesInfo) // Another generated service initializes the SDK first.
  const service = load('src/services/inquiryPurposesService.ts', (name) => {
    if (name === '@microsoft/power-apps/data') return { getClient }
    if (name.endsWith('/dataSourcesInfo')) return { dataSourcesInfo }
    throw new Error(`Unexpected module: ${name}`)
  })
  const options = await service.getInquiryPurposeOptions()
  assert.equal(requested, 'aur_inquiry_purposes')
  assert.equal(options[0].value, 'purpose-id')
  assert.equal(options[0].label, 'For Quotation')
})
