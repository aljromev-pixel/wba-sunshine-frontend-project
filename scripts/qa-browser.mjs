import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const assert = (await import('node:assert/strict')).default;
process.env.VITE_API_BASE_URL='http://127.0.0.1:5197/api';
const server=await createServer({root,server:{host:'127.0.0.1',port:5197,strictPort:true}});
await server.listen();
let browser;
const errors=[];
const user={id:1,name:'Test Administrator',email:'qa@example.test',department:'Administration',roleLevel:'Manager'};
const products=[{id:1,sku:'QA-1',name:'Alpha Product',category:'Smart Home',stock:2,reorderPoint:1,capacity:null,supplier:'Supplier A',leadTime:1,unit:'units',monthlySales:1},{id:2,sku:'QA-2',name:'Beta Product',category:'Smart Home',stock:3,reorderPoint:1,capacity:10,supplier:'Supplier B',leadTime:2,unit:'units',monthlySales:2}];
const inventory={products,batches:[],transactions:[],adjustments:[],audit:[],alerts:[]};
async function makePage(handler,token=true){
 const page=await browser.newPage();await page.emulateMedia({colorScheme:'light'});page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultNavigationTimeout(30000);
 await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
 if(token)await page.addInitScript(()=>sessionStorage.setItem('wba-auth-token','test-only-token'));
 await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;const method=route.request().method();const json=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});await handler({route,path,method,json});});
 return page;
}
async function checkDialogContrast(page){
 const ratios=await page.getByRole('dialog').evaluate(dialog=>{
  const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number);
  const luminance=color=>rgb(color).map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  return [...dialog.querySelectorAll('h2,p,button')].map(el=>{
   let background=el;
   while(getComputedStyle(background).backgroundColor==='rgba(0, 0, 0, 0)')background=background.parentElement;
   const a=luminance(getComputedStyle(el).color),b=luminance(getComputedStyle(background).backgroundColor);
   return {text:el.textContent,ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)};
  });
 });
 for(const {text,ratio} of ratios)assert.ok(ratio>=4.5,`Dialog contrast for ${text}: ${ratio}`);
}
async function waitForTheme(page,mode){
 await page.waitForFunction(mode=>document.documentElement.dataset.theme===mode&&document.querySelector('.theme-toggle')?.getAttribute('aria-busy')!=='true',mode);
}
async function selectTheme(page,mode){
 await page.waitForFunction(()=>document.querySelector('.theme-toggle')?.getAttribute('aria-busy')!=='true');
 if(await page.evaluate(()=>document.documentElement.dataset.theme)!==mode)await page.getByRole('button',{name:'Dark mode',exact:true}).click();
 await waitForTheme(page,mode);
}
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 let passwordCalls=0,inventoryCalls=0,releasePassword,passwordMode='validation',setupComplete=false,setupInventoryFail=true;
 const employee={...user,department:'Sales',roleLevel:'Staff',mustChangePassword:true,isActive:true};
 const publicPage=await makePage(({json})=>json(200,{}),false);
 await publicPage.goto('http://127.0.0.1:5197');
 await publicPage.getByRole('heading',{name:'A brighter way to keep stock moving.'}).waitFor();
 const themeButton=publicPage.getByRole('button',{name:'Dark mode',exact:true});
 assert.equal(await themeButton.getAttribute('aria-pressed'),'false');
 await publicPage.emulateMedia({colorScheme:'dark'});
 await publicPage.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await publicPage.emulateMedia({colorScheme:'light'});
 await publicPage.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 await themeButton.focus();await publicPage.keyboard.press('Enter');
 await waitForTheme(publicPage,'dark');
 assert.equal(await themeButton.getAttribute('aria-pressed'),'true');
 await publicPage.reload();await publicPage.getByRole('heading',{name:'A brighter way to keep stock moving.'}).waitFor();
 assert.equal(await publicPage.evaluate(()=>document.documentElement.dataset.theme),'dark');
 assert.equal(await publicPage.evaluate(()=>localStorage.getItem('sunshine-theme')),'dark');
 for(const mode of ['dark','light']){
  await selectTheme(publicPage,mode);
  assert.equal(await publicPage.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),mode);
  assert.equal(await publicPage.locator('meta[name="theme-color"]').getAttribute('content'),mode==='dark'?'#181a18':'#f3f2ee');
  assert.equal(await publicPage.locator('.public-page').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
  for(const width of [1440,390]){
   await publicPage.setViewportSize({width,height:900});
   assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   if(process.env.QA_SCREENSHOT_DIR)await publicPage.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/sunshine-home-${mode}-${width}.png`,fullPage:true,animations:'disabled'});
  }
 }
 for(const fallback of [false,true]){
  const animatedTheme=await makePage(({json})=>json(200,{}),false);
  await animatedTheme.setViewportSize({width:390,height:740});
  await animatedTheme.emulateMedia({reducedMotion:'no-preference'});
  await animatedTheme.addInitScript(fallback=>{
   if(!localStorage.getItem('sunshine-theme'))localStorage.setItem('sunshine-theme','dark');
   if(fallback)Object.defineProperty(document,'startViewTransition',{value:undefined,configurable:true});
   window.__qaThemeAnimations=[];
   document.addEventListener('click',event=>{
    const button=event.target.closest('.theme-toggle');
    if(button){const icon=button.querySelector('svg').getBoundingClientRect();window.__qaThemeLens={x:icon.left+icon.width/2,y:icon.top+icon.height*.22};}
   },true);
   const animate=Element.prototype.animate;
   Element.prototype.animate=function(frames,options){
    const animation=animate.call(this,frames,options);
    if(options?.pseudoElement||this.classList.contains('theme-light-spread'))window.__qaThemeAnimations.push({frames,options});
    return animation;
   };
  },fallback);
  await animatedTheme.goto('http://127.0.0.1:5197');await animatedTheme.locator('.flashlight-icon').waitFor();
  for(const mode of ['light','dark']){
   await animatedTheme.getByRole('button',{name:'Dark mode',exact:true}).click();await waitForTheme(animatedTheme,mode);
   const animation=await animatedTheme.evaluate(()=>window.__qaThemeAnimations.at(-1));
   const paths=animation.frames.clipPath;
   assert.ok(paths[mode==='light'?0:1].startsWith('circle(0px'),`${mode} must ${mode==='light'?'expand':'contract'} from the icon`);
   const [radius,x,y]=paths[mode==='light'?1:0].match(/[\d.]+/g).map(Number);
   const lens=await animatedTheme.evaluate(()=>window.__qaThemeLens);
   assert.ok(Math.abs(x-lens.x)<1&&Math.abs(y-lens.y)<1,'The light reveal must start at the flashlight lens');
   assert.ok(radius>=Math.hypot(Math.max(x,390-x),Math.max(y,740-y))-.1,'The reveal must reach every viewport corner');
   if(!fallback)assert.equal(animation.options.pseudoElement,mode==='light'?'::view-transition-new(root)':'::view-transition-old(root)');
   assert.equal(await animatedTheme.locator('.theme-light-spread').count(),0);
  }
  const animationCount=await animatedTheme.evaluate(()=>window.__qaThemeAnimations.length);
  await animatedTheme.emulateMedia({reducedMotion:'reduce'});await selectTheme(animatedTheme,'light');
  assert.equal(await animatedTheme.evaluate(()=>window.__qaThemeAnimations.length),animationCount,'Reduced motion must change theme without a reveal animation');
  await animatedTheme.reload();await waitForTheme(animatedTheme,'light');
  for(const width of [320,390]){
   await animatedTheme.setViewportSize({width,height:740});
   const logo=await animatedTheme.locator('.login-sun').boundingBox(),sun=await animatedTheme.locator('.login-sun .sun-icon').boundingBox();
   assert.ok(Math.abs(logo.x+logo.width/2-sun.x-sun.width/2)<.5&&Math.abs(logo.y+logo.height/2-sun.y-sun.height/2)<.5,'Mobile sun artwork must be centered inside its circle');
  }
  await animatedTheme.close();
 }
 let releaseSession;
 const loadingLogo=await makePage(({path,json})=>path.endsWith('/auth/me')?new Promise(resolve=>releaseSession=()=>resolve(json(200,{user}))):json(200,inventory));
 await loadingLogo.goto('http://127.0.0.1:5197');await loadingLogo.locator('.loading-logo .sun-icon').waitFor();
 assert.equal(await loadingLogo.locator('.loading-logo .sun-icon').evaluate(el=>getComputedStyle(el).animationName),'sun-rotate');
 await loadingLogo.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await loadingLogo.locator('.loading-logo .sun-icon').evaluate(el=>getComputedStyle(el).animationName),'none');
 releaseSession();await loadingLogo.getByRole('heading',{name:'A complete view of inventory control.'}).waitFor();await loadingLogo.close();
 console.log('Flashlight reveal origin, full-page expansion and reverse contraction, unsupported-browser fallback, reduced motion, stored choice, rotating loading logo and centered mobile suns passed.');
 assert.equal(await publicPage.getByRole('link',{name:/Create.*account|Sign up/i}).count(),0);
 assert.match(await publicPage.locator('.public-caption').innerText(),/administrator/);
 for(const width of [1440,390]){
  await publicPage.setViewportSize({width,height:900});
  assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Landing overflow at ${width}`);
 }
 await publicPage.getByRole('link',{name:'Sign in',exact:true}).click();
 await publicPage.getByRole('heading',{name:'Sign in to your workspace',exact:true}).waitFor();
 assert.equal(await publicPage.locator('.login-card').evaluate(el=>getComputedStyle(el).animationName),'entry-right');
 await publicPage.getByRole('link',{name:'← Back to home',exact:true}).click();
 await publicPage.getByRole('heading',{name:'A brighter way to keep stock moving.'}).waitFor();
 assert.equal(await publicPage.locator('.public-visual').evaluate(el=>getComputedStyle(el).animationName),'entry-right');
 await publicPage.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await publicPage.locator('.public-visual').evaluate(el=>getComputedStyle(el).animationName),'none');
 await publicPage.emulateMedia({reducedMotion:'no-preference'});
 await publicPage.goto('http://127.0.0.1:5197/#/sign-up');
 await publicPage.getByRole('heading',{name:'Sign in to your workspace'}).waitFor();
 assert.equal(await publicPage.getByRole('link',{name:/Create.*account|Sign up/i}).count(),0);
 const setup=await makePage(({path,json,route})=>{
  if(path.endsWith('/auth/me'))return json(200,{user:{...employee,mustChangePassword:!setupComplete}});
  if(path.endsWith('/auth/password')){
   passwordCalls++;
   if(passwordMode==='validation')return new Promise(resolve=>releasePassword=()=>resolve(json(422,{message:'Validation failed.',errors:{current_password:['The current password is incorrect.']}})));
   if(passwordMode==='offline')return route.abort('failed');
   setupComplete=true;return json(200,{token:'private-password-token',user:{...employee,mustChangePassword:false}});
  }
  inventoryCalls++;return json(setupInventoryFail?500:200,setupInventoryFail?{message:'Inventory temporarily unavailable.'}:inventory);
 });
 await setup.goto('http://127.0.0.1:5197/#/inventory');
 await setup.getByRole('heading',{name:'Set your own password'}).waitFor();assert.equal(inventoryCalls,0);
 await setup.reload();await setup.getByRole('heading',{name:'Set your own password'}).waitFor();assert.equal(inventoryCalls,0);
 for(const width of [1440,390]){
  await setup.setViewportSize({width,height:900});
  assert.equal(await setup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Password setup overflow at ${width}`);
 }
 await setup.locator('input[name="current_password"]').fill('temporary-test-password');
 await setup.locator('input[name="password"]').fill('private-test-password');
 await setup.locator('input[name="password_confirmation"]').fill('different-test-password');
 await setup.getByRole('button',{name:'Save password and continue'}).click();
 await setup.getByRole('alert').filter({hasText:'The passwords do not match.'}).waitFor();assert.equal(passwordCalls,0);
 await setup.locator('input[name="password_confirmation"]').fill('private-test-password');
 await setup.getByRole('button',{name:'Show passwords'}).click();assert.equal(await setup.locator('input[name="password"]').getAttribute('type'),'text');
 await setup.getByRole('button',{name:'Save password and continue'}).click();await setup.getByRole('button',{name:'Saving password…'}).waitFor();
 for(const input of await setup.locator('form input').all())assert.equal(await input.isDisabled(),true);
 await setup.locator('form').evaluate(form=>form.requestSubmit());assert.equal(passwordCalls,1);
 releasePassword();await setup.locator('input[name="current_password"][aria-invalid="true"]').waitFor();
 passwordMode='offline';await setup.getByRole('button',{name:'Save password and continue'}).click();
 await setup.getByRole('alert').filter({hasText:'Unable to reach the API'}).waitFor();
 passwordMode='success';await setup.getByRole('button',{name:'Save password and continue'}).click();
 await setup.getByRole('heading',{name:'Unable to load inventory'}).waitFor();
 assert.equal(await setup.evaluate(()=>sessionStorage.getItem('wba-auth-token')),'private-password-token');
 assert.equal(new URL(setup.url()).hash,'#/dashboard');
 setupInventoryFail=false;await setup.getByRole('button',{name:'Retry inventory loading'}).click();
 await setup.getByRole('heading',{name:'Reliable answers for every customer.'}).waitFor();assert.equal(passwordCalls,3);
 await setup.reload();await setup.getByRole('heading',{name:'Reliable answers for every customer.'}).waitFor();assert.equal(passwordCalls,3);
 const protectedPage=await makePage(({json})=>json(200,{}),false);await protectedPage.goto('http://127.0.0.1:5197/#/inventory');await protectedPage.getByRole('heading',{name:'Sign in to your workspace'}).waitFor();
 console.log('Admin-only landing, closed sign-up route, mandatory password setup, pending submissions, validation/network errors, session restoration, saved-password inventory retry, and responsive layouts passed.');
 let meCalls=0;
 const restore=await makePage(({path,json})=>path.endsWith('/auth/me')?json(++meCalls===1?500:200,meCalls===1?{message:'Session service unavailable.'}:{user}):json(200,inventory));
 await restore.goto('http://127.0.0.1:5197');
 await restore.getByRole('button',{name:'Retry session restoration'}).waitFor();assert.equal(meCalls,1);
 await restore.getByRole('button',{name:'Retry session restoration'}).click();
 await restore.getByRole('link',{name:/Inventory/}).first().waitFor();assert.equal(meCalls,2);
 console.log('Session failure and retry passed.');
 let inventoryFail=false,postCalls=0,deleteCalls=0,releaseDelete,releaseProduct,productCalls=0;
 const page=await makePage(({route,path,method,json})=>{
 if(path.endsWith('/auth/me'))return json(200,{user});
 if(path.endsWith('/inventory'))return json(inventoryFail?500:200,inventoryFail?{message:'Refresh unavailable.'}:inventory);
 if(path.endsWith('/users')&&method==='GET')return json(200,{data:[user]});
 if(path.endsWith('/movements')){postCalls++;inventoryFail=true;return json(201,{data:{id:9}});}
 if(path.endsWith('/products')&&method==='POST'){productCalls++;return new Promise(resolve=>releaseProduct=()=>resolve(json(422,{message:'Validation failed.',errors:{sku:['SKU is already in use.']}})));}
 if(path.endsWith('/products/1')&&method==='DELETE'){deleteCalls++;return new Promise(resolve=>releaseDelete=()=>resolve(json(409,{message:'Product has inventory history.'})));}
 return json(200,{});
 });
 await page.goto('http://127.0.0.1:5197/#/inventory');await page.getByRole('button',{name:'Add product',exact:true}).waitFor();
 await page.getByRole('button',{name:'Edit',exact:true}).nth(0).click();assert.equal(await page.locator('input[name="sku"]').inputValue(),'QA-1');assert.equal(await page.locator('input[name="capacity"]').inputValue(),'');
 await page.getByRole('button',{name:'Edit',exact:true}).nth(1).click();assert.equal(await page.locator('input[name="sku"]').inputValue(),'QA-2');
 await page.getByRole('button',{name:'Add product',exact:true}).click();assert.equal(await page.locator('input[name="sku"]').inputValue(),'');
 await page.getByRole('button',{name:'Create product',exact:true}).click();assert.ok(await page.locator('form :invalid').count());assert.equal(productCalls,0);
 await page.locator('input[name="sku"]').fill('QA-1');await page.locator('input[name="name"]').fill('Test');await page.locator('input[name="category"]').fill('Smart Home');
 await page.locator('input[name="stock"]').fill('-1');await page.getByRole('button',{name:'Create product',exact:true}).click();assert.equal(await page.locator('input[name="stock"]').evaluate(el=>el.validity.rangeUnderflow),true);assert.equal(productCalls,0);await page.locator('input[name="stock"]').fill('0');
 await page.getByRole('button',{name:'Create product',exact:true}).click();await page.getByRole('button',{name:/^Saving/}).waitFor();for(const control of await page.locator('form input').all())assert.equal(await control.isDisabled(),true);await page.locator('form').evaluate(form=>form.requestSubmit());assert.equal(productCalls,1);assert.equal(await page.getByRole('button',{name:/^Saving/}).getAttribute('aria-busy'),'true');assert.equal(await page.locator('.button-spinner').count(),1);releaseProduct();await page.locator('input[name="sku"][aria-invalid="true"]').waitFor();
 const errorId=await page.locator('input[name="sku"]').getAttribute('aria-describedby');assert.match(await page.locator(`[id="${errorId}"]`).innerText(),/already in use/);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 const trigger=page.getByRole('button',{name:'Delete',exact:true}).first();await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();await checkDialogContrast(page);
 assert.equal(await dialog.getByRole('button',{name:'Cancel'}).evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Shift+Tab');assert.equal(await dialog.getByRole('button',{name:'Delete product',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Tab');assert.equal(await dialog.getByRole('button',{name:'Cancel'}).evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
 await trigger.click();await dialog.getByRole('button',{name:'Delete product',exact:true}).click();await dialog.getByRole('button',{name:/Processing/}).waitFor();
 await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el===document.activeElement),true);assert.equal(deleteCalls,1);
 releaseDelete();await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/inventory history/);await checkDialogContrast(page);await dialog.getByRole('button',{name:'Cancel'}).click();
 await page.goto('http://127.0.0.1:5197/#/users');await page.getByRole('button',{name:'Add user',exact:true}).click();
 await page.locator('select[name="department"]').selectOption('Sales');assert.deepEqual(await page.locator('select[name="roleLevel"] option:not([disabled])').allTextContents(),['Staff','Supervisor']);
 await page.goto('http://127.0.0.1:5197/#/stock-in');await page.locator('select[name="productId"]').selectOption('1');await page.locator('input[name="quantity"]').fill('2');await page.locator('input[name="reference"]').fill('test');
 await page.getByRole('button',{name:'Record stock in'}).click();await page.getByRole('heading',{name:'Unable to load inventory'}).waitFor();assert.match(await page.getByRole('alert').innerText(),/Your change was saved/);assert.equal(postCalls,1);
 inventoryFail=false;await page.getByRole('button',{name:'Retry inventory loading'}).click();await page.getByRole('heading',{name:'Unable to load inventory'}).waitFor({state:'detached'});assert.equal(postCalls,1);

 await page.locator('select[name="productId"]').selectOption('1');await page.locator('input[name="quantity"]').fill('7');await page.locator('input[name="reference"]').fill('Receiving reference');
 for(const [label,heading] of [['Stock Out','Stock Out transaction'],['Transfers','Transfer transaction'],['Returns','Return transaction'],['Stock In','Stock In transaction']]){
  await page.getByRole('link',{name:new RegExp(label)}).click();await page.getByRole('heading',{name:heading}).waitFor();
  assert.equal(await page.locator('input[name="quantity"]').inputValue(),'');assert.equal(await page.locator('input[name="reference"]').inputValue(),'');
 }
 console.log('Movement navigation resets passed.');
 console.log('CRUD resets, validation, supported roles, dialog keyboard/pending/failure, and saved-write refresh retry passed.');
 const staffAccount={...user,id:3,name:'Alex Rivera',firstName:'Alex',lastName:'Rivera',department:'Sales',roleLevel:'Staff'};
 const otherAdmin={...user,id:2,name:'Other Administrator'};
 let userWrites=0,userPayload,releaseUserSave,auditRefreshFail=false;
 const userAudit=[];
 const privacy=await makePage(({path,method,json,route})=>{
  if(path.endsWith('/auth/me'))return json(200,{user});
  if(path.endsWith('/inventory'))return json(auditRefreshFail?500:200,auditRefreshFail?{message:'Audit refresh unavailable.'}:{...inventory,audit:userAudit});
  if(path.endsWith('/users')&&method==='GET')return json(200,{data:[user,otherAdmin,staffAccount]});
  if(path.endsWith('/users/3')&&method==='PUT'){
   userWrites++;userPayload=route.request().postDataJSON();
   return new Promise(resolve=>releaseUserSave=()=>{Object.assign(staffAccount,{firstName:userPayload.name,lastName:userPayload.lastName,name:`${userPayload.name} ${userPayload.lastName}`});userAudit.push({id:userWrites,timestamp:'2030-01-15T12:00:00Z',user:user.name,department:user.department,roleLevel:user.roleLevel,action:'User updated',module:'Users',reference:3,description:staffAccount.name});resolve(json(200,{data:staffAccount}));});
  }
  return json(200,inventory);
 });
 await privacy.goto('http://127.0.0.1:5197/#/users');
 const protectedRow=privacy.getByRole('row').filter({hasText:'Other Administrator'});
 await protectedRow.getByText('Protected administrator').waitFor();assert.equal(await protectedRow.getByRole('button').count(),0);
 await privacy.getByRole('row').filter({hasText:'Alex Rivera'}).getByRole('button',{name:'Edit',exact:true}).click();
 assert.equal(await privacy.getByRole('textbox',{name:'First name',exact:true}).inputValue(),'Alex');
 assert.equal(await privacy.getByRole('textbox',{name:'Last name',exact:true}).inputValue(),'Rivera');
 assert.equal(await privacy.locator('input[name="password"]').count(),0);
 await privacy.getByRole('button',{name:'Change password',exact:true}).click();
 const newPassword=privacy.locator('input[name="password"]');assert.equal(await newPassword.inputValue(),'');
 await privacy.getByRole('button',{name:'Save user',exact:true}).click();assert.equal(userWrites,0);
 await newPassword.fill('new-test-password');await privacy.getByRole('button',{name:'Show password',exact:true}).click();
 assert.equal(await newPassword.getAttribute('type'),'text');assert.equal(await newPassword.inputValue(),'new-test-password');
 await privacy.getByRole('button',{name:'Hide password',exact:true}).click();assert.equal(await newPassword.getAttribute('type'),'password');
 for(const width of [1440,390]){await privacy.setViewportSize({width,height:900});assert.equal(await privacy.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`User editor overflow at ${width}`);}
 await privacy.getByRole('button',{name:'Cancel password change',exact:true}).click();assert.equal(await newPassword.count(),0);
 await privacy.getByRole('textbox',{name:'Last name',exact:true}).fill('Santos');await privacy.getByRole('button',{name:'Save user',exact:true}).click();
 await privacy.getByRole('button',{name:'Saving…'}).waitFor();assert.equal(Object.hasOwn(userPayload,'password'),false);
 await privacy.locator('form').evaluate(form=>form.requestSubmit());assert.equal(userWrites,1);
 releaseUserSave();await privacy.getByRole('row').filter({hasText:'Alex Santos'}).waitFor();
 await privacy.getByRole('row').filter({hasText:'Alex Santos'}).getByRole('button',{name:'Edit',exact:true}).click();
 await privacy.getByRole('button',{name:'Change password',exact:true}).click();assert.equal(await newPassword.inputValue(),'');
 await newPassword.fill('reset-test-password');await privacy.getByRole('button',{name:'Save user',exact:true}).click();
 await privacy.getByRole('button',{name:'Saving…'}).waitFor();assert.equal(userPayload.password,'reset-test-password');assert.equal(userWrites,2);
 assert.equal(await privacy.getByRole('button',{name:'Show password',exact:true}).isDisabled(),true);
 releaseUserSave();await privacy.getByRole('heading',{name:'Edit user',exact:true}).waitFor({state:'hidden'});
 await privacy.goto('http://127.0.0.1:5197/#/audit-trail');await privacy.getByRole('heading',{name:'Audit trail',exact:true}).waitFor();
 assert.equal(await privacy.getByRole('cell',{name:'User updated',exact:true}).count(),2);
 await privacy.goto('http://127.0.0.1:5197/#/users');await privacy.getByRole('row').filter({hasText:'Alex Santos'}).getByRole('button',{name:'Edit',exact:true}).click();
 await privacy.getByRole('textbox',{name:'Last name',exact:true}).fill('Lopez');await privacy.getByRole('button',{name:'Save user',exact:true}).click();
 await privacy.getByRole('button',{name:'Saving…'}).waitFor();auditRefreshFail=true;releaseUserSave();
 await privacy.getByRole('heading',{name:'Unable to load inventory'}).waitFor();assert.match(await privacy.getByRole('alert').innerText(),/Your change was saved/);
 auditRefreshFail=false;await privacy.getByRole('button',{name:'Retry inventory loading'}).click();await privacy.getByRole('row').filter({hasText:'Alex Lopez'}).waitFor();assert.equal(userWrites,3);
 await privacy.goto('http://127.0.0.1:5197/#/audit-trail');await privacy.getByRole('heading',{name:'Audit trail',exact:true}).waitFor();assert.equal(await privacy.getByRole('cell',{name:'User updated',exact:true}).count(),3);
 await privacy.goto('http://127.0.0.1:5197/#/users');
 await privacy.reload();await privacy.getByRole('row').filter({hasText:'Alex Lopez'}).waitFor();
 await privacy.getByRole('row').filter({hasText:'Alex Lopez'}).getByRole('button',{name:'Delete',exact:true}).click();
 for(const width of [1440,390]){
  await privacy.setViewportSize({width,height:900});await checkDialogContrast(privacy);
  assert.equal(await privacy.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Delete dialog overflow at ${width}`);
  if(process.env.QA_SCREENSHOT_DIR)await privacy.getByRole('dialog').screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/sunshine-delete-user-${width}.png`});
 }
 await privacy.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 console.log('User writes refresh the audit trail; failed audit refresh retries without repeating a write.');
 console.log('Separate names, protected administrator actions, explicit password reset, visibility, cancellation, pending duplicate protection, reload and responsive editor passed.');
 const reviewer={...user,department:'Purchasing',roleLevel:'Manager'};
 const reviews={...inventory,adjustments:[{id:1,productId:1,requestedById:2,requestedBy:'Other',systemQty:2,requestedQty:3,reason:'Count',status:'Pending'},{id:2,productId:1,requestedById:1,requestedBy:'Self',systemQty:2,requestedQty:3,reason:'Count',status:'Pending'}]};
 const review=await makePage(({path,json})=>json(200,path.endsWith('/auth/me')?{user:reviewer}:reviews));
 await review.goto('http://127.0.0.1:5197/#/adjustments');await review.getByRole('heading',{name:'Approve or reject requests'}).waitFor();assert.equal(await review.getByRole('heading',{name:'Submit adjustment',exact:true}).count(),0);assert.equal(await review.getByRole('button',{name:'Approve',exact:true}).count(),1);await review.getByRole('link',{name:/Adjustments/}).waitFor();
 for(const action of ['Approve','Reject']){await review.getByRole('button',{name:action,exact:true}).click();await checkDialogContrast(review);await review.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();}
 const visualInventory={...reviews,loadedAt:'2030-01-15T12:00:00Z',products:[{...products[0],name:'Portable inverter air conditioner with a long warehouse product description'}]};
 const visual=await makePage(({path,json})=>json(200,path.endsWith('/auth/me')?{user:{...user,name:'Alexandria Catherine Warehouse Administrator'}}:visualInventory));
 await visual.emulateMedia({reducedMotion:'reduce'});
 for(const width of [320,768,1440,1920,2560]){
  await visual.setViewportSize({width,height:640});await visual.goto('http://127.0.0.1:5197/#/adjustments');
  await visual.getByRole('heading',{name:'Approve or reject requests'}).waitFor();
  const geometry=await visual.evaluate(()=>{
   const heading=document.querySelector('.workspace-heading').getBoundingClientRect(),actions=document.querySelector('.topbar-actions').getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,collision:heading.right>actions.left+1&&heading.left<actions.right-1&&heading.bottom>actions.top+1&&heading.top<actions.bottom-1,clipped:[...document.querySelectorAll('.workspace-title h1,.breadcrumb')].some(el=>el.scrollWidth>el.clientWidth+1)};
  });
  assert.deepEqual(geometry,{overflow:false,collision:false,clipped:false},`Header must stay readable at ${width}px`);
  if(width===320){
   const queue=visual.locator('.adjustment-row').first();
   const details=await queue.locator(':scope > div').first().boundingBox(),actions=await queue.locator('.review-actions').boundingBox();
   assert.ok(actions.y>=details.y+details.height,'Mobile review controls must not squeeze or overlap request details');
  }
 }
 await visual.goto('http://127.0.0.1:5197/#/dashboard');await visual.locator('.hero-panel').waitFor();
 const alignment=await visual.evaluate(()=>['.topbar','.inventory-refresh','.refresh-status','.hero-panel'].map(selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return{left:rect.left,right:rect.right};}));
 for(const bounds of alignment)assert.ok(Math.abs(bounds.left-alignment[0].left)<1&&Math.abs(bounds.right-alignment[0].right)<1,'Header, refresh controls, notice and dashboard must share their edges on wide screens');
 await visual.setViewportSize({width:320,height:480});await visual.goto('http://127.0.0.1:5197/#/inventory');
 const visualTrigger=visual.getByRole('button',{name:'Delete',exact:true});await visualTrigger.click();await visual.getByRole('dialog').waitFor();
 assert.ok(await visual.evaluate(()=>scrollY>0),'Dialog placement must be checked after scrolling the page');
 const modalBounds=await visual.getByRole('dialog').boundingBox();
 assert.ok(modalBounds.x>=0&&modalBounds.y>=0&&modalBounds.x+modalBounds.width<=320&&modalBounds.y+modalBounds.height<=480,'Scrolled-page confirmation must remain inside the mobile viewport');
 assert.equal(await visual.evaluate(()=>document.body.style.overflow),'hidden');assert.equal(await visual.locator('.application').evaluate(el=>el.inert),true);
 await visual.getByRole('dialog').getByRole('button',{name:'Delete product',exact:true}).scrollIntoViewIfNeeded();await checkDialogContrast(visual);
 await visual.keyboard.press('Escape');await visual.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await visual.evaluate(()=>document.body.style.overflow),'');assert.equal(await visual.locator('.application').evaluate(el=>el.inert),false);assert.equal(await visualTrigger.evaluate(el=>el===document.activeElement),true);
 console.log('Long-name header layout, narrow adjustment review controls, scrolled mobile dialogs, background scroll/focus isolation and focus restoration passed.');
 const batchDelete=await makePage(({path,json})=>json(200,path.endsWith('/auth/me')?{user}:{...inventory,batches:[{id:1,productId:1,number:'QA-EMPTY',quantity:0,receivedAt:'2030-01-01',expiresAt:null}]}));
 await batchDelete.goto('http://127.0.0.1:5197/#/batches');await batchDelete.getByRole('button',{name:'Delete',exact:true}).click();await checkDialogContrast(batchDelete);await batchDelete.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 console.log('Delete user/product/batch and approve/reject dialogs have readable text and controls; desktop/mobile warning layouts passed.');
 const empty=await makePage(({path,json})=>json(200,path.endsWith('/auth/me')?{user}:{...inventory,products:[]}));await empty.goto('http://127.0.0.1:5197/#/cycle-count');await empty.getByRole('heading',{name:'No products to count'}).waitFor();
 const login=await makePage(({json})=>json(422,{message:'Invalid credentials.',errors:{email:['Email credentials do not match.']}}),false);await login.goto('http://127.0.0.1:5197/#/sign-in');await login.locator('input[name="email"]').fill('test@example.test');await login.locator('input[name="password"]').fill('test-password');await login.getByRole('button',{name:'Sign in',exact:true}).click();await login.locator('input[name="email"][aria-invalid="true"]').waitFor();

 for(const status of [403,404,500]){
  const failure=await makePage(({path,json})=>path.endsWith('/auth/me')?json(200,{user}):json(status,{message:'Request failed.'}));
  await failure.goto('http://127.0.0.1:5197');await failure.getByRole('heading',{name:'Unable to load inventory'}).waitFor();
  assert.match(await failure.getByRole('alert').innerText(),status===403?/permission/:status===404?/no longer available/:/Request failed/);await failure.close();
 }
 const expired=await makePage(({json})=>json(401,{message:'Unauthenticated.'}));await expired.goto('http://127.0.0.1:5197');await expired.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await expired.evaluate(()=>sessionStorage.getItem('wba-auth-token')),null);
 const offline=await makePage(({route,path,json})=>path.endsWith('/auth/me')?json(200,{user}):route.abort('connectionrefused'));await offline.goto('http://127.0.0.1:5197');await offline.getByRole('heading',{name:'Unable to load inventory'}).waitFor();assert.match(await offline.getByRole('alert').innerText(),/Unable to reach the API/);
 const sales=await makePage(({path,json})=>json(200,path.endsWith('/auth/me')?{user:{...user,department:'Sales',roleLevel:'Staff'}}:inventory));await sales.goto('http://127.0.0.1:5197/#/users');await sales.getByRole('heading',{name:'This module is not part of your assigned workspace.'}).waitFor();assert.equal(await sales.getByRole('link',{name:/User Management/}).count(),0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  for(const path of ['inventory','batches','stock-in','adjustments','users']){
   await page.goto(`http://127.0.0.1:5197/#/${path}`);await page.getByRole('heading',{name:{inventory:'Inventory at a glance',batches:'FIFO and expiry management','stock-in':'Stock In transaction',adjustments:'Inventory adjustments',users:'User management'}[path],exact:true}).waitFor();
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) console.log('Overflow details',await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Page overflow: ${path} at ${width}`);
   if(width===390){await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('link',{name:/Inventory/}).first().click();await page.getByRole('heading',{name:'Inventory at a glance'}).waitFor();}
  }
 }
 for(const path of ['/missing-page','/inventory/','/inventory/1/extra']){
  await page.goto(`http://127.0.0.1:5197/#${path}`);await page.getByRole('heading',{name:'Page not found',exact:true}).waitFor();
  await page.getByRole('link',{name:'Return to dashboard',exact:true}).click();await page.getByRole('heading',{name:'A complete view of inventory control.'}).waitFor();
 }
 await page.goto('http://127.0.0.1:5197/#/reorder-calculator');await page.getByRole('heading',{name:'Seasonal reorder calculator'}).waitFor();
 assert.equal(await page.locator('.calculator-grid select').first().inputValue(),'1');
 await page.locator('.calculator-grid select').first().selectOption('2');
 assert.equal(await page.getByRole('spinbutton',{name:'Average monthly sales'}).inputValue(),'2');
 assert.equal(await page.getByRole('spinbutton',{name:'Lead time'}).inputValue(),'2');
 assert.equal(await page.getByRole('spinbutton',{name:'Seasonal demand multiplier'}).inputValue(),'1');
 await empty.goto('http://127.0.0.1:5197/#/reorder-calculator');await empty.getByRole('heading',{name:'No products to calculate'}).waitFor();
 await page.goto('http://127.0.0.1:5197/#/alerts');await page.getByRole('heading',{name:'Inventory alerts'}).waitFor();await page.getByRole('heading',{name:'No alerts match this view'}).waitFor();
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(243, 242, 238)');
 let reportLoads=0;
 const reportInventory={...inventory,products:products.map((item,index)=>({...item,stock:index===0?5:20,reorderPoint:10,monthlySales:60,leadTime:7})),transactions:[{id:11,productId:1,type:'Stock Out',quantity:3,reference:'SO-QA',date:'2030-01-15T12:00:00Z',status:'Completed'}],adjustments:[{id:21,productId:1,systemQty:10,requestedQty:8,reason:'Cycle count: system 10, counted 8',status:'Approved',requestedById:1},{id:22,productId:2,systemQty:10,requestedQty:10,reason:'Manual adjustment',status:'Pending',requestedById:1}]};
 const reporting=await makePage(({path,method,json})=>{assert.equal(method,'GET');if(path.endsWith('/auth/me'))return json(200,{user});reportLoads++;return json(200,reportInventory);});
 const expiryDates=await reporting.evaluate(()=>[0,30,31,-1].map(days=>{const date=new Date();date.setDate(date.getDate()+days);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}));
 reportInventory.batches=expiryDates.map((expiresAt,index)=>({id:31+index,productId:1,number:`REPORT-${index}`,quantity:2,receivedAt:expiryDates[3],expiresAt}));
 await reporting.goto('http://127.0.0.1:5197/#/reports');await reporting.getByRole('heading',{name:'Inventory reports',exact:true}).waitFor();
 assert.match(await reporting.locator('main').innerText(),/calculated in your browser.*Laravel inventory data/);
 const reportSelect=reporting.getByRole('combobox',{name:'Report type'});
 for(const [name,count] of [['Inventory Summary',2],['Stock Movement Report',1],['Low Stock Report',1],['Expiring Stock Report',2],['Inventory Discrepancy Report',1],['Cycle Count Report',1],['Adjustment Report',2],['Seasonal Reorder Report',2]]){
  await reportSelect.selectOption(name);assert.equal(await reporting.locator('tbody tr').count(),count,name);
 }
 await reporting.getByRole('spinbutton',{name:'Demand multiplier'}).fill('2');await reporting.getByRole('spinbutton',{name:'Safety stock percent'}).fill('10');
 assert.equal(await reporting.locator('tbody tr').first().locator('td').nth(6).innerText(),'30');
 await reporting.getByRole('spinbutton',{name:'Demand multiplier'}).fill('-1');await reporting.getByRole('alert').waitFor();assert.equal(await reporting.getByRole('button',{name:'Print report',exact:true}).isDisabled(),true);
 await reporting.getByRole('spinbutton',{name:'Demand multiplier'}).fill('2');
 await reporting.evaluate(()=>{window.print=()=>{window.__qaPrintCalled=true;};});await reporting.getByRole('button',{name:'Print report',exact:true}).click();assert.equal(await reporting.evaluate(()=>window.__qaPrintCalled),true);
 await reportSelect.selectOption('Inventory Summary');reportInventory.products[0].stock=99;await reporting.getByRole('button',{name:'Refresh report data'}).click();await reporting.getByRole('heading',{name:'Inventory reports',exact:true}).waitFor();assert.equal(await reporting.locator('tbody tr').first().locator('td').nth(2).innerText(),'99');assert.equal(reportLoads,2);
 for(const width of [1440,390]){await reporting.setViewportSize({width,height:900});await reportSelect.selectOption('Seasonal Reorder Report');assert.equal(await reporting.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Reports overflow at ${width}`);}
 await empty.goto('http://127.0.0.1:5197/#/reports');await empty.getByRole('heading',{name:'No data for this report'}).waitFor();
 await sales.goto('http://127.0.0.1:5197/#/reports');await sales.getByRole('heading',{name:'This module is not part of your assigned workspace.'}).waitFor();
 console.log('All eight reports, explicit source, API refresh, assumptions, empty/restricted states, print and responsive layout passed.');
 for(const mode of ['dark','light']){
  await selectTheme(page,mode);
  await page.goto('http://127.0.0.1:5197/#/users');await page.getByRole('heading',{name:'User management',exact:true}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'User management',exact:true}).waitFor();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${mode} workspace overflow at ${width}`);
   if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/sunshine-workspace-${mode}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  await selectTheme(privacy,mode);
  await privacy.getByRole('row').filter({hasText:'Alex Lopez'}).getByRole('button',{name:'Delete',exact:true}).click();
  await checkDialogContrast(privacy);await privacy.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 }
 const unavailableStorage=await makePage(({json})=>json(200,{}),false);
 await unavailableStorage.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}}));
 await unavailableStorage.goto('http://127.0.0.1:5197/#/sign-in');
 await unavailableStorage.getByRole('button',{name:'Dark mode',exact:true}).click();
 await waitForTheme(unavailableStorage,'dark');
 assert.equal(await unavailableStorage.evaluate(()=>document.documentElement.dataset.theme),'dark');
 const motion=await makePage(({path,json})=>json(200,path.endsWith('/auth/me')?{user}:inventory));
 await motion.goto('http://127.0.0.1:5197/#/inventory');await motion.getByRole('heading',{name:'Inventory at a glance',exact:true}).waitFor();
 assert.equal(await motion.locator('.page-transition').evaluate(el=>getComputedStyle(el).animationName),'content-enter');
 await motion.getByRole('button',{name:'Delete',exact:true}).first().click();
 assert.equal(await motion.getByRole('dialog').evaluate(el=>getComputedStyle(el).animationName),'dialog-enter');
 await motion.keyboard.press('Escape');await motion.getByRole('dialog').waitFor({state:'detached'});
 await motion.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await motion.locator('.page-transition').evaluate(el=>getComputedStyle(el).animationName),'none');
 await motion.getByRole('button',{name:'Delete',exact:true}).first().click();
 assert.equal(await motion.getByRole('dialog').evaluate(el=>getComputedStyle(el).animationName),'none');
 await motion.keyboard.press('Escape');await motion.getByRole('dialog').waitFor({state:'detached'});
 await motion.getByRole('button',{name:'Add product',exact:true}).hover();
 assert.equal(await motion.getByRole('button',{name:'Add product',exact:true}).evaluate(el=>getComputedStyle(el).transform),'none');
 await motion.emulateMedia({reducedMotion:'no-preference'});
 assert.equal(await motion.getByRole('button',{name:'Collapse navigation',exact:true}).evaluate(el=>Boolean(el.closest('.brand'))),true);
 await motion.getByRole('button',{name:'Collapse navigation',exact:true}).click();
 assert.equal(await motion.getByRole('button',{name:'Expand navigation',exact:true}).getAttribute('aria-expanded'),'false');
 await motion.getByRole('link',{name:/Audit Trail/}).waitFor({state:'hidden'});
 assert.equal(await motion.locator('#workspace-navigation').evaluate(el=>el.inert),true);
 if(process.env.QA_SCREENSHOT_DIR)await motion.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/sunshine-sidebar-collapsed-1440.png`,fullPage:true,animations:'disabled'});
 await motion.getByRole('button',{name:'Expand navigation',exact:true}).click();
 assert.equal(await motion.getByRole('button',{name:'Collapse navigation',exact:true}).getAttribute('aria-expanded'),'true');
 await motion.setViewportSize({width:390,height:900});
 await motion.getByRole('button',{name:'Open navigation',exact:true}).click();
 await motion.getByRole('button',{name:'Close navigation',exact:true}).waitFor();
 assert.equal(await motion.getByRole('button',{name:'Close navigation',exact:true}).evaluate(el=>document.activeElement===el),true);
 await motion.keyboard.press('Shift+Tab');assert.equal(await motion.getByRole('button',{name:'Sign out',exact:true}).evaluate(el=>document.activeElement===el),true);
 await motion.keyboard.press('Escape');await motion.getByRole('button',{name:'Open navigation',exact:true}).waitFor();
 assert.equal(await motion.getByRole('button',{name:'Open navigation',exact:true}).evaluate(el=>document.activeElement===el),true);
 assert.equal(await motion.locator('.ambient-background').getAttribute('aria-hidden'),'true');
 await motion.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await motion.locator('.ambient-gold').evaluate(el=>getComputedStyle(el).animationName),'none');
 if(process.env.QA_SCREENSHOT_DIR){
  for(const mode of ['light','dark']){
   await selectTheme(motion,mode);
   await motion.getByRole('button',{name:'Open navigation',exact:true}).click();
   await motion.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/sunshine-sidebar-${mode}-390.png`,fullPage:true,animations:'disabled'});
   await motion.keyboard.press('Escape');
  }
 }
 console.log('Desktop collapse/expand, mobile navigation focus trap, Escape restoration and reduced-motion lighting passed.');
 let mobileLogouts=0;
 const mobileLogout=await makePage(({path,json})=>{
  if(path.endsWith('/auth/logout')){mobileLogouts++;return json(200,{message:'Signed out.'});}
  return json(200,path.endsWith('/auth/me')?{user}:inventory);
 });
 await mobileLogout.goto('http://127.0.0.1:5197/#/dashboard');
 for(const viewport of [{width:390,height:640},{width:320,height:480},{width:844,height:390}]){
  await mobileLogout.setViewportSize(viewport);
  await mobileLogout.getByRole('button',{name:'Open navigation',exact:true}).click();
  await mobileLogout.waitForFunction(()=>document.getElementById('workspace-navigation').getBoundingClientRect().left>=-0.5);
  const menu=mobileLogout.locator('#workspace-navigation');
  const box=await menu.boundingBox();
  assert.ok(box.height<=viewport.height+1,'Mobile sidebar must fit the visible viewport');
  await mobileLogout.mouse.move(box.x+box.width/2,viewport.height/2);
  await mobileLogout.mouse.wheel(0,2000);
  await mobileLogout.waitForFunction(()=>{
   const sidebar=document.getElementById('workspace-navigation');
   const button=sidebar.querySelector('.profile button');
   const rect=button.getBoundingClientRect();
   return sidebar.scrollTop>0&&rect.top>=0&&rect.bottom<=innerHeight;
  });
  assert.equal(await mobileLogout.evaluate(()=>document.body.style.overflow),'hidden');
  if(process.env.QA_SCREENSHOT_DIR)await mobileLogout.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/mobile-sign-out-${viewport.width}x${viewport.height}.png`,animations:'disabled'});
  if(viewport.width===844){
   await mobileLogout.getByRole('button',{name:'Sign out',exact:true}).click();
   await mobileLogout.waitForFunction(()=>sessionStorage.getItem('wba-auth-token')===null);
  }else await mobileLogout.keyboard.press('Escape');
 }
 assert.equal(mobileLogouts,1,'The reachable sign-out control must log out once');
 console.log('Mobile portrait, narrow and landscape sidebar scrolling and sign-out passed.');
 const retryIds=[];
 const uncertain=await makePage(({route,path,method,json})=>{
  if(method==='POST'&&path.endsWith('/inventory/movements')){
   retryIds.push(route.request().postDataJSON().requestId);
   return retryIds.length===1?route.abort('connectionrefused'):json(201,{data:{id:'QA-SAFE-RETRY'}});
  }
  return json(200,path.endsWith('/auth/me')?{user}:inventory);
 });
 await uncertain.goto('http://127.0.0.1:5197/#/stock-in');
 await uncertain.locator('select[name="productId"]').selectOption('1');
 await uncertain.locator('input[name="quantity"]').fill('2');
 await uncertain.locator('input[name="reference"]').fill('QA uncertain response');
 await uncertain.getByRole('button',{name:'Record stock in',exact:true}).click();
 await uncertain.getByRole('alert').filter({hasText:'The change may have saved.'}).waitFor();
 await uncertain.getByRole('button',{name:'Record stock in',exact:true}).click();
 await uncertain.waitForFunction(()=>document.querySelector('select[name="productId"]').value==='');
 assert.equal(retryIds.length,2);assert.ok(retryIds[0]);assert.equal(retryIds[0],retryIds[1]);
 const countedPayloads=[];
 const multiCount=await makePage(({route,path,method,json})=>{
  if(method==='POST'&&path.endsWith('/inventory/adjustments')){countedPayloads.push(route.request().postDataJSON());return json(201,{data:{id:'COUNT-SAFE'}});}
  return json(200,path.endsWith('/auth/me')?{user}:{...inventory,products:[{...products[0],stock:4,stockVersion:7}],batches:[{id:1,productId:1,number:'QA-A',location:'Main warehouse',quantity:2,receivedAt:'2030-01-01'},{id:2,productId:1,number:'QA-B',location:'Rack B',quantity:2,receivedAt:'2030-01-01'}]});
 });
 await multiCount.goto('http://127.0.0.1:5197/#/cycle-count');
 await multiCount.getByRole('button',{name:'Submit count result'}).click();assert.equal(countedPayloads.length,0);
 await multiCount.getByLabel('QA-A · Main warehouse',{exact:true}).fill('1');
 await multiCount.getByLabel('QA-B · Rack B',{exact:true}).fill('2');
 await multiCount.getByRole('button',{name:'Submit count result'}).click();await multiCount.locator('.success-note').waitFor();
 assert.equal(countedPayloads[0].requestedQty,3);assert.equal(countedPayloads[0].expectedStockVersion,7);
 assert.deepEqual(countedPayloads[0].batchCounts,[{batchId:1,quantity:1},{batchId:2,quantity:2}]);
 let historyLoads=0;
 const pagedReports=await makePage(({path,json})=>{
  if(path.includes('/inventory/history/transactions')){historyLoads++;return json(200,{data:Array.from({length:100},(_,index)=>({id:index+1,productId:1,type:'Stock Out',quantity:1,date:'2030-01-14T12:00:00Z',reference:'QA older',status:'Completed'})),meta:{current_page:2,last_page:2,total:101}});}
  return json(200,path.endsWith('/auth/me')?{user}:{...inventory,transactions:[{id:101,productId:1,type:'Stock Out',quantity:1,date:'2030-01-15T12:00:00Z',reference:'QA recent',status:'Completed',stockBefore:3,stockAfter:2}],history:{transactions:{total:101,throughId:101,nextPage:2},adjustments:{total:0,throughId:0,nextPage:null}}});
 });
 await pagedReports.goto('http://127.0.0.1:5197/#/reports');
 await pagedReports.getByLabel('Report type').selectOption('Stock Movement Report');
 await pagedReports.waitForFunction(()=>document.querySelectorAll('tbody tr').length===101);assert.equal(historyLoads,1);
 await pagedReports.getByLabel('From date',{exact:true}).fill('2030-01-15');await pagedReports.getByLabel('To date',{exact:true}).fill('2030-01-15');
 await pagedReports.waitForFunction(()=>document.querySelectorAll('tbody tr').length===1);
 const csvDownload=pagedReports.waitForEvent('download');await pagedReports.getByRole('button',{name:'Export CSV',exact:true}).click();
 const downloaded=await csvDownload;const csv=await readFile(await downloaded.path(),'utf8');
 assert.ok(csv.includes('QA recent'));assert.ok(!csv.includes('QA older'));assert.ok(csv.includes('Stock before'));
 console.log('Lost-response retry identifiers, required batch counts, complete paged reports, date filters and CSV download passed.');
 let trashRestores=0;let deletedRows=[{id:90,name:'Archived appliance',reference:'ARCHIVE-90',deletedAt:'2030-01-10T12:00:00Z',deletedBy:'QA Administrator'}];
 const trash=await makePage(async({route,path,method,json})=>{
  if(path.endsWith('/trash'))return json(200,{data:deletedRows,current_page:1,last_page:1});
  if(path.includes('/trash/products/90/restore')){trashRestores++;await new Promise(resolve=>setTimeout(resolve,1000));deletedRows=[];return json(200,{message:'Record restored.'});}
  return json(200,path.endsWith('/auth/me')?{user}:inventory);
 });
 await trash.setViewportSize({width:320,height:640});await trash.goto('http://127.0.0.1:5197/#/trash');await trash.getByRole('heading',{name:'Archived appliance'}).waitFor();
 await trash.getByRole('button',{name:'Restore',exact:true}).click();await trash.getByRole('dialog').waitFor();await trash.keyboard.press('Escape');assert.equal(trashRestores,0);
 await trash.getByRole('button',{name:'Restore',exact:true}).click();await trash.getByRole('button',{name:'Restore record',exact:true}).click();
 assert.ok(await trash.getByRole('button',{name:'Processing…',exact:true}).isDisabled());
 await trash.getByRole('heading',{name:'Trash is empty'}).waitFor();assert.equal(trashRestores,1);
 const noticeRows=[{id:'qa-notice',title:'Stock Out: Air conditioner',message:'A very important dispatch from Rack B. On hand: 10; usable: 3.',severity:'High',date:'2030-01-15T12:00:00Z',link:'/inventory/1',readAt:null}];
 let noticeReads=0;
 const notices=await makePage(({path,method,json})=>{
  if(path.endsWith('/notifications')&&method==='GET')return json(200,{data:noticeRows,meta:{current_page:1,last_page:1},unreadCount:noticeRows[0].readAt?0:1});
  if(path.endsWith('/read')&&method==='POST'){noticeReads++;noticeRows[0].readAt='2030-01-15T12:01:00Z';return json(200,{unreadCount:0});}
  return json(200,path.endsWith('/auth/me')?{user}:{...inventory,notificationSummary:{unreadCount:noticeRows[0].readAt?0:1}});
 });
 await notices.setViewportSize({width:320,height:640});await notices.goto('http://127.0.0.1:5197/#/notifications');await notices.getByRole('heading',{name:'Stock Out: Air conditioner'}).waitFor();
 await notices.getByRole('button',{name:'Mark as read',exact:true}).click();await notices.getByLabel('Notifications, 0 unread',{exact:true}).waitFor();assert.equal(noticeReads,1);
 await notices.reload();await notices.getByRole('heading',{name:'Stock Out: Air conditioner'}).waitFor();assert.equal(await notices.getByRole('button',{name:'Mark as read',exact:true}).count(),0);
 for(const viewport of [{width:1440,height:900},{width:390,height:640},{width:320,height:480},{width:844,height:390}]){
  for(const surface of [trash,notices]){await surface.setViewportSize(viewport);assert.ok(await surface.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Recovery and notification pages must fit viewport');}
 }
 await selectTheme(notices,'dark');assert.equal(await notices.locator('html').getAttribute('data-theme'),'dark');
 const restrictedTrash=await makePage(({path,json})=>json(200,path.endsWith('/auth/me')?{user:{...user,department:'Warehouse',roleLevel:'Staff'}}:inventory));
 await restrictedTrash.goto('http://127.0.0.1:5197/#/trash');await restrictedTrash.getByRole('heading',{name:'This module is not part of your assigned workspace.'}).waitFor();
 let backgroundLoads=0;
 const updates=await makePage(({path,json})=>{if(path.endsWith('/inventory'))backgroundLoads++;return json(200,path.endsWith('/auth/me')?{user}:{...inventory,loadedAt:'2030-01-15T12:00:00Z',notificationSummary:{unreadCount:backgroundLoads}});});
 await updates.clock.install();await updates.goto('http://127.0.0.1:5197/#/dashboard');await updates.getByRole('heading',{name:'Stock health distribution'}).waitFor();
 const firstLoads=backgroundLoads;await updates.clock.fastForward(31000);await updates.waitForFunction(count=>document.querySelector('.notification-count')?.textContent===String(count),firstLoads+1);
 await updates.goto('http://127.0.0.1:5197/#/stock-in');await updates.getByRole('heading',{name:'Stock In transaction'}).waitFor();const formLoads=backgroundLoads;await updates.clock.fastForward(31000);assert.equal(backgroundLoads,formLoads,'Background refresh must pause while a form is open');
 const recordedMonth=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth()-1,1)).toISOString().slice(0,7);
 const planningInventory={...inventory,products:[{...products[0],stock:10,usableStock:3,reorderPoint:4,demandPattern:'Seasonal-Critical',monthlySalesHistory:[{month:recordedMonth,quantity:60}],seasonalProfile:[{month:6,multiplier:2}]}],batches:[{id:1,productId:1,number:'EXPIRY-QA',location:'Rack B',quantity:3,receivedAt:'2026-01-01',expiresAt:'2099-01-01'}],transactions:[{id:1,productId:1,type:'Transfer',quantity:2,stockBefore:10,stockAfter:10,date:'2030-01-15T12:00:00Z'},{id:2,productId:1,type:'Adjustment',quantity:3,stockBefore:7,stockAfter:10,date:'2030-01-15T12:00:00Z'}]};
 const planning=await makePage(({path,json})=>json(200,path.endsWith('/auth/me')?{user}:planningInventory));
 await planning.setViewportSize({width:320,height:640});await planning.goto('http://127.0.0.1:5197/#/reorder-calculator');await planning.getByLabel('Planning month',{exact:true}).fill(`${new Date().getUTCFullYear()}-06`);
 assert.equal(await planning.getByLabel('Average monthly sales',{exact:true}).inputValue(),'60');assert.equal(await planning.getByLabel('Seasonal demand multiplier',{exact:true}).inputValue(),'2');assert.equal(await planning.locator('.reorder-result strong').textContent(),'5');
 await planning.goto('http://127.0.0.1:5197/#/inventory');await planning.getByRole('button',{name:'Edit',exact:true}).click();await planning.getByLabel('Sales month 1',{exact:true}).waitFor();assert.equal(await planning.getByLabel('Demand classification',{exact:true}).inputValue(),'Seasonal-Critical');
 assert.ok(await planning.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile planning editor must fit viewport');
 await planning.goto('http://127.0.0.1:5197/#/batches');await planning.getByLabel('EXPIRY-QA shelf life elapsed',{exact:true}).waitFor();assert.ok(await planning.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile batch timeline must fit viewport');
 await planning.goto('http://127.0.0.1:5197/#/dashboard');await planning.getByRole('heading',{name:'Stock health distribution'}).waitFor();assert.ok((await planning.locator('.activity-list').textContent()).includes('↔ 2'));assert.ok((await planning.locator('.activity-list').textContent()).includes('+3'));
 assert.ok(await planning.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile chart must fit viewport');
 console.log('Trash restore/cancellation, persisted notification read state, staff restrictions, mobile layouts, dark mode, automatic refresh with edit pause, historical planning, timeline and chart passed.');
 console.log('Page/dialog entrance, reduced-motion fallback, keyboard cancellation and pending-button progress passed.');
 console.log('Light/dark theme, system preference, stored choice after refresh, keyboard toggle, storage fallback, dialog contrast in both modes and responsive workspace passed.');
 console.log('Unknown routes, API-backed reorder defaults, empty calculator, API alerts, and theme checks passed.');
 console.log('401/403/404/500/network, forbidden route, and desktop/mobile navigation and overflow checks passed.');
 assert.deepEqual(errors,[]);console.log('Reviewer matrix, self-review prevention, empty Cycle Count, and login field errors passed. No browser exceptions.');
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await Promise.race([browser.close(),new Promise(r=>setTimeout(r,1000))]);await server.close();process.exit(process.exitCode||0);}
