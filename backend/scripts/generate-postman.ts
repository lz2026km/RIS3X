import * as fs from 'fs'
import * as path from 'path'

interface OpenAPISpec {
  info: { title: string; version: string }
  servers?: { url: string }[]
  paths: Record<string, Record<string, any>>
  components?: { schemas?: Record<string, any>; securitySchemes?: Record<string, any> }
}

interface PostmanCollection {
  info: { name: string; schema: string }
  item: PostmanItem[]
  variable: { key: string; value: string }[]
}

interface PostmanItem {
  name: string
  item?: PostmanItem[]
  request?: PostmanRequest
  response?: any[]
}

interface PostmanRequest {
  method: string
  header: { key: string; value: string }[]
  url: {
    raw: string
    protocol: string
    host: string[]
    path: string[]
    query?: { key: string; value: string }[]
    variable?: { key: string; value: string }[]
  }
  body?: { mode: string; raw: string; options: { raw: { language: string } } }
  auth?: { type: string; bearer: { key: string; value: string; type: string }[] }
}

function convertOpenApiToPostman(spec: OpenAPISpec): PostmanCollection {
  const baseUrl = spec.servers?.[0]?.url ?? 'http://localhost:3001'
  const parsedUrl = new URL(baseUrl)

  const collection: PostmanCollection = {
    info: {
      name: spec.info.title ?? 'API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [],
    variable: [
      { key: 'baseUrl', value: baseUrl },
      { key: 'token', value: '' },
    ],
  }

  const tagMap: Record<string, PostmanItem> = {}

  for (const [routePath, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, details] of Object.entries(methods)) {
      if (method === 'parameters') continue

      const tags = details.tags ?? ['Other']
      const summary = details.summary ?? `${method.toUpperCase()} ${routePath}`
      const operationId = details.operationId ?? ''

      const hostParts = parsedUrl.hostname.split('.')
      const pathSegments = routePath.split('/').filter(Boolean).map(s => s.replace(/^\{/, ':').replace(/\}$/, ''))

      const pmRequest: PostmanRequest = {
        method: method.toUpperCase(),
        header: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{token}}' },
        ],
        url: {
          raw: `{{baseUrl}}${routePath}`,
          protocol: parsedUrl.protocol.replace(':', ''),
          host: ['{{baseUrl}}', ...pathSegments],
          path: pathSegments,
        },
      }

      if (details.parameters) {
        const queryParams = details.parameters.filter((p: any) => p.in === 'query')
        const pathParams = details.parameters.filter((p: any) => p.in === 'path')
        if (queryParams.length > 0) {
          pmRequest.url.query = queryParams.map((p: any) => ({
            key: p.name,
            value: '',
            disabled: !p.required,
          }))
        }
        if (pathParams.length > 0) {
          pmRequest.url.variable = pathParams.map((p: any) => ({
            key: p.name,
            value: '',
          }))
        }
      }

      if (details.requestBody) {
        const content = details.requestBody.content?.['application/json']
        if (content?.schema) {
          pmRequest.body = {
            mode: 'raw',
            raw: JSON.stringify(content.schema.example ?? extractExample(content.schema), null, 2),
            options: { raw: { language: 'json' } },
          }
        }
      }

      const hasSecurity = (details as any).security ?? spec.components?.securitySchemes
      if (hasSecurity) {
        pmRequest.auth = {
          type: 'bearer',
          bearer: [{ key: 'token', value: '{{token}}', type: 'string' }],
        }
      }

      for (const tag of tags) {
        if (!tagMap[tag]) {
          tagMap[tag] = { name: tag, item: [] }
          collection.item.push(tagMap[tag])
        }
        tagMap[tag].item!.push({
          name: summary,
          request: pmRequest,
          response: [],
        })
      }
    }
  }

  return collection
}

function extractExample(schema: any): any {
  if (schema.example !== undefined) return schema.example
  if (schema.type === 'object') {
    const obj: Record<string, any> = {}
    if (schema.properties) {
      for (const [key, prop] of Object.entries<any>(schema.properties)) {
        obj[key] = extractExample(prop)
      }
    }
    return obj
  }
  if (schema.type === 'array') {
    return [extractExample(schema.items ?? {})]
  }
  if (schema.type === 'string') return 'string'
  if (schema.type === 'number') return 0
  if (schema.type === 'boolean') return false
  if (schema.enum) return schema.enum[0]
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop()
    return { $ref: refName }
  }
  return null
}

const openapiPath = path.resolve(__dirname, '..', 'openapi.json')
const outputPath = path.resolve(__dirname, '..', 'postman_collection.json')

if (!fs.existsSync(openapiPath)) {
  console.error('openapi.json not found. Run "pnpm openapi:generate" first.')
  process.exit(1)
}

const spec: OpenAPISpec = JSON.parse(fs.readFileSync(openapiPath, 'utf-8'))
const collection = convertOpenApiToPostman(spec)
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf-8')
console.log(`Postman collection written to ${outputPath}`)
