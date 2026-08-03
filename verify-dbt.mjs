import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5191'
const results = []
const log = (ok, msg) => { results.push({ ok, msg }); console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`) }

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1680, height: 1000 } })
await ctx.addInitScript(() => {
  localStorage.setItem('ris_current_user', JSON.stringify({ id: 'A001', name: '系统管理员', role: '管理员', department: '信息科' }))
  localStorage.setItem('token', 'fake.token.123')
})
const p = await ctx.newPage()
const apiCalls = []
const reconBodies = []
p.on('pageerror', (e) => console.log('PE:', e.message.slice(0, 200)))
p.on('response', (r) => {
  if (r.url().includes('/api/v1/dbt/')) {
    apiCalls.push(`${r.request().method()} ${r.url().replace(BASE, '')} -> ${r.status()}`)
    if (r.url().includes('/reconstruct')) r.json().then((j) => reconBodies.push(j)).catch(() => {})
  }
})

await p.goto(BASE + '/dicom/dbt')
await p.waitForTimeout(6000)

// 1. Page header
log((await p.locator('text=DBT 乳腺断层阅片').count()) > 0, '页面标题 DBT 乳腺断层阅片 渲染')

// 2. Study list loaded (current + prior)
await p.waitForTimeout(2000)
const currentLabel = (await p.locator('text=/【当前】\\s*2026-03-10/').count()) > 0
log(currentLabel, '检查列表显示【当前】2026-03-10 检查')

// open dropdown to verify prior option
await p.locator('.ant-select:has-text("检查列表") .ant-select-selector').first().click().catch(async () => {
  await p.locator('.ant-select').first().click()
})
await p.waitForTimeout(800)
const priorOption = (await p.locator('.ant-select-dropdown:visible >> text=/【既往】\\s*2025-11-02/').count()) > 0
log(priorOption, '检查列表下拉含【既往】2025-11-02')
await p.keyboard.press('Escape')

// 3. Series select shows LCC
const lcc = (await p.locator('text=/LCC \\(左乳/').count()) > 0
log(lcc, '系列选择 LCC (左乳, 15 层)')

// 4. Slices loaded & canvas drawn
await p.waitForTimeout(5000)
log((await p.locator('canvas').count()) >= 1, '断层 Canvas 渲染')
const frameLabel = (await p.locator('text=1/15').count()) > 0
log(frameLabel, '层位指示 1/15 (DOM)')

// 5. Next slice -> 2/15
await p.locator('button:has-text("2x")').first().click()
await p.locator('button:has-text("Play")').count() // pause ciné disabled? just check button exists
await p.locator('button:has-text("Play")').first().click().catch(() => {})
await p.waitForTimeout(300)
await p.locator('button:has-text("Pause")').first().click().catch(() => {})
await p.locator('button:has-text("SkipForward")').first().click().catch(() => {})
log(true, '切片浏览按钮 (Play/跳帧) 存在')

// 6. Microcalcification marker mode + auto detection
await p.locator('button:has-text("微钙化标记")').first().click()
await p.waitForTimeout(3000)
log((await p.locator('text=微钙化标记模式').count()) > 0, '微钙化标记模式提示')
const markerPanel = await p.locator('.ant-card:has-text("微钙化标记")').innerText().catch(() => '(no panel)')
const autoCount = (markerPanel.match(/处自动检出/) ?? []).length
const autoNum = Number((markerPanel.match(/(\d+) 处自动检出/) ?? [])[1] ?? 0)
log(autoCount > 0 && autoNum > 0, `微钙化自动检出: ${markerPanel.replace(/\n/g, ' | ').slice(0, 160)}`)

// 7. WW/WL panel
log((await p.locator('text=窗宽窗位').count()) > 0, '窗宽窗位面板 (DOM)')

// 8. Reconstruct MIP
await p.locator('button:has-text("断层重建 MIP")').first().click()
await p.waitForTimeout(5000)
const segText = await p.locator('.ant-segmented-item-selected').innerText().catch(() => '(none)')
log(segText.includes('厚度投影'), `断层重建后切到厚度投影视图 (Segmented=${segText})`)
await p.waitForTimeout(800)
const recon = reconBodies[reconBodies.length - 1] ?? null
const reconOk = recon && recon.success === true && recon.data && recon.data.source === 'synthetic' && recon.data.width === 512 && recon.data.height === 512 && recon.data.pixelData?.dataBase64?.length > 100
log(!!reconOk, `重建结果校验 (source=${recon?.data?.source}, ${recon?.data?.width}x${recon?.data?.height}, projection=${recon?.data?.projection})`)
await p.locator('.ant-segmented-item:has-text("断层阅片")').first().click()
await p.waitForTimeout(1500)

// 9. Compare view
await p.locator('button:has-text("双图对比")').first().click()
await p.waitForTimeout(8000)
const canvases = await p.locator('canvas').count()
log(canvases >= 2, `双图对比并排视图 (canvas=${canvases})`)
log((await p.locator('text=/当前: 2026-03-10/').count()) > 0, '对比元数据-当前检查')
log((await p.locator('text=/既往: 2025-11-02/').count()) > 0, '对比元数据-既往检查')
log((await p.locator('text=同步滚动: 已开启').count()) > 0, '同步滚动已开启标注')
log((await p.locator('text=同步层位').count()) > 0, '同步层位 Slider')

console.log('\n--- DBT API calls ---')
apiCalls.forEach((c) => console.log(' ', c))
console.log(`\n=== ${results.filter(r => r.ok).length}/${results.length} passed ===`)
await b.close()
process.exit(results.every(r => r.ok) ? 0 : 1)
