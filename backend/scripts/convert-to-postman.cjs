const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('openapi.json', 'utf-8'));

const collection = {
  info: {
    name: spec.info.title || 'G005-RISv API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3001' },
    { key: 'token', value: '' },
  ],
  item: [],
};

const tagMap = {};

for (const [routePath, methods] of Object.entries(spec.paths || {})) {
  for (const [method, details] of Object.entries(methods)) {
    if (method === 'parameters') continue;
    const tags = details.tags || ['Other'];
    const summary = details.summary || method.toUpperCase() + ' ' + routePath;
    const pathSegments = routePath.split('/').filter(Boolean);
    const pmPath = routePath.replace(/\{(\w+)\}/g, ':$1');

    const request = {
      method: method.toUpperCase(),
      header: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: 'Bearer {{token}}' },
      ],
      url: {
        raw: '{{baseUrl}}' + pmPath,
        protocol: 'http',
        host: ['{{baseUrl}}'],
        path: pathSegments.map((s) => s.replace(/^\{(.+)\}$/, ':$1')),
      },
    };

    const queryParams = (details.parameters || []).filter((p) => p.in === 'query');
    const pathParams = (details.parameters || []).filter((p) => p.in === 'path');
    if (queryParams.length) {
      request.url.query = queryParams.map((p) => ({ key: p.name, value: '', disabled: !p.required }));
    }
    if (pathParams.length) {
      request.url.variable = pathParams.map((p) => ({ key: p.name, value: '' }));
    }

    if (details.requestBody && details.requestBody.content && details.requestBody.content['application/json']) {
      request.body = {
        mode: 'raw',
        raw: JSON.stringify({}, null, 2),
        options: { raw: { language: 'json' } },
      };
    }

    for (const tag of tags) {
      if (!tagMap[tag]) {
        tagMap[tag] = { name: tag, item: [] };
        collection.item.push(tagMap[tag]);
      }
      tagMap[tag].item.push({ name: summary, request, response: [] });
    }
  }
}

fs.writeFileSync('postman_collection.json', JSON.stringify(collection, null, 2), 'utf-8');
console.log('Postman collection written to postman_collection.json');
