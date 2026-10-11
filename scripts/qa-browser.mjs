import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
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
 assert.equal(await themeButton.getAttribute('aria-pressed'),'true');
 await publicPage.reload();await publicPage.getByRole('heading',{name:'A brighter way to keep stock moving.'}).waitFor();
 assert.equal(await publicPage.evaluate(()=>document.documentElement.dataset.theme),'dark');
 assert.equal(await publicPage.evaluate(()=>localStorage.getItem('sunshine-theme')),'dark');
 for(const mode of ['dark','light']){
  if(await publicPage.evaluate(()=>document.documentElement.dataset.theme)!==mode)await themeButton.click();
  assert.equal(await publicPage.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),mode);
  assert.equal(await publicPage.locator('.public-page').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
  for(const width of [1440,390]){
   await publicPage.setViewportSize({width,height:900});
   assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   if(process.env.QA_SCREENSHOT_DIR)await publicPage.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/sunshine-home-${mode}-${width}.png`,fullPage:true,animations:'disabled'});
  }
 }
 assert.equal(await publicPage.getByRole('link',{name:/Create.*account|Sign up/i}).count(),0);
 assert.match(await publicPage.locator('.public-caption').innerText(),/administrator/);
 for(const width of [1440,390]){
  await publicPage.setViewportSize({width,height:900});
  assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Landing overflow at ${width}`);
 }
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
  if(await page.evaluate(()=>document.documentElement.dataset.theme)!==mode)await page.getByRole('button',{name:'Dark mode',exact:true}).click();
  await page.goto('http://127.0.0.1:5197/#/users');await page.getByRole('heading',{name:'User management',exact:true}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'User management',exact:true}).waitFor();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${mode} workspace overflow at ${width}`);
   if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/sunshine-workspace-${mode}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  await privacy.getByRole('button',{name:'Dark mode',exact:true}).click();
  await privacy.getByRole('row').filter({hasText:'Alex Lopez'}).getByRole('button',{name:'Delete',exact:true}).click();
  await checkDialogContrast(privacy);await privacy.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 }
 const unavailableStorage=await makePage(({json})=>json(200,{}),false);
 await unavailableStorage.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}}));
 await unavailableStorage.goto('http://127.0.0.1:5197/#/sign-in');
 await unavailableStorage.getByRole('button',{name:'Dark mode',exact:true}).click();
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
   if(await motion.evaluate(()=>document.documentElement.dataset.theme)!==mode)await motion.getByRole('button',{name:'Dark mode',exact:true}).click();
   await motion.getByRole('button',{name:'Open navigation',exact:true}).click();
   await motion.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/sunshine-sidebar-${mode}-390.png`,fullPage:true,animations:'disabled'});
   await motion.keyboard.press('Escape');
  }
 }
 console.log('Desktop collapse/expand, mobile navigation focus trap, Escape restoration and reduced-motion lighting passed.');
 console.log('Page/dialog entrance, reduced-motion fallback, keyboard cancellation and pending-button progress passed.');
 console.log('Light/dark theme, system preference, stored choice after refresh, keyboard toggle, storage fallback, dialog contrast in both modes and responsive workspace passed.');
 console.log('Unknown routes, API-backed reorder defaults, empty calculator, API alerts, and theme checks passed.');
 console.log('401/403/404/500/network, forbidden route, and desktop/mobile navigation and overflow checks passed.');
 assert.deepEqual(errors,[]);console.log('Reviewer matrix, self-review prevention, empty Cycle Count, and login field errors passed. No browser exceptions.');
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await Promise.race([browser.close(),new Promise(r=>setTimeout(r,1000))]);await server.close();process.exit(process.exitCode||0);}
