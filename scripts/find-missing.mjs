import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('screenshots-fix/wide-2026-07-02/scan.json', 'utf8'));
const routeTable = fs.readFileSync('src/routes/routeTable.tsx', 'utf8');
const sidebar = fs.readFileSync('src/routes/sidebarConfig.tsx', 'utf8');
const routes = data.results.filter(r => r.status === 'redirect-other').map(r => r.route);
for (const r of routes) {
  const path = r.replace(/^\//, '');
  const inTable = routeTable.includes('"/' + path + '"') || routeTable.includes("'/" + path + "'");
  const inSidebar = sidebar.includes('"/' + path + '"') || sidebar.includes("'/" + path + "'");
  console.log(r.padEnd(25), 'table=' + (inTable ? 'Y' : 'N'), 'sidebar=' + (inSidebar ? 'Y' : 'N'));
}
