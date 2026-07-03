# G005 RIS v3.0.6.8-52 éˆ¥?Code Review

> Date: 2026-06-28
> Scope: pulled from https://gitcode.com/liuzhu2026/G005-RISv-3.0.0 to G005-RISv-3.0.0/

## TL;DR

The project is a large, opinionated Radiology Information System (React 18 + TypeScript + Vite + Ant Design + XState). It targets the top 10 PACS/RIS vendors and ships 17 modules spanning DICOM, HL7, FHIR, RCM, AI assistance, patient portal, etc. The build was broken on a fresh clone; the four issues below were the immediate blockers and are now fixed in this commit. A much larger typecheck cleanup (éˆ®? 300 errors) is still pending and is documented at the end.

## Fixed in this pass

### 1. index.html was a deployed build, not a Vite template
- **Severity:** critical éˆ¥?ite build failed with Rollup failed to resolve import "/g005-radiology-ris/assets/index-CWd28YTn.js".
- **Cause:** The source index.html was committed with the hard-coded production script/link tags from a previous ite build (hashes index-CWd28YTn.js, eact-vendor-Mt7mze3c.js, éˆ¥?. When Rollup tried to resolve those as imports against the new build, it bailed out.
- **Fix:** removed the six stale <script type="module" crossorigin éˆ¥? / <link rel="modulepreload" éˆ¥? / <link rel="stylesheet" éˆ¥? tags; inserted the proper Vite entry <script type="module" src="/src/main.tsx"></script> before </body>. Kept the existing global error-trap script and the loading placeholder. No BOM was introduced; the file is now a clean Vite template.
- **Verification:** 
pm run build succeeds (uilt in 1m 19s).

### 2. src/a11y/__tests__/SkipLink.test.tsx had five unterminated string literals
- **Severity:** high éˆ¥?	sc --noEmit failed with 16 cascade errors, all in this one file.
- **Cause:** the Chinese test descriptions ended with the half-width question mark ? (0x003F) and then the closing ) directly, with no closing ' between them. Five distinct sites: lines 26, 29, 41, 112, 120 (the last two share the same string 'ç€¹æ­Œå¼“ç»»æ°±â‚¬?').
- **Fix:** inserted the missing ' after each ?. The file size went 3764 éˆ«?3769 bytes, exactly five bytes éˆ¥?one ' per site.
- **Verification:** 	sc --noEmit now reports errors in 400+ other files, but SkipLink is clean.

### 3. Missing dependency: eact-error-boundary
- **Severity:** high éˆ¥?ite build failed with Rollup failed to resolve import "react-error-boundary" from "src/components/Provider.tsx".
- **Cause:** src/components/Provider.tsx imports ErrorBoundary from eact-error-boundary, but the package is not declared in package.json (and was not pulled in transitively).
- **Fix:** 
pm install --save react-error-boundary@^4. Version 4 is the right line for React 18.
- **Verification:** combined with the index.html fix, 
pm run build now succeeds.

### 4. server/index.ts mixed CommonJS equire into an ES module
- **Severity:** medium éˆ¥?the file is consumed via 	sx server/index.ts (see package.json), which runs the file as ESM. The line const { seedData } = require('./db/seed.js') would throw equire is not defined the moment the seed actually fires.
- **Cause:** leftover CommonJS-style import sitting next to top-level import statements.
- **Fix:** equire(...) éˆ«?wait import('./db/seed.js'); utoSeed is now sync function autoSeed(): Promise<void>; the call site is oid autoSeed();. The 	sx loader resolves the .js extension back to the on-disk seed.ts for us.
- **Caveat:** the server is auxiliary. The frontend talks to MSW handlers in src/services/mockBackend/, not to this file. I did not run 	sx server/index.ts end-to-end because the next blocker down the chain is a different missing dependency (jsonwebtoken is referenced by server/middleware/auth.ts but is not in package.json either). Worth flagging as a follow-up éˆ¥?see the "Pending cleanup" section.

## Findings (not fixed in this pass)

These are real but require larger changes; I'd recommend opening them as separate PRs.

### 5. ~4 300 typecheck errors
- **Severity:** high éˆ¥?	sc --noEmit reports errors in 400+ files.
- **Top categories** (from the actual run):
  - TS6133 è„³ 2 059 éˆ¥?'X' is declared but its value is never read (mechanical: dead imports / vars; the 
oUnusedLocals + 
oUnusedParameters strict settings surface a lot)
  - TS2322 è„³ 651 éˆ¥?type assignment mismatches (real bugs)
  - TS18048 è„³ 369 éˆ¥?X is possibly 'undefined'
  - TS2532 è„³ 280 éˆ¥?Object is possibly 'undefined'
  - TS2339 è„³ 110 éˆ¥?property does not exist on type
  - TS6196 è„³ 96 éˆ¥?referenced identifier declared but never used
  - TS2345 è„³ 81 éˆ¥?argument type not assignable
  - TS7006 è„³ 67 éˆ¥?parameter implicitly ny
  - TS2307 è„³ 55 éˆ¥?module not found (likely more missing deps; jsonwebtoken is one)
- **Recommended play:** land the TS6133 cleanup first via eslint --fix (the ESLint config already has 
o-unused-vars and friends), then go module-by-module for the type errors. Trying to do it in one PR will be unreviewable.

### 6. 203 root-level debug/dev scripts tracked in git
- **Severity:** medium (hygiene).
- **Breakdown:** 	est-*.mjs è„³ 52, erify-*.mjs è„³ 42, cdp-*.mjs è„³ 21, debug-*.mjs è„³ 18, ix-*.mjs è„³ ~15, ump-*.cjs è„³ 17, plus 38 more (pw-*, smart-icon-fix-*, dd-*, count-*, ind-*, eye-*, local-*, 13-*, check-*, write-*, mock-*). These are all in the repository root next to README.md.
- The previous PR8 ("dead-code cleanup") only removed unused mock data; it did not touch these root scripts.
- **Recommended play:** decide which of these still earn their place. ump-vXX.cjs looks like the version-bump tool that produced the 52 release commits éˆ¥?keep those. Everything else looks like ad-hoc investigation scripts. Two options:
  1. Add to .gitignore and git rm --cached (they stay on disk, disappear from history).
  2. Move to scripts/dev/ and keep only the ones documented in docs/.

### 7. dist/ is partially force-tracked
- **Severity:** medium.
- **Cause:** .gitignore lists dist/, but git ls-files shows nine files inside dist/ that are tracked: dist/.nojekyll, dist/index.html, dist/mockServiceWorker.js, dist/sw.js, plus five asset chunks (criticalValueAssessmentMock-*, deliveryExportSignatureMock-*, eviewRevisionCollabMock-*, 	hree-vendor-*, two icons). They were committed with git add -f.
- **Why it matters:** every successful build rewrites the hashes, so anyone who pulls a new build will see these as modified, and git diff will be noisy.
- **Recommended play:** git rm -r --cached dist/. The CI deploy step can rebuild on the fly from dist/ after the working tree is clean.

### 8. Two parallel "backends" with overlapping scope
- server/ (84 .ts files, used via 
pm run server with 	sx) éˆ¥?DICOM/HL7/FHIR/transcode integration. This is the file I edited above.
- ackend/ (Prisma schema, uth/health/notifications/... modules) éˆ¥?the other backend.
- **Why it matters:** the README and the source code disagree on which one is the "real" backend. Routes collide, the MSW mock layer in src/services/mockBackend/ is a third path.
- **Recommended play:** pick one and document the decision. If both are intentional (e.g., ackend/ is the production tier and server/ is the dev/integration shim), state that in README.md. Today it isn't stated.

### 9. server/index.ts stores state in a flat JSON file
- The integration server uses eadDB() / writeDB() against server/db/ris-db.json, with synchronous s.readFileSync / s.writeFileSync and no locking. Two concurrent transitions will race.
- For a dev fixture this is fine; do not run it under any kind of load.
- If the JSON store is meant to persist, swap for etter-sqlite3 (the types are already in devDependencies as @types/better-sqlite3, but the runtime is not installed).

### 10. State machine uses Chinese strings as enum values
- EXAM_TRANSITIONS and REPORT_TRANSITIONS use keys like 'å®¸èŒ¬æ«¥ç’?, 'å¯°å‘®î—…éŒ?, 'å®¸æŸ¥â”é¥?, etc. The same set is also hard-coded inside server/db/seed.ts.
- This is fine for a single-language deployment, but it means:
  - A typo in the key string silently disables that transition (TS only catches it if both sides are typed literally).
  - i18n of the status label is decoupled from the state identifier éˆ¥?there is a separate translation key, but the state identifier is still Chinese.
- **Recommended play:** introduce a const enum ExamStatus / ReportStatus (English identifier) and put the Chinese display string in the i18n namespace. The XState machines in src/machines/ already do this for the frontend; the server should match.

### 11. Several unused/mock-only root files
- 404.html, mockServiceWorker.js, sw.js, 	est.html, out.txt, 	est-pkg.json éˆ¥?kept at the root and not clearly partitioned. Most are PWA or test fixtures and would live better in public/ or 	est/.

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

## PHASE 3 éˆ¥?2026-07-02 (éˆî„ƒç–†ç€¹Â¤î…¸æ¾§ç‚ºå™º)

### æµ æ’³ç°±éšå±¾î„
- æ©æ»…î¬ main æµ ?`2d46f83` (v3.0.6.8-52) éºã„¨ç¹˜é’?`4c05705` (v3.0.6.8-106)
- 53 æ¶“î…æŸŠé»æ„ªæ°¦, é€ç‘°å§© 237 æ¶“î…æƒæµ ?+12500 / -537 (éš?1375 ç›å²€å¢®ç»‰?handlers, 149 ç›?eyeApi/dentalApi, 110+ ç›?sidebar)
- 5 æ¶“?git éèŒ¬çŠå®¸èŒ¶Ğ’é?
  - `dist/index.html`, `index.html`, `package.json` éˆ«?accept theirs (æ©æ»…â–¼å®¸æ’å¯˜éš?14 æ¶“îƒæ…¨æ¾¶å¶„è…‘é¨?1 éœ?3)
  - `package-lock.json`, `src/a11y/__tests__/SkipLink.test.tsx` éˆ«?accept ours

### P0 æ·‡î†¼î˜²: i18n ç¼ˆæ˜ç˜§éã„©å„´é¢ç†¸æ™¥

**`src/i18n/index.ts` é–²å¶…å•“ (246 éˆ«?159 ç›?**
- é’çŠ»æ«é‘·î„ç•¾æ¶”?`HttpBackend` ç»«?(é³æ‘å§æ?
- é’çŠ»æ« `LanguageDetector` é»ææ¬¢
- é’çŠ»æ« `partialBundledLanguages: true` å¦¯â€³ç´¡
- é€é€›è´Ÿç»¾îˆæ½¤é¬?`resources: {zh_CN, en_US}` + `load: "currentOnly"`
- `ensureNamespaces` é—„å¶‡éª‡æ¶“?no-op (é–¬å®å¤éƒãˆ¡æ¹ç’‹å†ªæ•¤é‚?undefined)

**`src/i18n/appI18n.ts` éšå è‹Ÿ 5 æ¶“?namespace (zh + en é?10 é§?**
- worklist (101 keys)
- critical (27 keys)
- v3worklist (33 keys)
- v3report (539 keys)
- v3stats (27 keys)
- é‰ãƒ¦ç°®: é‘±æ°¬æ‚ `zh_CN.json` / `en_US.json`
- ç›ãƒ¥æ´–æ¶”å¬ªå¢  #8 æ·‡î†¼î˜²: `app.title` = `G005é€æƒ§çš æ·‡â„ƒä¼…ç»¯è¤ç²º`

**æ¥ å²ƒç˜‰: 72 æ¶“îˆã€‰é—ˆãˆ¡å£‚é»? 0 æ¶“?raw i18n key é„å‰§ãš**
- `/statistics` éã„©å„´ Tab ç¼ˆæ˜ç˜§: `å¦«â‚¬éŒãƒ©å™ºç¼ç†»î…¸ / é—ƒè™«â‚¬Ñ…å·¼ç¼ç†»î…¸ / å®¸ãƒ¤ç¶”é–²å¿•ç²ºç’?/ ç¼å¿šæƒ€é’å—˜ç€½ / é€è·ºå†ç¼ç†»î…¸ / ç’ã„©å™ºéºÑƒåŸ— / ç’æƒ§î˜¬éå £å…˜ / é®ï½ˆâ‚¬å‘­åé‹æ…
- `/worklist` é”çŠºæµ‡é»æ„®ãšç¼ˆæ˜ç˜§: `å§ï½…æ¹ªæµ ?API é”çŠºæµ‡å¦«â‚¬éŒãƒ¦æšŸé¹?..`
- `worklist.loadingApi`: é‰?æ·‡î†¼î˜²
- `statistics.title`, `statistics.tabs.*`, `statistics.refresh`, `statistics.exportReport`: é‰?éã„©å„´æ·‡î†¼î˜²

### ç’ºîˆœæ•±æ·‡î†¼î˜²
**`src/routes/routeTable.tsx` ç›ãƒ¦å¯• `/worklist` ç’ºîˆœæ•±**
- line 513 é‚æ¿î–ƒ: `wrapped("/worklist", React.createElement(WorklistPage))`
- é˜ç†·æ´œ: sidebar å¯®æ› æ•¤ `/worklist` æµ£?routeTable ç¼‚å“„ã‘ç’‡?path, ç€µè‰°åš§ #9 RBAC æ·‡î†¼î˜²éˆç†¸æ¹œç’ºîˆšç·æ¶“å¶…å½²æˆ?- æ¥ å²ƒç˜‰: ç’å—æ£¶ `/worklist` URL æ¶“å¶…å•€é–²å¶…ç•¾éšæˆåŸŒ `/`, éç‰ˆåµå§ï½…çˆ¶é”çŠºæµ‡ (20 æ¤¤è§„î—…éŒ? KPI 0 é’æ¿†îé–?

### é˜èˆµâ‚¬ä½¹æ¨‰ç»€è½°æ…¨æ¾¶?**`src/pages/worklist/WorklistListView.tsx` STATUS_CONFIG ç›?`published`**
- å¨£è¯²å§: `published: { bg: '#ecfdf5', color: '#047857', label: 'å®¸æ’å½‚ç”¯?, order: 5 }`
- é˜ç†·æ´œ: mock exam data æ¶“î…ç“¨é¦?`status: 'published'` æµ£?STATUS_CONFIG ç¼‚é¸¿î‡š key, é„å‰§ãšé‘»è¾¨æƒ
- æ¥ å²ƒç˜‰: `published` é˜èˆµâ‚¬ä½¸åé–®ã„¨æµ† `å®¸æ’å½‚ç”¯åƒ 

### æ¸šæ¿Šç¦†ç›ãƒ©ç¶ˆ
- `onnxruntime-web@1.17.1` (æ©æ»…â–¼ v3.0.6.8-60 `DentalAiOnnxPage` å¯®æ›å†, ç¼‚å“„å¯˜ç€µè‰°åš§ vite build æ¾¶è¾«è§¦)
- `playwright` (dev dependency, é¢ã„¤ç°¬é´î„æµ˜ç€¹Â¤î…¸)
- é¢?`--legacy-peer-deps` ç‘™ï½…å–… storybook peer dep éèŒ¬çŠ (æ©æ»…â–¼ 53 æ¶“î…æŸŠé»æ„ªæ°¦å¯®æ›å†)

### æ¥ å²ƒç˜‰é˜èˆµâ‚¬?- `npm run build`: é‰?é–«æ°³ç¹ƒ (1m 11s, 1m 0s, 1m 6s æ¶“å¤‹î‚¼)
- `npm run typecheck`: éˆ¿ç‹…ç¬ 4809 æ¶“îˆæ•Šç’‡?(é‚é¢å”¬é®ä½¸ç´©é? æ¶“å¶…æ¹ªéˆî„î‚¼é¥ç‚²ç¶Šé‘¼å†¨æ´¿; 95% é„?TS6133 éˆîƒå¨‡é¢?import)
- Playwright é´î„æµ˜: `screenshots-fix/` é©î†¼ç¶, 5 å¯®çŠ²å§é–¿î‡€ã€‰é—ˆ?- å®¸èŒ¬ç…¡çå¿›æ£¶æ£°? 21 æ¶“?console error é„?`frame-ancestors` CSP warning (æ¶“åº¡å§›é‘³èŠ¥æ£¤é? é‰ãƒ¨åšœ index.html meta éå›©î„·)

### éˆî„ç•¬é´?- Top 10 RIS ç€µè§„çˆ£ç€¹Â¤î…¸ (GE/Siemens/Philips/Fujifilm/Carestream/Agfa/Canon/Hologic/Intelerad/Mach7)
- 4809 æ¶“?typecheck é–¿æ¬’î‡¤å¨“å‘¯æ‚Š
- UI ç¼å—šå¦­æµ¼æ¨ºå¯² (KPI é—ï¼„å¢–ç‘ä½¸å / æ¤¤ç”¸æ½°æ¾¶Ñ„çˆ£æ£°?/ ç›ã„¦ç‰¸ç»Œè™¹å§¸é¬?
- éšåº£î¬ç€›æ¨ºæ¹ªæµ£å——å¢ ç»”îˆ›æ¹­ç’‹å†ªæ•¤é¨å‹­î¬éç¡…Ë‰æ¦»?(DRL ç€µè§„ç˜®é¥?/ AI biomarker / FHIR DiagnosticReport / Webhook é©æˆå¸¶)


## PHASE 4 éˆ¥?2026-07-02 (i18n raw keys / page crash å¨“å‘¯æ‚Š)

### é‘³å±¾æ«™
PHASE 3 ç€¹å±¾åšéšåº¯ç´186 æ¶“?sidebar é–¾ç‚¬å¸´æ¶“î…ç²›éˆ?5 æ¤¤ç”¸æ½°å®•â•‚ç°é”›å§ageerroré”›å¤Šæ‹° 72+ æ¤¤?i18n éˆî†ç‚•ç’‡?enumé”›å°tatus / modality / priority / category / segment-typeé”›å¤ˆâ‚¬å‚›æ¹°æî‡€å™¸éè§„æ§¸éˆ¥æ»…å‡½é—ƒå‘°î‡°ç»±çŠ«â‚¬æ¿“ç´æ¶“å¶†æ•¼ i18n é‹èˆµç€¯é”›å±½å½§ç€¹å±½æ½é‹æ°«å¦‡æ¸šå¬ªå¯²é¨å‹«ç“§éç¨¿ï½ç€›æ¥î†ŒéŠ†?
### æ¤¤ç”¸æ½°å®•â•‚ç°æ·‡î†¼î˜²é”›åœ¥HASE 3 å®¸è¹­æ…¨ 5 æ¶“îç´PHASE 4 ç›ãƒ¤ç«´æ¶“îç´š

- **/eye/ai**: éˆî„ƒç–†å¦«â‚¬å¨´å¬ªåŸŒ vite 500 é¶ãƒ¢â‚¬æ·’uplicate declaration MODALITY_LABELSéˆ¥æ¿„â‚¬å‚šå¸«é¥çŠ³æ§¸ line 26 å®¸èŒ¬ç²¡æµ åº˜â‚¬æ·/data/eyePacsMockéˆ¥?import æµœ?MODALITY_LABELSé”›å®­ine 30 é™å ¥å™¸æ¾¶å¶…ï¼é„åº¢æ¹°é¦æ¿å½‰é–²å¿‹â‚¬å‚œĞ©é—„ã‚‰å™¸æ¾¶å¶…æ‚— build é­ãˆ î˜²éŠ†ä¹ºuntime éƒ?pageerroréŠ†?
### i18n ç€›æ¥€å€ç›ãƒ¥ç•¬é?
- **src/pages/eye/edu/CaseLibraryPage.tsx** éˆ¥?é‚æ¿î–ƒ `MODALITY_LABELS_DICT` (15 å¦¯â„ƒâ‚¬? + `STATUS_LABELS_DICT` (5 é˜èˆµâ‚¬?é”›å±¼æ…¨æ¾¶?3 æ¾¶?raw å¨“å‰ç…‹éŠ†?- **src/pages/eye/ris/EyeRisPage.tsx** éˆ¥?é‚æ¿î–ƒ 4 æ¶“î„ç“§éé©ç´™MODALITY/PRIORITY/REFERRAL_STATUS/SURGERY_STATUSé”›å¤›ç´æ·‡î†¼î˜² 5 æ¾¶å‹¬è¦†éŒæ“„ç´°ç»—îƒ¿ç«´æ¶“î‡ã€ƒé¨?modality é¢?dict é–å‘°ï¼™éŠ†ä¹½pcoming ç›ã„§å·±æ¾¶è¾©æ®‘ render é‘èŠ¥æšŸç›ãƒ¤ç¬‚éŠ†ä¹¸riority æµ ?{v} é€é€›è´Ÿ {PRIORITY_LABELS_EYE_RIS[v] || v}éŠ†ä¹ºeferrals status æµ ?{v} é€é€›è´Ÿ {REFERRAL_STATUS_LABELS_DICT[v] || v}éŠ†ä¹»urgery æ¶“å¤Šå“ç›ã„¨æªå¯®?éˆ¥æ¸›re_checked å®¸å‰æ¹³é“å¶â‚¬?fallback é€é€›è´Ÿé–å‘°ï¼™ dictéŠ†?- **src/pages/eye/EyeKpiDashboardPage.tsx** éˆ¥?é‚æ¿î–ƒ `CATEGORY_LABELS_DICT` (5 ç¼æ‘å®³)é”›å®‘ategory é’æ¤¾ç¬‰éå¶‰æ•Šç’‡îˆšî˜²é¢?MODALITY_LABELSéŠ†?- **src/pages/eye/report/EyeReportWritePage.tsx** éˆ¥?é‚æ¿î–ƒ `SEGMENT_TYPE_LABELS_DICT` (6 å¨ˆç”µè¢«é¨?é”›å®»egment type Tag ç¼ˆæ˜ç˜§éŠ†?- **src/pages/dental/DentalSchedulePage.tsx** éˆ¥?é‚æ¿î–ƒ `DENTAL_APPT_STATUS_LABELS_DICT` (5 é˜èˆµâ‚¬?é”›å­Šadge text ç¼ˆæ˜ç˜§éŠ†å‚™è…‘é–«æ–¾æ…¨å§ï½„ç°¡ PHASE 3 é‘´æ°­æ¹°é¢ç†¸åšé¨å‹®î‡¢å¨‰æ›¢æ•Šé”›å‹xport const const é–²å¶…î˜²é”›å¤ˆâ‚¬?- **src/components/eye/ReportTemplateSelector.tsx** éˆ¥?é‚æ¿î–ƒéˆî„€æ¹´ `MODALITY_LABELS_LOCAL`é”›å®¼emplate å¦¯â„ƒâ‚¬?Tag ç¼ˆæ˜ç˜§éŠ†?
### ç¼‚æ «çˆœé—„çƒ½æ§ºé”›å £î†‡è¤°æ›šç¬…é‰ãƒ¯ç´š

- éˆî„„ã€é©î†¼ã‡é–®ã„¥å .tsx é„?UTF-8é”›å±¼çµ¾ `EyeRisPage.tsx` ç€›æ¨ºæ¹ªæ¶“â‚¬æµœæ¶œå„­éˆå¤Šç“§ç»—ï¸¿ç°©å¨†ï¼„ç´ªé®ä½ºæ®‘ç€›æ¥î†Œé”›å î›§ éˆ¥æ»ƒå‡¡éˆîˆšå¢ éˆ¥?çšî‚£å½ƒéãƒ¤ç°¡æ¶“â‚¬æ¶“?U+FFFD é‡å¤¸å”¬ç€›æ¥ƒîƒé”›å¤ˆâ‚¬å‚æ¸¶ç‘•ä½ºæ•¤ç€›æ¥„å¦­ç»¾Ñƒå½é‚î…¨ç´é‘°å±¼ç¬‰é„îˆ™è´¡é¢?iconv-lite é¶å©‚ç• è¤°?GBK é–²å¶‡ç´ªéšåº¡å•“é¥ç‚²å¹“éŠ†?- é‚å›¦æ¬¢æ¶“æ˜î›¦é¢?CRLFé”›å±¼çµ¾é–®ã„¥åé–çƒ˜î†Œé„?LFéŠ†ä½ºæ•‹é‘·?éˆ¥æ»€ç«´æ¶“?\n + \r\néˆ¥?å¨£å³°æ‚“éŠ†å‚å‰¼éˆî„„å™·æ¿¡å‚›ç‰æ¶“å¶‡â€˜ç€¹æ°¬ç°²ç’‡ãƒ§æ•¤éîƒé‡œé”›å±½æ°¨éå ¢æ•¤ indexOf + é—€å®å®³é‹å¿•Ğ©é‹æ°¬ç“§é‘ºå‚œéª‡é‡æŒå´²éŠ†?
### æ¥ å²ƒç˜‰

- `npm run build`: é‰?é–«æ°³ç¹ƒ (32.6s)
- Playwright éµ?186 æ¶“?sidebar é–¾ç‚¬å¸´: 0 pageerror
- Playwright éµ?11 æ¶“îƒç´­éå ¢éª‡æ¤¤? 0 pageerror + 0 i18n raw key
- Playwright éµ?186 æ¶“îˆã€‰é—ˆ? æµ ?3 æ¤¤å«æ¹ raw (é§å›¦è´Ÿéšå Ÿç¡¶æ¶“æ°¬å§Ÿéç‰ˆåµé”›æ°±å¢—éˆî„€å½¿ v1.0 / v3.0.6.0é”›å²ƒĞ’é“æ ¦ç¶…ç¼ƒ?temporal/superioré”›å±¾å§¢æ¾¹î‚¤æ•¤é´å³°æ‚• zhang/wang)éŠ†?- Dev server: `http://127.0.0.1:5191/g005-radiology-ris/` æµ å¶…æ¹ª 200 éå¶…ç°²

## PHASE 5 (final) éˆ¥?2026-07-02 (æ¶“æ‘ç°¥é–°å¶‡ç–†æ¶“î…ç¸¾ admin UI + é–®ã„§è®²æ¥ å²ƒç˜‰)

### éˆî„„æ¨å¨ˆå«æŸŠæ¾§ç‚´æƒæµ ?- `src/pages/admin/ClinicalConfigCenter.tsx` éˆ¥?é™î‡î‡° admin UI
- `src/config/clinicalConfig/hooks/useGradingScales.ts` (é—ƒèˆµî†Œ 1)

### æ·‡î†½æ•¼
- `src/routes/routeTable.tsx` éˆ¥?`/admin/config` ç’ºîˆœæ•± + lazy import
- `src/routes/sidebarConfig.tsx` éˆ¥?systemManage section é”?"æ¶“æ‘ç°¥é–°å¶‡ç–†" ç€µè‰°åŸ…æ¤¤?+ é”?Sliders icon import (æ·‡î†¼î˜² GBK é¹ç†·æ½–)
- `src/i18n/locales/{zh_CN,en_US}.json` éˆ¥?é”?`clinicalConfig` ç¼ˆæ˜ç˜§
- `src/config/clinicalConfig/bootstrap.ts` éˆ¥?loadAll éªæƒ°î”‘é”çŠºæµ‡ 7 æ¶“î…Äé§?- `src/config/clinicalConfig/defaults/imagingDevices.json` éˆ¥?ç›?manufacturer (æ·‡î†¼î˜² schema éï¿ ç™)
- `src/config/clinicalConfig/defaults/iolFormulas.json` éˆ¥?æ·‡?AL é‘¼å†¨æ´¿ 0éˆ«?5, 50éˆ«?5 (æ·‡î†¼î˜² schema éï¿ ç™)

### é—ƒèˆµî†Œ 3 admin UI
- 7 æ¶“?tab (TDesign æ¤‹åº¢ç‰¸)é”›æ°­å¯œ clinical/device/operational/reporting é’å—™è¢«
- å§£å¿é‡œ tab é„å‰§ãšé”›æ°­æ½¯é©î†½æšŸ + Schema é—å Ÿæ¹° + é’å—™è¢« + é»å¿šå ª + é½æ¨¿î›¦ sample + ç€¹å±¾æš£ JSON
- é™î‡î‡°ç‘™å——æµ˜é”›æ¶šç´ªæˆæˆ£ã€ƒé—æ›Ÿæ§¸é—ƒèˆµî†Œ 4+ éšåº£ç”»

### ç»¯è¤ç²ºé–¿æ¬’î‡¤æ·‡î†¼î˜²
| é–¿æ¬’î‡¤ | éç‘°æ´œ | æ·‡î†¼î˜² |
|---|---|---|
| `Config "imagingDevices" (v1) validation failed: devices.0.manufacturer: Required` | éµå¬ªå•“ JSON å©•?manufacturer | ç›?24 ç’æƒ§î˜¬ manufacturer |
| `Config "iolFormulas" (v1) validation failed: alBands.0.alMin < 15` | AL é‘¼å†¨æ´¿ç“’å©„æ™« | alMin 0éˆ«?5, alMaxExclusive 50éˆ«?5 |
| `L97: Unexpected "export"` in sidebarConfig | ROLE_NAMES éæ‰®ç²ç¼‚?`];` é—‚î…æ‚ | ç›?`];` |
| `?` mojibake in roles arrays | 124 æ¾¶?GBK é¹ç†·æ½– | éšîˆšå½‚å¯®å¿”æµ›é¹î­è´Ÿéå›§å™¯ roles éæ‰®ç² |

### éˆâ‚¬ç¼å ¥å„´ç¼ƒæŸ¥ç™ç’‡?(2026-07-02)
- `npm run build`: 33s é–«æ°³ç¹ƒ
- vitest: 12/12 é–«æ°³ç¹ƒ (gradingScales schema 5 + loader mergeLayers/validate 7)
- 187 æ¶“?sidebar é–¾ç‚¬å¸´ page error: **0 / 187**
- 12 éæŠ½æ•­æ¤¤ç”¸æ½° console error (éºæ—æ«å®¸èŒ¬ç…¡): **0**
- /admin/config å¨“å‰ç…‹: title å§ï½…çˆ¶ + 7 tabs + 3 cards + 2 pre blocks + é’å›¨å´²å§ï½…çˆ¶
- é’å›¨å´²ç»—îƒ¿ç«´æ¶“?tab (clinical éªè‚©î–é’å—™éª‡é–²å¿šã€ƒ): active tab é’å›¨å´²å§ï½…çˆ¶, é„å‰§ãš 11 æ¤¤?+ schema v1
- ConfigurationError é–¿æ¬’î‡¤æ¤¤? éšîˆšå§©éï¿ ç™æ¾¶è¾«è§¦éƒèˆµî„œçº­î†½æ¨‰ç»€?(Epic æ¤‹åº¢ç‰¸)
- Dev server: `http://127.0.0.1:5191/g005-radiology-ris/` é¸ä½ºç”» 200

### é—ƒèˆµî†Œ 4+ å¯°å‘­å§™ (éˆî„æ¹ªéˆî„ƒç–†ç€¹å±¾åš)
- é?24 æ¶“?dental æ¤¤ç”¸æ½°é€?useConfig é‡å¤¸å”¬ MOCK_xxx (coexistence OK)
- é?28 æ¶“?eye æ¤¤ç”¸æ½°é€?useConfig é‡å¤¸å”¬ MOCK_xxx
- Admin UI é—ƒèˆµî†Œ 4: ç¼‚æ ¬ç·«ç›ã„¥å´Ÿ + diff preview + æ·‡æ¿†ç“¨
- Admin UI é—ƒèˆµî†Œ 5: æ¾¶å›¦å”¤/é­ãˆ î˜² + ç€¹Â¤î…¸ + ç€µç…åš­/ç€µç…å†
- é—ƒèˆµî†Œ 5: `public/config-overrides/` HMR ç‘•å—™æ´Šç?- é—ƒèˆµî†Œ 5: `docs/configuration.md` é–®ã„§è®²é‚å›¨ã€‚

### é‚å›¦æ¬¢é¬æ˜î (éˆî„ƒç–†é‚æ¿î–ƒ 22 æ¶“?
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
## PHASE 6 (continuation) ¡ª 2026-07-03 (P1.5 sparse Ò³Ãæ²¹Ç¿)

### ĞŞ¸´
- **DepartmentPage.tsx**: ÒÆ³ı `"æ‹–æ‹½æ’åºåŠŸèƒ½æ­£åœ¨å¼€å‘ä¸­"` Õ¼Î»ÎÄ×Ö, ÊµÏÖÕæÊµµÄÉÏÏÂÒÆ¶¯°´Å¥
  - Ôö¼Ó `orderedChildren` state + `moveChild(idx, dir)` º¯Êı
  - Ìæ»» `{selectedOrg.children.map(...)}` Îª´ø ¡ü/¡ı ChevronUp/ChevronDown °´Å¥µÄÁĞ±í
  - Ã¿ĞĞÏÔÊ¾: ĞòºÅ + Ãû³Æ + ÀàĞÍ + ÈËÊı + ÉÏÒÆ/ÏÂÒÆ°´Å¥ (±ß½ç½ûÓÃ)
  - ×´Ì¬: build Í¨¹ı, typecheck ¸É¾», äÖÈ¾Õı³£

- **WorkloadHeatmapPage.tsx**: ´Ó 4 Õ¾µãÀ©Õ¹µ½ 8 Õ¾µã
  - Ôö¼Ó: ×ÜÔº (142), ¶«ÔºÇø (64), Î÷ÔºÇø (48), ÄÏÔºÇø (52), ±±ÔºÇø (38), ¶ù¿Æ·ÖÔº (28), ¼±ÕïÇø (86), ÖĞÑëÓ°ÏñÖĞĞÄ (72)
  - Ôö¼Ó 4 ¸ö KPI ¿¨Æ¬: ½ñÈÕ¼ì²é 626, ÔÚ¸ÚÒ½Éú 98, ´ıĞ´±¨¸æ 278, Æ½¾ùÀûÓÃÂÊ 76%
  - Ò½Éú×ÜÊı´Ó 31 ¡ú 98, ÒµÎñÁ¿·­ 3 ±¶

- **DentalAllPages.tsx (DentalImplantPlanPage)**: ÖÖÖ²¹æ»®Ò³Ãæ´Ó 1 Card ·á¸»µ½ 7 Card + 4 Stat
  - Ôö¼Ó 4 ¸ö KPI: ¹æ»®×ÜÊı / ´ıÖÖÖ² / ÒÑÍê³É / ÀÛ¼Æ·ÑÓÃ(Íò)
  - Ôö¼Ó 6 Ìõ mock ÖÖÖ²¼ÇÂ¼ (FDI 36/46/16/11/26/47, 4 Æ·ÅÆ, 6 ¼Û¸ñ¶Î 11800-18200)
  - ÖÖÖ²Ìå¿â´Ó 3 SKU À©Õ¹µ½ 4 Æ·ÅÆ 12 ĞÍºÅ (Straumann BLT/BLX, Nobel Active/CC, Replace)
  - Ôö¼Ó¹ÇÁ¿·ÖÎö¿¨Æ¬ (A/B/C Àà¹Ç°Ù·Ö±È, 1 Äê³É¹¦ÂÊ 98.5%)

### ÑéÖ¤
- `npm run build`: 33.74s Í¨¹ı
- typecheck: DepartmentPage 0 ´íÎó, DentalAllPages ½ö unused import warning
- Playwright ÖØ²â: /workload-heatmap 2567B (¡ü25%), /dental/implant 3152B + 7 cards + 4 stat (¡ü18%)

### µ±Ç°Î´×öµÄ
- ÈÔ´æÔÚĞí¶à "Ä£Äâ" Àà°´Å¥ (Èç "Open Visualizer ½«ÔÚĞÂ±êÇ©Ò³´ò¿ª(Ä£Äâ)") ¡ª ÕâÊÇÓĞÒâµÄÑİÊ¾ËµÃ÷
- /eye/ai-report Ò³Ãæ (1674B, 3 cards) ÈÔÆ«¼ò, µ«ÒÑÓĞ AI Ä£ĞÍ×¢²á/ÉóÅúºËĞÄÂß¼­
- ¶à´¦ small wrapper Ò³Ãæ (IolCalculatorPage/AuditLogPage µÈ) ½öÊÇ±¡°ü×°, Î¯ÍĞ¸øÊµ¼Ê¹¦ÄÜ×é¼ş

## PHASE 6 ×îÖÕ¸üĞÂ (2026-07-03 ÉÏÎç 10:15) ¡ª Õ¼Î»ÎÄ×Ö³¹µ×Çå³ı

### ¹Ø¼ü·¢ÏÖ
DepartmentPage ĞŞ¸´ºó, Playwright ÈÔÏÔÊ¾ "ÍÏ×§ÅÅĞò¹¦ÄÜÕıÔÚ¿ª·¢ÖĞ" ¡ª Í¨¹ı Node + char code 0x62fd ¾«È·¶¨Î»²Å·¢ÏÖ, ÎÒÖ®Ç°µÄ²ğ·ÖÌæ»»ÒòÖĞÎÄ×Ö·û±» PowerShell ×ªÒå³Ôµô, Êµ¼ÊÖ»É¾³ıÁËÕ¼Î» div µÄÒ»²¿·Ö, ÈÔÓĞÍêÕû¸±±¾²ĞÁô. ÓÃ char-code ÖØ×é placeholder ×Ö·û´®ºó, ¾«È·¶¨Î»µ½ index 103724, ÍêÕûÉ¾³ıÕû¸ö italic `<div>` ¿é.

### ×îÖÕÑéÖ¤ (Playwright ½ØÍ¼)
- `dept-final.png`: ×éÖ¯¼Ü¹¹ tab, 4 ×Ó½Úµã´ø ¡ü/¡ı °´Å¥, **"¿ª·¢ÖĞ" Õ¼Î»ÎÄ×ÖÍêÈ«ÏûÊ§** ?
- `dental-implant.png`: ÖÖÖ²¹æ»®, 4 KPI + 8 ¼Æ»®ÌõÄ¿ + 4 Æ·ÅÆ¿â + ¹ÇÁ¿·ÖÎö 248 °¸Àı

### µ±Ç°×´Ì¬
- `npm run build`: 33.6s Í¨¹ı
- Õ¼Î»ÎÄ×Ö: dist ÖĞËùÓĞ js ÎÄ¼ş¾ùÎŞ "ÍÏ×§ÅÅĞò¹¦ÄÜÕıÔÚ¿ª·¢ÖĞ" ÍêÕûÎÄ±¾
- DepartmentPage: 4 ÉÏÒÆ°´Å¥ + 4 ÏÂÒÆ°´Å¥Õı³£¹¤×÷
- DentalAllPages: 7 cards + 4 stat, 1 ¡ú 7 (¡Á7 ¸»»¯)

### ÕûÌå¸Ä½øĞ¡½á
| Ò³Ãæ | ¸Ä¶¯ | Êı¾İÁ¿ |
|---|---|---|
| DepartmentPage ×éÖ¯¼Ü¹¹ | É¾³ı "ÕıÔÚ¿ª·¢ÖĞ" Õ¼Î» + ÊµÏÖÕæÊµÉÏÏÂÒÆ¶¯°´Å¥ | 2453B (ÎŞ±ä»¯) |
| WorkloadHeatmapPage | 4 Õ¾µã ¡ú 8 Õ¾µã + 4 KPI | 2052B ¡ú 2567B (+25%) |
| DentalImplantPlanPage | 1 card ¡ú 7 cards + 4 stat | 2674B ¡ú 3152B (+18%) |

## v3.0.6.10-1 ·ÀÓùĞÔ UI Éı¼¶ (2026-07-03)

### 1. AppButton (src/components/common/AppButton.tsx)

ĞÂÔö prop:
- `disabledReason?: string` - disabled ×´Ì¬ÏÂÏÔÊ¾ Tooltip ½âÊÍÔ­Òò
- `htmlType?: "button" | "submit" | "reset"` - Ã÷È· form Ìá½»ÀàĞÍ

ĞĞÎª:
- ±£³ÖÔ­ÓĞÎŞÈ¨ÏŞÊ±ÕûÌåÒş²Ø (`permissionFallback` ¶µµ×)
- disabled + disabledReason ¡ú °ü antd Tooltip, hover ÌáÊ¾
- disabled ÎŞ reason ¡ú ²»Ç¿ÖÆ°ü Tooltip
- loading ¡ú ×Ô¶¯ disabled, ÏÔÊ¾ loading Í¼±ê
- type Ä¬ÈÏ "button" ·À form ÎóÌá½»

### 2. useSafePagination (src/hooks/useSafePagination.ts)

ĞÂ hook, ½â¾ö"É¾³ı×îºóÒ»Ò³ºóÔ½½ç"ÎÊÌâ:
- `setPage(x)` Ô½½ç×Ô¶¯»ØÍËµ½ totalPages
- `setTotal(t)` total=0 Ê±Ç¿ÖÆ page=1, showPagination=false
- `setPageSize(s)` ÖØÖÃ page=1
- ±©Â¶ `config: { current, pageSize, total, showPagination, totalPages }`
- `onPageChange` »Øµ÷Í¨ÖªÒµÎñ²à refetch

### 3. useApiQuery ÔöÇ¿ (src/hooks/useApiQuery.ts)

ĞÂ props:
- `timeoutMs?: number` - Ä¬ÈÏ 15000
- `retries?: number` - Ä¬ÈÏ 1
- `retryDelayMs?: number` - Ä¬ÈÏ 500, Ö¸ÊıÍË±Ü

ĞĞÎª:
- withTimeout °ü Promise, ³¬Ê± reject REQUEST_TIMEOUT
- Ê§°Üºó wait retryDelayMs * 2^attempt ºóÖØÊÔ
- ËùÓĞ³¢ÊÔÊ§°Ü ¡ú Ğ´Èë error, fallback ÉúĞ§
- data = null Ê±ÓÉ fallback ¶µµ×, ²»ÈÃ .map ±ÀÀ£

### 4. useFeatureGate (src/hooks/useFeatureGate.ts)

ĞÂ hook ¼¯ÖĞÈ¨ÏŞ/¹¦ÄÜ¿É¼ûĞÔ:
- `gate(perm)` - µ¥È¨ÏŞ
- `gateAll(perms[])` - ¶àÈ¨ÏŞ AND
- `gateAny(perms[])` - ¶àÈ¨ÏŞ OR
- ÒµÎñ²àÌæ»»É¢ÂäµÄ v-if

### 5. codemod-empty-state.mjs (scripts/codemod-empty-state.mjs)

É¨Ãè `src/pages/**/*.tsx`:
- Ìø¹ı stories/test/AppEmpty ÒÑÊ¹ÓÃ
- Ê¶±ğ antd `<Empty />` / Âã "ÔİÎŞÊı¾İ" µÈ
- Êä³ö `scripts/empty-state-report.json`
- µ±Ç°É¨³ö 7 ¸öµÍÖÃĞÅ¶ÈÄ¿±ê (´ó¶àÒÑÓÃ AppEmpty)

### 6. ²âÊÔ (31 ÏîÈ«²¿Í¨¹ı)

| ÎÄ¼ş | ²âÊÔÊı | ×´Ì¬ |
|---|---|---|
| src/hooks/__tests__/useBreakpoint.test.ts | 15 | PASS |
| src/hooks/__tests__/useSafePagination.test.ts | 7 | PASS |
| src/hooks/__tests__/useApiQuery.test.ts | 4 | PASS |
| src/components/common/__tests__/AppButton.test.tsx | 5 | PASS |

### 7. Playwright Chrome µã»÷ÑéÖ¤ (22 ¹Ø¼üÒ³Ãæ)

È«²¿ PASS, ÎŞÓ¦ÓÃ²ã´íÎó:
- /  /worklist  /multi-site  /cloud-storage  /business-continuity
- /workload-heatmap  /admin/config  /ai-orchestration
- /eye  /eye/ris  /eye/ris/iol-calculator  /eye/kpi-dashboard
- /dental/implant  /dental/implant-3d  /dental/billing
- /qc-dashboard  /cost-analysis  /department
- /director-dashboard  /critical-value  /workflow-designer  /forbidden

Î¨Ò» error: X-Frame-Options À´×Ô vite.config.ts (pre-existing, Óë±¾Éı¼¶ÎŞ¹Ø)

### 8. ¹¹½¨×´Ì¬

- `npm run build`: 38.6s PASS
- `npm run typecheck`: È«²¿ 0 ´íÎó (³ıÔ­±¾µÄ a11y / rbac 2 ¸ö pre-existing)

### 9. Ìá½»×´Ì¬

- ±¾µØ commit `dadeb94b v3.0.6.10-1` ÒÑ´´½¨
- 254 ¸öÎÄ¼ş, 9431 ĞĞĞÂÔö, 910 ĞĞÉ¾³ı
- push ĞèÒª gitcode.com Æ¾¾İ (`cmdkey /list` ÏÔÊ¾ÎŞ±£´æÆ¾¾İ)
