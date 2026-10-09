import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
const apps=JSON.parse(readFileSync(new URL('../../../container/apps.json',import.meta.url))).apps;
const base=process.env.MARI_PREVIEW_URL||'http://127.0.0.1:8099';
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
if(process.env.MARI_CHECK_EMPTY==='1')await page.route('**/apps/*/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body={records:[],has_more:false,next_cursor:null};
  if(path.includes('/pages/'))body={records:[],truncated:false,metrics:{documents:0}};
  if(path.endsWith('/overview'))body={recent:[]};
  if(path.endsWith('/connectors')||path.endsWith('/operations'))return route.fulfill({status:409,json:{detail:'No operational observations yet'}});
  return route.fulfill({status:200,json:body});
});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);
await page.getByLabel('Username',{exact:true}).fill('demo');
await page.getByLabel('Password',{exact:true}).fill('demo');
await page.getByRole('button',{name:'Sign in',exact:true}).click();
await page.waitForSelector('iframe');
mkdirSync('/tmp/mari-apps-preview',{recursive:true});
for(const app of apps){
  for(const route of app.routes){
    await page.goto(base+'/#'+route);
    await page.waitForSelector(`iframe[title="${app.name}"]`);
    const frame=page.frameLocator('iframe');
    await frame.locator('body').waitFor();
    await page.waitForTimeout(500);
    if(!await frame.locator('body').innerText())throw Error('Blank app '+route);
  }
  await page.screenshot({path:`/tmp/mari-apps-preview/${app.id}-desktop.png`});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(800);
  await page.frameLocator('iframe').locator('body').waitFor();
  await page.screenshot({path:`/tmp/mari-apps-preview/${app.id}-mobile.png`});
  await page.setViewportSize({width:1440,height:1000});
  console.log('Rendered',app.id);
}
await browser.close();
if(errors.length)throw Error(errors.join('\n'));
console.log('All original page routes rendered without browser exceptions.');
