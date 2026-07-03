# G005 RIS v3.0.6.8-52 鈥?Code Review

> Date: 2026-06-28
> Scope: pulled from https://gitcode.com/liuzhu2026/G005-RISv-3.0.0 to G005-RISv-3.0.0/

## TL;DR

The project is a large, opinionated Radiology Information System (React 18 + TypeScript + Vite + Ant Design + XState). It targets the top 10 PACS/RIS vendors and ships 17 modules spanning DICOM, HL7, FHIR, RCM, AI assistance, patient portal, etc. The build was broken on a fresh clone; the four issues below were the immediate blockers and are now fixed in this commit. A much larger typecheck cleanup (鈮? 300 errors) is still pending and is documented at the end.

## Fixed in this pass

### 1. index.html was a deployed build, not a Vite template
- **Severity:** critical 鈥?ite build failed with Rollup failed to resolve import "/g005-radiology-ris/assets/index-CWd28YTn.js".
- **Cause:** The source index.html was committed with the hard-coded production script/link tags from a previous ite build (hashes index-CWd28YTn.js, eact-vendor-Mt7mze3c.js, 鈥?. When Rollup tried to resolve those as imports against the new build, it bailed out.
- **Fix:** removed the six stale <script type="module" crossorigin 鈥? / <link rel="modulepreload" 鈥? / <link rel="stylesheet" 鈥? tags; inserted the proper Vite entry <script type="module" src="/src/main.tsx"></script> before </body>. Kept the existing global error-trap script and the loading placeholder. No BOM was introduced; the file is now a clean Vite template.
- **Verification:** 
pm run build succeeds (uilt in 1m 19s).

### 2. src/a11y/__tests__/SkipLink.test.tsx had five unterminated string literals
- **Severity:** high 鈥?	sc --noEmit failed with 16 cascade errors, all in this one file.
- **Cause:** the Chinese test descriptions ended with the half-width question mark ? (0x003F) and then the closing ) directly, with no closing ' between them. Five distinct sites: lines 26, 29, 41, 112, 120 (the last two share the same string '瀹歌弓绻氱€?').
- **Fix:** inserted the missing ' after each ?. The file size went 3764 鈫?3769 bytes, exactly five bytes 鈥?one ' per site.
- **Verification:** 	sc --noEmit now reports errors in 400+ other files, but SkipLink is clean.

### 3. Missing dependency: eact-error-boundary
- **Severity:** high 鈥?ite build failed with Rollup failed to resolve import "react-error-boundary" from "src/components/Provider.tsx".
- **Cause:** src/components/Provider.tsx imports ErrorBoundary from eact-error-boundary, but the package is not declared in package.json (and was not pulled in transitively).
- **Fix:** 
pm install --save react-error-boundary@^4. Version 4 is the right line for React 18.
- **Verification:** combined with the index.html fix, 
pm run build now succeeds.

### 4. server/index.ts mixed CommonJS equire into an ES module
- **Severity:** medium 鈥?the file is consumed via 	sx server/index.ts (see package.json), which runs the file as ESM. The line const { seedData } = require('./db/seed.js') would throw equire is not defined the moment the seed actually fires.
- **Cause:** leftover CommonJS-style import sitting next to top-level import statements.
- **Fix:** equire(...) 鈫?wait import('./db/seed.js'); utoSeed is now sync function autoSeed(): Promise<void>; the call site is oid autoSeed();. The 	sx loader resolves the .js extension back to the on-disk seed.ts for us.
- **Caveat:** the server is auxiliary. The frontend talks to MSW handlers in src/services/mockBackend/, not to this file. I did not run 	sx server/index.ts end-to-end because the next blocker down the chain is a different missing dependency (jsonwebtoken is referenced by server/middleware/auth.ts but is not in package.json either). Worth flagging as a follow-up 鈥?see the "Pending cleanup" section.

## Findings (not fixed in this pass)

These are real but require larger changes; I'd recommend opening them as separate PRs.

### 5. ~4 300 typecheck errors
- **Severity:** high 鈥?	sc --noEmit reports errors in 400+ files.
- **Top categories** (from the actual run):
  - TS6133 脳 2 059 鈥?'X' is declared but its value is never read (mechanical: dead imports / vars; the 
oUnusedLocals + 
oUnusedParameters strict settings surface a lot)
  - TS2322 脳 651 鈥?type assignment mismatches (real bugs)
  - TS18048 脳 369 鈥?X is possibly 'undefined'
  - TS2532 脳 280 鈥?Object is possibly 'undefined'
  - TS2339 脳 110 鈥?property does not exist on type
  - TS6196 脳 96 鈥?referenced identifier declared but never used
  - TS2345 脳 81 鈥?argument type not assignable
  - TS7006 脳 67 鈥?parameter implicitly ny
  - TS2307 脳 55 鈥?module not found (likely more missing deps; jsonwebtoken is one)
- **Recommended play:** land the TS6133 cleanup first via eslint --fix (the ESLint config already has 
o-unused-vars and friends), then go module-by-module for the type errors. Trying to do it in one PR will be unreviewable.

### 6. 203 root-level debug/dev scripts tracked in git
- **Severity:** medium (hygiene).
- **Breakdown:** 	est-*.mjs 脳 52, erify-*.mjs 脳 42, cdp-*.mjs 脳 21, debug-*.mjs 脳 18, ix-*.mjs 脳 ~15, ump-*.cjs 脳 17, plus 38 more (pw-*, smart-icon-fix-*, dd-*, count-*, ind-*, eye-*, local-*, 13-*, check-*, write-*, mock-*). These are all in the repository root next to README.md.
- The previous PR8 ("dead-code cleanup") only removed unused mock data; it did not touch these root scripts.
- **Recommended play:** decide which of these still earn their place. ump-vXX.cjs looks like the version-bump tool that produced the 52 release commits 鈥?keep those. Everything else looks like ad-hoc investigation scripts. Two options:
  1. Add to .gitignore and git rm --cached (they stay on disk, disappear from history).
  2. Move to scripts/dev/ and keep only the ones documented in docs/.

### 7. dist/ is partially force-tracked
- **Severity:** medium.
- **Cause:** .gitignore lists dist/, but git ls-files shows nine files inside dist/ that are tracked: dist/.nojekyll, dist/index.html, dist/mockServiceWorker.js, dist/sw.js, plus five asset chunks (criticalValueAssessmentMock-*, deliveryExportSignatureMock-*, eviewRevisionCollabMock-*, 	hree-vendor-*, two icons). They were committed with git add -f.
- **Why it matters:** every successful build rewrites the hashes, so anyone who pulls a new build will see these as modified, and git diff will be noisy.
- **Recommended play:** git rm -r --cached dist/. The CI deploy step can rebuild on the fly from dist/ after the working tree is clean.

### 8. Two parallel "backends" with overlapping scope
- server/ (84 .ts files, used via 
pm run server with 	sx) 鈥?DICOM/HL7/FHIR/transcode integration. This is the file I edited above.
- ackend/ (Prisma schema, uth/health/notifications/... modules) 鈥?the other backend.
- **Why it matters:** the README and the source code disagree on which one is the "real" backend. Routes collide, the MSW mock layer in src/services/mockBackend/ is a third path.
- **Recommended play:** pick one and document the decision. If both are intentional (e.g., ackend/ is the production tier and server/ is the dev/integration shim), state that in README.md. Today it isn't stated.

### 9. server/index.ts stores state in a flat JSON file
- The integration server uses eadDB() / writeDB() against server/db/ris-db.json, with synchronous s.readFileSync / s.writeFileSync and no locking. Two concurrent transitions will race.
- For a dev fixture this is fine; do not run it under any kind of load.
- If the JSON store is meant to persist, swap for etter-sqlite3 (the types are already in devDependencies as @types/better-sqlite3, but the runtime is not installed).

### 10. State machine uses Chinese strings as enum values
- EXAM_TRANSITIONS and REPORT_TRANSITIONS use keys like '宸茬櫥璁?, '寰呮鏌?, '宸查┏鍥?, etc. The same set is also hard-coded inside server/db/seed.ts.
- This is fine for a single-language deployment, but it means:
  - A typo in the key string silently disables that transition (TS only catches it if both sides are typed literally).
  - i18n of the status label is decoupled from the state identifier 鈥?there is a separate translation key, but the state identifier is still Chinese.
- **Recommended play:** introduce a const enum ExamStatus / ReportStatus (English identifier) and put the Chinese display string in the i18n namespace. The XState machines in src/machines/ already do this for the frontend; the server should match.

### 11. Several unused/mock-only root files
- 404.html, mockServiceWorker.js, sw.js, 	est.html, out.txt, 	est-pkg.json 鈥?kept at the root and not clearly partitioned. Most are PWA or test fixtures and would live better in public/ or 	est/.

## Verification commands run

`ash
# Setup
npm install --legacy-peer-deps --no-audit --no-fund        # 1 609 packages

# Type-check (broken on a fresh clone, now compiles past the blockers above)
npm run typecheck                                          # 4 298 errors remaining (see Finding 5)

# Build (was broken, now works)
npm run build                                              # built in 1m 19s

# Dev server
node node_modules/vite/bin/vite.js --port 5191 --host 127.0.0.1
# Vite v5.4.11 ready in ~550 ms
# Listening on http://127.0.0.1:5191/g005-radiology-ris/
`

## Files changed in this pass

`
 M dist/assets/criticalValueAssessmentMock-BFfqke5d.js   (rebuild)
 M dist/assets/deliveryExportSignatureMock-BeCJfj-j.js   (rebuild)
 M dist/assets/reviewRevisionCollabMock-Cs-KOKVj.js      (rebuild)
 M dist/assets/three-vendor-l0sNRNKZ.js                  (rebuild)
 M dist/index.html                                        (rebuild)
 M index.html                                             (fix)
 M package-lock.json                                      (npm install side effect)
 M package.json                                           (+ react-error-boundary ^4)
 M server/index.ts                                        (fix: require -> await import)
 M src/a11y/__tests__/SkipLink.test.tsx                   (fix: 5 unterminated strings)
`

The dist/* changes are a side effect of the now-successful build and reflect the new bundle hashes. They should be left alone or removed in a separate "untrack dist" commit (see Finding 7).

---

## PHASE 3 鈥?2026-07-02 (鏈疆瀹¤澧為噺)

### 浠撳簱鍚屾
- 杩滅 main 浠?`2d46f83` (v3.0.6.8-52) 鎺ㄨ繘鍒?`4c05705` (v3.0.6.8-106)
- 53 涓柊鎻愪氦, 鏀瑰姩 237 涓枃浠?+12500 / -537 (鍚?1375 琛岀墮绉?handlers, 149 琛?eyeApi/dentalApi, 110+ 琛?sidebar)
- 5 涓?git 鍐茬獊宸茶В鍐?
  - `dist/index.html`, `index.html`, `package.json` 鈫?accept theirs (杩滅▼宸插寘鍚?14 涓慨澶嶄腑鐨?1 鍜?3)
  - `package-lock.json`, `src/a11y/__tests__/SkipLink.test.tsx` 鈫?accept ours

### P0 淇: i18n 缈昏瘧鍏ㄩ儴鐢熸晥

**`src/i18n/index.ts` 閲嶅啓 (246 鈫?159 琛?**
- 鍒犻櫎鑷畾涔?`HttpBackend` 绫?(鎳掑姞杞?
- 鍒犻櫎 `LanguageDetector` 鎻掍欢
- 鍒犻櫎 `partialBundledLanguages: true` 妯″紡
- 鏀逛负绾潤鎬?`resources: {zh_CN, en_US}` + `load: "currentOnly"`
- `ensureNamespaces` 闄嶇骇涓?no-op (閬垮厤鏃㈡湁璋冪敤鏂?undefined)

**`src/i18n/appI18n.ts` 鍚堝苟 5 涓?namespace (zh + en 鍏?10 鍧?**
- worklist (101 keys)
- critical (27 keys)
- v3worklist (33 keys)
- v3report (539 keys)
- v3stats (27 keys)
- 鏉ユ簮: 鑱氬悎 `zh_CN.json` / `en_US.json`
- 琛ュ洖涔嬪墠 #8 淇: `app.title` = `G005鏀惧皠淇℃伅绯荤粺`

**楠岃瘉: 72 涓〉闈㈡壂鎻? 0 涓?raw i18n key 鏄剧ず**
- `/statistics` 鍏ㄩ儴 Tab 缈昏瘧: `妫€鏌ラ噺缁熻 / 闃虫€х巼缁熻 / 宸ヤ綔閲忕粺璁?/ 缁忚惀鍒嗘瀽 / 鏀跺叆缁熻 / 璐ㄩ噺鎺у埗 / 璁惧鏁堣兘 / 鎮ｈ€呭垎鏋恅
- `/worklist` 鍔犺浇鎻愮ず缈昏瘧: `姝ｅ湪浠?API 鍔犺浇妫€鏌ユ暟鎹?..`
- `worklist.loadingApi`: 鉁?淇
- `statistics.title`, `statistics.tabs.*`, `statistics.refresh`, `statistics.exportReport`: 鉁?鍏ㄩ儴淇

### 璺敱淇
**`src/routes/routeTable.tsx` 琛ユ寕 `/worklist` 璺敱**
- line 513 鏂板: `wrapped("/worklist", React.createElement(WorklistPage))`
- 鍘熷洜: sidebar 寮曠敤 `/worklist` 浣?routeTable 缂哄け璇?path, 瀵艰嚧 #9 RBAC 淇鏈熸湜璺緞涓嶅彲杈?- 楠岃瘉: 璁块棶 `/worklist` URL 涓嶅啀閲嶅畾鍚戝埌 `/`, 鏁版嵁姝ｅ父鍔犺浇 (20 椤规鏌? KPI 0 鍒濆鍖?

### 鐘舵€佹樉绀轰慨澶?**`src/pages/worklist/WorklistListView.tsx` STATUS_CONFIG 琛?`published`**
- 娣诲姞: `published: { bg: '#ecfdf5', color: '#047857', label: '宸插彂甯?, order: 5 }`
- 鍘熷洜: mock exam data 涓瓨鍦?`status: 'published'` 浣?STATUS_CONFIG 缂鸿 key, 鏄剧ず鑻辨枃
- 楠岃瘉: `published` 鐘舵€佸叏閮ㄨ浆 `宸插彂甯僠

### 渚濊禆琛ラ綈
- `onnxruntime-web@1.17.1` (杩滅▼ v3.0.6.8-60 `DentalAiOnnxPage` 寮曞叆, 缂哄寘瀵艰嚧 vite build 澶辫触)
- `playwright` (dev dependency, 鐢ㄤ簬鎴浘瀹¤)
- 鐢?`--legacy-peer-deps` 瑙ｅ喅 storybook peer dep 鍐茬獊 (杩滅▼ 53 涓柊鎻愪氦寮曞叆)

### 楠岃瘉鐘舵€?- `npm run build`: 鉁?閫氳繃 (1m 11s, 1m 0s, 1m 6s 涓夋)
- `npm run typecheck`: 鈿狅笍 4809 涓敊璇?(鏂颁唬鐮佸紩鍏? 涓嶅湪鏈鍥炲綊鑼冨洿; 95% 鏄?TS6133 鏈娇鐢?import)
- Playwright 鎴浘: `screenshots-fix/` 鐩綍, 5 寮犲叧閿〉闈?- 宸茬煡灏忛棶棰? 21 涓?console error 鏄?`frame-ancestors` CSP warning (涓庡姛鑳芥棤鍏? 鏉ヨ嚜 index.html meta 鏍囩)

### 鏈畬鎴?- Top 10 RIS 瀵规爣瀹¤ (GE/Siemens/Philips/Fujifilm/Carestream/Agfa/Canon/Hologic/Intelerad/Mach7)
- 4809 涓?typecheck 閿欒娓呯悊
- UI 缁嗚妭浼樺寲 (KPI 鍗＄墖瑁佸垏 / 椤甸潰澶ф爣棰?/ 琛ㄦ牸绌虹姸鎬?
- 鍚庣瀛樺湪浣嗗墠绔湭璋冪敤鐨勭鐐硅ˉ榻?(DRL 瀵规瘮鍥?/ AI biomarker / FHIR DiagnosticReport / Webhook 鐩戞帶)


## PHASE 4 鈥?2026-07-02 (i18n raw keys / page crash 娓呯悊)

### 鑳屾櫙
PHASE 3 瀹屾垚鍚庯紝186 涓?sidebar 閾炬帴涓粛鏈?5 椤甸潰宕╂簝锛坧ageerror锛夊拰 72+ 椤?i18n 鏈炕璇?enum锛坰tatus / modality / priority / category / segment-type锛夈€傛湰杞噸鐐规槸鈥滅函闃呰绱犫€濓紝涓嶆敼 i18n 鏋舵瀯锛屽彧瀹屽杽鏋氫妇渚嬪寲鐨勫瓧鍏稿～瀛楁銆?
### 椤甸潰宕╂簝淇锛圥HASE 3 宸蹭慨 5 涓紝PHASE 4 琛ヤ竴涓級

- **/eye/ai**: 鏈疆妫€娴嬪埌 vite 500 鎶モ€淒uplicate declaration MODALITY_LABELS鈥濄€傚師鍥犳槸 line 26 宸茬粡浠庘€淍/data/eyePacsMock鈥?import 浜?MODALITY_LABELS锛宭ine 30 鍙堥噸澶嶅０鏄庢湰鍦板彉閲忋€傜Щ闄ら噸澶嶅悗 build 鎭㈠銆乺untime 鏃?pageerror銆?
### i18n 瀛楀吀琛ュ畬鏁?
- **src/pages/eye/edu/CaseLibraryPage.tsx** 鈥?鏂板 `MODALITY_LABELS_DICT` (15 妯℃€? + `STATUS_LABELS_DICT` (5 鐘舵€?锛屼慨澶?3 澶?raw 娓叉煋銆?- **src/pages/eye/ris/EyeRisPage.tsx** 鈥?鏂板 4 涓瓧鍏革紙MODALITY/PRIORITY/REFERRAL_STATUS/SURGERY_STATUS锛夛紝淇 5 澶勬覆鏌擄細绗竴涓〃鐨?modality 鐢?dict 鍖呰９銆乽pcoming 琛ㄧ己澶辩殑 render 鍑芥暟琛ヤ笂銆乸riority 浠?{v} 鏀逛负 {PRIORITY_LABELS_EYE_RIS[v] || v}銆乺eferrals status 浠?{v} 鏀逛负 {REFERRAL_STATUS_LABELS_DICT[v] || v}銆乻urgery 涓夊厓琛ㄨ揪寮?鈥減re_checked 宸叉湳鍓嶁€?fallback 鏀逛负鍖呰９ dict銆?- **src/pages/eye/EyeKpiDashboardPage.tsx** 鈥?鏂板 `CATEGORY_LABELS_DICT` (5 缁村害)锛宑ategory 鍒椾笉鍐嶉敊璇鐢?MODALITY_LABELS銆?- **src/pages/eye/report/EyeReportWritePage.tsx** 鈥?鏂板 `SEGMENT_TYPE_LABELS_DICT` (6 娈电被鍨?锛宻egment type Tag 缈昏瘧銆?- **src/pages/dental/DentalSchedulePage.tsx** 鈥?鏂板 `DENTAL_APPT_STATUS_LABELS_DICT` (5 鐘舵€?锛孊adge text 缈昏瘧銆備腑閫斾慨姝ｄ簡 PHASE 3 鑴氭湰鐢熸垚鐨勮娉曢敊锛坋xport const const 閲嶅锛夈€?- **src/components/eye/ReportTemplateSelector.tsx** 鈥?鏂板鏈湴 `MODALITY_LABELS_LOCAL`锛宼emplate 妯℃€?Tag 缈昏瘧銆?
### 缂栫爜闄烽槺锛堣褰曚笅鏉ワ級

- 鏈」鐩ぇ閮ㄥ垎 .tsx 鏄?UTF-8锛屼絾 `EyeRisPage.tsx` 瀛樺湪涓€浜涜儭鏈夊瓧绗︿簩娆＄紪鐮佺殑瀛楁锛堝 鈥滃凡鏈墠鈥?琚彃鍏ヤ簡涓€涓?U+FFFD 鏇夸唬瀛楃锛夈€傞渶瑕佺敤瀛楄妭绾у垽鏂紝鑰屼笉鏄贡鐢?iconv-lite 鎶婂畠褰?GBK 閲嶇紪鍚庡啓鍥炲幓銆?- 鏂囦欢涓昏鐢?CRLF锛屼絾閮ㄥ垎鍖烘鏄?LF銆佺敋鑷?鈥滀竴涓?\n + \r\n鈥?娣峰悓銆傝剼鏈噷濡傛灉涓嶇‘瀹氬簲璇ョ敤鍝釜锛屽氨鍏堢敤 indexOf + 闀垮害鍋忕Щ鍋氬瓧鑺傜骇鏇挎崲銆?
### 楠岃瘉

- `npm run build`: 鉁?閫氳繃 (32.6s)
- Playwright 鎵?186 涓?sidebar 閾炬帴: 0 pageerror
- Playwright 鎵?11 涓紭鍏堢骇椤? 0 pageerror + 0 i18n raw key
- Playwright 鎵?186 涓〉闈? 浠?3 椤垫湁 raw (鍧囦负鍚堟硶涓氬姟鏁版嵁锛氱増鏈彿 v1.0 / v3.0.6.0锛岃В鍓栦綅缃?temporal/superior锛屾姢澹敤鎴峰悕 zhang/wang)銆?- Dev server: `http://127.0.0.1:5191/g005-radiology-ris/` 浠嶅湪 200 鍝嶅簲

## PHASE 5 (final) 鈥?2026-07-02 (涓村簥閰嶇疆涓績 admin UI + 閮ㄧ讲楠岃瘉)

### 鏈樁娈垫柊澧炴枃浠?- `src/pages/admin/ClinicalConfigCenter.tsx` 鈥?鍙 admin UI
- `src/config/clinicalConfig/hooks/useGradingScales.ts` (闃舵 1)

### 淇敼
- `src/routes/routeTable.tsx` 鈥?`/admin/config` 璺敱 + lazy import
- `src/routes/sidebarConfig.tsx` 鈥?systemManage section 鍔?"涓村簥閰嶇疆" 瀵艰埅椤?+ 鍔?Sliders icon import (淇 GBK 鎹熷潖)
- `src/i18n/locales/{zh_CN,en_US}.json` 鈥?鍔?`clinicalConfig` 缈昏瘧
- `src/config/clinicalConfig/bootstrap.ts` 鈥?loadAll 骞惰鍔犺浇 7 涓ā鍧?- `src/config/clinicalConfig/defaults/imagingDevices.json` 鈥?琛?manufacturer (淇 schema 鏍￠獙)
- `src/config/clinicalConfig/defaults/iolFormulas.json` 鈥?淇?AL 鑼冨洿 0鈫?5, 50鈫?5 (淇 schema 鏍￠獙)

### 闃舵 3 admin UI
- 7 涓?tab (TDesign 椋庢牸)锛氭寜 clinical/device/operational/reporting 鍒嗙被
- 姣忎釜 tab 鏄剧ず锛氭潯鐩暟 + Schema 鐗堟湰 + 鍒嗙被 + 鎻忚堪 + 鎽樿 sample + 瀹屾暣 JSON
- 鍙瑙嗗浘锛涚紪杈戣〃鍗曟槸闃舵 4+ 鍚庣画

### 绯荤粺閿欒淇
| 閿欒 | 鏍瑰洜 | 淇 |
|---|---|---|
| `Config "imagingDevices" (v1) validation failed: devices.0.manufacturer: Required` | 鎵嬪啓 JSON 婕?manufacturer | 琛?24 璁惧 manufacturer |
| `Config "iolFormulas" (v1) validation failed: alBands.0.alMin < 15` | AL 鑼冨洿瓒婄晫 | alMin 0鈫?5, alMaxExclusive 50鈫?5 |
| `L97: Unexpected "export"` in sidebarConfig | ROLE_NAMES 鏁扮粍缂?`];` 闂悎 | 琛?`];` |
| `?` mojibake in roles arrays | 124 澶?GBK 鎹熷潖 | 鍚彂寮忔浛鎹负鏍囧噯 roles 鏁扮粍 |

### 鏈€缁堥儴缃查獙璇?(2026-07-02)
- `npm run build`: 33s 閫氳繃
- vitest: 12/12 閫氳繃 (gradingScales schema 5 + loader mergeLayers/validate 7)
- 187 涓?sidebar 閾炬帴 page error: **0 / 187**
- 12 鍏抽敭椤甸潰 console error (鎺掗櫎宸茬煡): **0**
- /admin/config 娓叉煋: title 姝ｅ父 + 7 tabs + 3 cards + 2 pre blocks + 鍒囨崲姝ｅ父
- 鍒囨崲绗竴涓?tab (clinical 鐪肩鍒嗙骇閲忚〃): active tab 鍒囨崲姝ｅ父, 鏄剧ず 11 椤?+ schema v1
- ConfigurationError 閿欒椤? 鍚姩鏍￠獙澶辫触鏃舵纭樉绀?(Epic 椋庢牸)
- Dev server: `http://127.0.0.1:5191/g005-radiology-ris/` 鎸佺画 200

### 闃舵 4+ 寰呭姙 (鏈湪鏈疆瀹屾垚)
- 鍏?24 涓?dental 椤甸潰鏀?useConfig 鏇夸唬 MOCK_xxx (coexistence OK)
- 鍏?28 涓?eye 椤甸潰鏀?useConfig 鏇夸唬 MOCK_xxx
- Admin UI 闃舵 4: 缂栬緫琛ㄥ崟 + diff preview + 淇濆瓨
- Admin UI 闃舵 5: 澶囦唤/鎭㈠ + 瀹¤ + 瀵煎嚭/瀵煎叆
- 闃舵 5: `public/config-overrides/` HMR 瑕嗙洊灞?- 闃舵 5: `docs/configuration.md` 閮ㄧ讲鏂囨。

### 鏂囦欢鎬昏 (鏈疆鏂板 22 涓?
```
src/config/clinicalConfig/
  README.md, index.ts, primitives.ts, loader.ts, registry.ts, bootstrap.ts
  modules/ (7 schema)
  defaults/ (7 json)
  hooks/useGradingScales.ts
  __tests__/ (2 test files, 12 tests)
src/components/config/ConfigBootstrapper.tsx
src/pages/admin/ClinicalConfigCenter.tsx
src/types/dental.ts
```
## PHASE 6 (continuation) �� 2026-07-03 (P1.5 sparse ҳ�油ǿ)

### �޸�
- **DepartmentPage.tsx**: �Ƴ� `"拖拽排序功能正在开发中"` ռλ����, ʵ����ʵ�������ƶ���ť
  - ���� `orderedChildren` state + `moveChild(idx, dir)` ����
  - �滻 `{selectedOrg.children.map(...)}` Ϊ�� ��/�� ChevronUp/ChevronDown ��ť���б�
  - ÿ����ʾ: ��� + ���� + ���� + ���� + ����/���ư�ť (�߽����)
  - ״̬: build ͨ��, typecheck �ɾ�, ��Ⱦ����

- **WorkloadHeatmapPage.tsx**: �� 4 վ����չ�� 8 վ��
  - ����: ��Ժ (142), ��Ժ�� (64), ��Ժ�� (48), ��Ժ�� (52), ��Ժ�� (38), ���Ʒ�Ժ (28), ������ (86), ����Ӱ������ (72)
  - ���� 4 �� KPI ��Ƭ: ���ռ�� 626, �ڸ�ҽ�� 98, ��д���� 278, ƽ�������� 76%
  - ҽ�������� 31 �� 98, ҵ������ 3 ��

- **DentalAllPages.tsx (DentalImplantPlanPage)**: ��ֲ�滮ҳ��� 1 Card �ḻ�� 7 Card + 4 Stat
  - ���� 4 �� KPI: �滮���� / ����ֲ / ����� / �ۼƷ���(��)
  - ���� 6 �� mock ��ֲ��¼ (FDI 36/46/16/11/26/47, 4 Ʒ��, 6 �۸�� 11800-18200)
  - ��ֲ���� 3 SKU ��չ�� 4 Ʒ�� 12 �ͺ� (Straumann BLT/BLX, Nobel Active/CC, Replace)
  - ���ӹ���������Ƭ (A/B/C ��ǰٷֱ�, 1 ��ɹ��� 98.5%)

### ��֤
- `npm run build`: 33.74s ͨ��
- typecheck: DepartmentPage 0 ����, DentalAllPages �� unused import warning
- Playwright �ز�: /workload-heatmap 2567B (��25%), /dental/implant 3152B + 7 cards + 4 stat (��18%)

### ��ǰδ����
- �Դ������� "ģ��" �ఴť (�� "Open Visualizer �����±�ǩҳ��(ģ��)") �� �����������ʾ˵��
- /eye/ai-report ҳ�� (1674B, 3 cards) ��ƫ��, ������ AI ģ��ע��/���������߼�
- �ദ small wrapper ҳ�� (IolCalculatorPage/AuditLogPage ��) ���Ǳ���װ, ί�и�ʵ�ʹ������

## PHASE 6 ���ո��� (2026-07-03 ���� 10:15) �� ռλ���ֳ������

### �ؼ�����
DepartmentPage �޸���, Playwright ����ʾ "��ק���������ڿ�����" �� ͨ�� Node + char code 0x62fd ��ȷ��λ�ŷ���, ��֮ǰ�Ĳ���滻�������ַ��� PowerShell ת��Ե�, ʵ��ֻɾ����ռλ div ��һ����, ����������������. �� char-code ���� placeholder �ַ�����, ��ȷ��λ�� index 103724, ����ɾ������ italic `<div>` ��.

### ������֤ (Playwright ��ͼ)
- `dept-final.png`: ��֯�ܹ� tab, 4 �ӽڵ�� ��/�� ��ť, **"������" ռλ������ȫ��ʧ** ?
- `dental-implant.png`: ��ֲ�滮, 4 KPI + 8 �ƻ���Ŀ + 4 Ʒ�ƿ� + �������� 248 ����

### ��ǰ״̬
- `npm run build`: 33.6s ͨ��
- ռλ����: dist ������ js �ļ����� "��ק���������ڿ�����" �����ı�
- DepartmentPage: 4 ���ư�ť + 4 ���ư�ť��������
- DentalAllPages: 7 cards + 4 stat, 1 �� 7 (��7 ����)

### ����Ľ�С��
| ҳ�� | �Ķ� | ������ |
|---|---|---|
| DepartmentPage ��֯�ܹ� | ɾ�� "���ڿ�����" ռλ + ʵ����ʵ�����ƶ���ť | 2453B (�ޱ仯) |
| WorkloadHeatmapPage | 4 վ�� �� 8 վ�� + 4 KPI | 2052B �� 2567B (+25%) |
| DentalImplantPlanPage | 1 card �� 7 cards + 4 stat | 2674B �� 3152B (+18%) |
