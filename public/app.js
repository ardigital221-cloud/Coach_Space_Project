let ME = null;
let wChartInst = null;
let allStudents = [];
let _mVidFile = null;
let _mVidCatId = null;
let _mVidCatName = '';
let _uVidData = {};
let _pedDirty = false;
const EMOJIS = ['рџ‘Ќ','вќ¤пёЏ','рџ”Ґ','рџ‚','рџ®','рџ‘Џ','рџ’Є','вњ…'];

function _getToken(){return localStorage.getItem('auth_token');}
function _setToken(t){localStorage.setItem('auth_token',t);}
function _clearAuth(){localStorage.removeItem('auth_token');localStorage.removeItem('auth_id');}
function authFetch(url,opts={}){const t=_getToken();if(t){opts.headers=opts.headers||{};opts.headers['Authorization']='Bearer '+t;}return fetch(url,opts);}

async function api(url, method='GET', body=null) {
  const opts = { method, headers:{'Content-Type':'application/json'} };
  const token = _getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (r.status === 401) { _clearAuth(); ME=null; document.getElementById('app').classList.remove('show'); document.getElementById('bnav').style.display='none'; document.getElementById('loginPage').classList.add('show'); throw new Error('РЎРµСЃСЃРёСЏ РёСЃС‚РµРєР»Р°'); }
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`РЎРµСЂРІРµСЂ РІРµСЂРЅСѓР» РЅРµ JSON (СЃС‚Р°С‚СѓСЃ ${r.status}). РџСЂРѕРІРµСЂСЊС‚Рµ РєРѕРЅСЃРѕР»СЊ.`);
  }
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'РћС€РёР±РєР°');
  return d;
}

function togglePwd(){const i=document.getElementById('inP'),b=document.getElementById('eyeBtn');i.type==='password'?(i.type='text',b.textContent='рџ™€'):(i.type='password',b.textContent='рџ‘Ѓ');}

async function doLogin(){
  const login=document.getElementById('inL').value.trim(), pwd=document.getElementById('inP').value;
  const err=document.getElementById('loginErr'); err.style.display='none';
  if(!login||!pwd){err.style.display='block';err.textContent='Р’РІРµРґРёС‚Рµ Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ';return;}
  try{const r=await api('/api/login','POST',{login,password:pwd});ME=r.user;_setToken(r.token);localStorage.setItem('auth_id',ME.id);startApp();}
  catch(e){err.style.display='block';err.textContent=e.message;}
}
async function tryAutoLogin(){const id=localStorage.getItem('auth_id');if(!id||!_getToken())return false;try{ME=await api('/api/me/'+id);return true;}catch{_clearAuth();return false;}}
async function doLogout(){try{await api('/api/logout','POST');}catch(e){}ME=null;_clearAuth();document.getElementById('app').classList.remove('show');document.getElementById('bnav').style.display='none';document.getElementById('loginPage').classList.add('show');}
['inL','inP'].forEach(id=>document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();}));

function startApp(){
  document.getElementById('landingPage').classList.remove('show');
  document.getElementById('loginPage').classList.remove('show');
  document.getElementById('app').classList.add('show');
  document.getElementById('bnav').style.display='flex';
  document.getElementById('hName').textContent=(ME.name==='Tect'?'рџ”Ґ ':'')+ME.name;
  const r=document.getElementById('hRole');
  ME.role==='admin'?(r.textContent='РўСЂРµРЅРµСЂ',r.className='t-role ra'):(r.textContent='РЈС‡РµРЅРёРє',r.className='t-role rs');
  loadLocalFoods();
  buildNav();
  loadCrossEvent();
}

const TABS={
  admin:[{id:'ah',icon:'рџЏ ',lbl:'Р“Р»Р°РІРЅР°СЏ'},{id:'aprog',icon:'рџ“€',lbl:'РџСЂРѕРіСЂРµСЃСЃ'},{id:'avid',icon:'рџЋ¬',lbl:'Р’РёРґРµРѕ'},{id:'ashop',icon:'рџ›’',lbl:'РњР°РіР°Р·РёРЅ'},{id:'anut',icon:'рџҐ—',lbl:'РџРёС‚Р°РЅРёРµ'},{id:'across',icon:'рџ“‹',lbl:'Р—Р°РїРёСЃРё'}],
  user: [{id:'uh',icon:'рџЏ ',lbl:'Р“Р»Р°РІРЅР°СЏ'},{id:'uplan',icon:'рџ“‹',lbl:'РџР»Р°РЅ'},{id:'uprog',icon:'рџ“€',lbl:'РџСЂРѕРіСЂРµСЃСЃ'},{id:'ushop',icon:'рџ›’',lbl:'РњР°РіР°Р·РёРЅ'},{id:'unut',icon:'рџҐ—',lbl:'РџРёС‚Р°РЅРёРµ'}],
  cross:[{id:'ucross',icon:'рџЏѓ',lbl:'РљСЂРѕСЃСЃ'}]
};
let _currentTabId = null;
const _tabLastLoadedAt = {};
const _tabReloadTtlMs = {
  ap: 0,
  ah: 0,
  uh: 0,
  aprog: 12000,
  uprog: 12000,
  ashop: 10000,
  ushop: 10000,
  avid: 15000,
  uplan: 15000,
  anut: 15000,
  unut: 10000,
  across: 10000,
  ucross: 8000,
};
function buildNav(){
  const nav=document.getElementById('bnav'),tabs=ME.role==='admin'?TABS.admin:ME.role==='cross'?TABS.cross:TABS.user;
  nav.innerHTML=tabs.map((t,i)=>`<button class="nb${i===0?' active':''}" onclick="showTab('${t.id}',this)"><span class="ni">${t.icon}</span>${t.lbl}</button>`).join('');
  showTab(tabs[0].id,nav.querySelector('.nb'));
}
function _shouldReloadTab(tabId){
  const ttl = _tabReloadTtlMs[tabId] ?? 10000;
  if (ttl === 0) return true;
  const lastAt = _tabLastLoadedAt[tabId] || 0;
  return (Date.now() - lastAt) > ttl;
}
function _markTabLoaded(tabId){
  _tabLastLoadedAt[tabId] = Date.now();
}
function _loadTabData(tabId){
  if(tabId==='ah')    { loadAdminHome(); loadCalendar(); loadAdminWorkouts(); loadCrossEventAdmin(); }
  if(tabId==='aprog') loadProgPanel();
  if(tabId==='ashop') loadAdminShop();
  if(tabId==='uh')    loadUserHome();
  if(tabId==='uw')    loadUserWorkouts();
  if(tabId==='uprog') loadUserProgress();
  if(tabId==='ushop') loadUserShop();
  if(tabId==='uplan') { loadUserPlan(); loadUserVideoLibrary(); }
  if(tabId==='avid')  loadVideoLibrary();
  if(tabId==='anut')  loadAdminNutrition();
  if(tabId==='unut')  loadUserNutrition();
  if(tabId==='ucross') loadUserCross();
  if(tabId==='across') { loadAdminCross(); loadCrossEventAdmin(); }
}
function showTab(id,btn,forceReload=false){
  if(!forceReload && _currentTabId===id) return;
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('p-'+id).classList.add('active');
  const shouldReload = forceReload || _shouldReloadTab(id);
  if(shouldReload){
    _loadTabData(id);
    _markTabLoaded(id);
  }
  _currentTabId = id;
}

const galleryState = {};
let _shopItemsCache = [];
function _setShopCache(items){
  _shopItemsCache = Array.isArray(items) ? items : [];
}
function _getShopItemById(id){
  return _shopItemsCache.find(x=>x.id===id) || null;
}
function getItemPhotos(item){if(item.photos&&item.photos.length)return item.photos.map(p=>p.url||p);if(item.photoUrl)return[item.photoUrl];return[];}
function renderShopGallery(item,isAdmin){
  const photos=getItemPhotos(item);const id=item.id;
  if(!galleryState[id])galleryState[id]=0;
  const idx=Math.min(galleryState[id]||0,Math.max(0,photos.length-1));
  if(!photos.length){return`<div class="shop-gallery" id="gallery-${id}"><div class="shop-gallery-ph">рџ“¦</div>${isAdmin?`<label class="sg-add-photo-btn"><input type="file" accept="image/*" onchange="addShopPhoto('${id}',this)" style="display:none"/>рџ“· Р”РѕР±Р°РІРёС‚СЊ С„РѕС‚Рѕ</label>`:''}</div>`;}
  const dots=photos.length>1?`<div class="sg-dots">${photos.map((_,i)=>`<div class="sg-dot${i===idx?' a':''}" onclick="event.stopPropagation();gallerySwitchTo('${id}',${i})"></div>`).join('')}</div>`:'';
  return`<div class="shop-gallery" id="gallery-${id}"><img class="shop-gallery-img" id="gimg-${id}" src="${esc(photos[idx])}" alt="" onclick="openLightbox('${esc(photos[idx])}')" onerror="this.parentElement.classList.add('img-err')"/>${photos.length>1?`<button class="sg-arrow sg-l" onclick="event.stopPropagation();galleryPrev('${id}',${photos.length})">вЂ№</button><button class="sg-arrow sg-r" onclick="event.stopPropagation();galleryNext('${id}',${photos.length})">вЂє</button><div class="sg-count">${idx+1} / ${photos.length}</div>`:''} ${dots}${isAdmin?`<div class="sg-admin-bar"><button class="sg-del-btn" onclick="event.stopPropagation();delShopPhoto('${id}',${idx})">рџ—‘ РЈРґР°Р»РёС‚СЊ С„РѕС‚Рѕ</button><label class="sg-add-btn"><input type="file" accept="image/*" onchange="addShopPhoto('${id}',this)" style="display:none"/>+ Р¤РѕС‚Рѕ</label></div>`:''}</div>`;
}
function gallerySwitchTo(id,idx){galleryState[id]=idx;updateGalleryDOM(id);}
function galleryPrev(id,total){galleryState[id]=((galleryState[id]||0)-1+total)%total;updateGalleryDOM(id);}
function galleryNext(id,total){galleryState[id]=((galleryState[id]||0)+1)%total;updateGalleryDOM(id);}
function updateGalleryDOM(id){
  const item = _getShopItemById(id);
  if(!item) return;
  const photos = getItemPhotos(item);
  const idx = Math.min(galleryState[id] || 0, photos.length - 1);
  const gEl = document.getElementById('gallery-' + id);
  if(!gEl) return;
  const imgEl = document.getElementById('gimg-' + id);
  if(imgEl) imgEl.src = photos[idx];
  gEl.querySelectorAll('.sg-dot').forEach((d,i)=>d.classList.toggle('a', i===idx));
  const cnt = gEl.querySelector('.sg-count');
  if(cnt) cnt.textContent = `${idx + 1} / ${photos.length}`;
  const del = gEl.querySelector('.sg-del-btn');
  if(del) del.setAttribute('onclick', `event.stopPropagation();delShopPhoto('${id}',${idx})`);
}
async function addShopPhoto(itemId,input){const file=input.files[0];if(!file)return;toast('вЏі Р—Р°РіСЂСѓР·РєР°...','w');const fd=new FormData();fd.append('photo',file);try{const r=await authFetch(`/api/shop/${itemId}/photos`,{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error);toast('вњ… Р¤РѕС‚Рѕ РґРѕР±Р°РІР»РµРЅРѕ','s');input.value='';loadAdminShop();}catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}}
async function delShopPhoto(itemId,idx){if(!confirm('РЈРґР°Р»РёС‚СЊ СЌС‚Рѕ С„РѕС‚Рѕ?'))return;try{await api(`/api/shop/${itemId}/photos/${idx}`,'DELETE');toast('рџ—‘ Р¤РѕС‚Рѕ СѓРґР°Р»РµРЅРѕ','w');galleryState[itemId]=0;loadAdminShop();}catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}}
let _shFilesArr=[];
function prevShopMulti(e){_shFilesArr=Array.from(e.target.files);const prev=document.getElementById('shMultiPrev');prev.innerHTML=_shFilesArr.map((f,i)=>{const url=URL.createObjectURL(f);return`<div class="multi-prev-item" id="shprev-${i}"><img src="${url}" alt=""/><button class="multi-prev-del" onclick="removeShFile(${i})">вњ•</button></div>`;}).join('');}
function removeShFile(idx){_shFilesArr.splice(idx,1);const prev=document.getElementById('shMultiPrev');prev.innerHTML=_shFilesArr.map((f,i)=>{const url=URL.createObjectURL(f);return`<div class="multi-prev-item" id="shprev-${i}"><img src="${url}" alt=""/><button class="multi-prev-del" onclick="removeShFile(${i})">вњ•</button></div>`;}).join('');}
async function addShopItem(){const name=v('shN'),price=v('shP');if(!name||!price){toast('РќР°Р·РІР°РЅРёРµ Рё С†РµРЅР° РѕР±СЏР·Р°С‚РµР»СЊРЅС‹','e');return;}const fd=new FormData();fd.append('name',name);fd.append('price',price);_shFilesArr.forEach(f=>fd.append('photos',f));try{const r=await fetch('/api/shop',{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error);toast('вњ… РўРѕРІР°СЂ РґРѕР±Р°РІР»РµРЅ','s');closeMo('mAddShop');clr(['shN','shP']);document.getElementById('shFile').value='';document.getElementById('shMultiPrev').innerHTML='';_shFilesArr=[];loadAdminShop();}catch(e){toast(e.message,'e');}}
async function loadAdminShop(){const g=document.getElementById('aShopGrid');try{const items=await api('/api/shop');_setShopCache(items);if(!items.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="ei">рџ›’</div>РњР°РіР°Р·РёРЅ РїСѓСЃС‚</div>`;return;}g.innerHTML=items.map(i=>`<div class="shopi">${renderShopGallery(i,true)}<div class="sbody"><div class="sname">${esc(i.name)}</div><div class="sprice">${i.price} в‚ё</div><button class="btn btn-d sm" style="width:100%;margin-top:auto" onclick="delShopItem('${i.id}')">рџ—‘ РЈРґР°Р»РёС‚СЊ С‚РѕРІР°СЂ</button></div></div>`).join('');}catch(e){g.innerHTML=`<div class="empty">${e.message}</div>`;}}
async function delShopItem(id){if(!confirm('РЈРґР°Р»РёС‚СЊ С‚РѕРІР°СЂ?'))return;try{await api('/api/shop/'+id,'DELETE');delete galleryState[id];toast('РўРѕРІР°СЂ СѓРґР°Р»С‘РЅ','w');loadAdminShop();}catch(e){toast(e.message,'e');}}
async function loadUserShop(){const g=document.getElementById('uShopGrid');try{const items=await api('/api/shop');_setShopCache(items);if(!items.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="ei">рџ›’</div>РњР°РіР°Р·РёРЅ РїСѓСЃС‚</div>`;return;}g.innerHTML=items.map(i=>`<div class="shopi">${renderShopGallery(i,false)}<div class="sbody"><div class="sname">${esc(i.name)}</div><div class="sprice">${i.price} в‚ё</div><button class="btn btn-p sm" style="width:100%;margin-top:auto" onclick="orderItem('${i.id}','${esc(i.name)}')">Р—Р°РєР°Р·Р°С‚СЊ</button></div></div>`).join('');}catch(e){g.innerHTML=`<div class="empty">${e.message}</div>`;}}
async function orderItem(id,name){if(!confirm(`Р—Р°РєР°Р·Р°С‚СЊ В«${name}В»? РўСЂРµРЅРµСЂ РїРѕР»СѓС‡РёС‚ СѓРІРµРґРѕРјР»РµРЅРёРµ РІ Telegram.`))return;try{await api('/api/shop/'+id+'/order','POST',{userId:ME.id,userName:ME.name});toast('вњ… Р—Р°РєР°Р· РѕС‚РїСЂР°РІР»РµРЅ! РўСЂРµРЅРµСЂ СЃРІСЏР¶РµС‚СЃСЏ СЃ РІР°РјРё.','s');}catch(e){toast(e.message,'e');}}

let _pedPlan={1:[],2:[],3:[],4:[]},_pedWeek=1,_pedUserId='';
async function openUploadPlan(userId,userName){
  _pedUserId=userId;_pedDirty=false;
  document.getElementById('pedUserId').value=userId;
  document.getElementById('pedUserName').textContent='рџ‘¤ '+userName;
  _pedWeek=1;
  try{const data=await api('/api/users/'+userId+'/plan');_pedPlan=data.trainingPlan?{1:data.trainingPlan[1]||[],2:data.trainingPlan[2]||[],3:data.trainingPlan[3]||[],4:data.trainingPlan[4]||[]}:{1:[],2:[],3:[],4:[]};}catch{_pedPlan={1:[],2:[],3:[],4:[]};}
  if(!_pedPlan[1].length){_pedPlan[1]=[{block:'Р’РµСЂС…',exercise:'',sets:'',reps:''},{block:'РќРѕРіРё',exercise:'',sets:'',reps:''}];}
  const exSet=new Set();
  for(let w=1;w<=4;w++){(_pedPlan[w]||[]).forEach(e=>{if(e.exercise.trim())exSet.add(e.exercise.trim());});}
  const dl=document.getElementById('pedExSuggest');
  if(dl)dl.innerHTML=[...exSet].map(x=>`<option value="${esc(x)}">`).join('');
  pedRenderWeekTabs();pedRenderWeek();openMo('mPlanEditor');
}
function pedRenderWeekTabs(){const tabs=document.getElementById('pedWeekTabs');tabs.innerHTML=[1,2,3,4].map(w=>{const cnt=(_pedPlan[w]||[]).filter(e=>e.exercise).length;return`<button class="ped-week-tab${w===_pedWeek?' active':''}" onclick="pedSwitchWeek(${w})">РќРµРґРµР»СЏ ${w}<br><span style="font-size:10px;opacity:.6">${cnt} СѓРїСЂ.</span></button>`;}).join('');document.getElementById('pedCopyBar').style.display=_pedWeek===1?'flex':'none';}
function pedReadDOM(){const blockEls=document.querySelectorAll('.ped-block');if(!blockEls.length)return;const result=[];blockEls.forEach(blockEl=>{const blockNameInput=blockEl.querySelector('.ped-block-name');const blockName=blockNameInput?blockNameInput.value.trim():'';const rows=blockEl.querySelectorAll('.ped-ex-row[data-idx]');rows.forEach(row=>{const exercise=row.querySelector('.ped-ex-name')?.value?.trim()||'';const sets=row.querySelector('.ped-sets')?.value?.trim()||'';const reps=row.querySelector('.ped-reps')?.value?.trim()||'';result.push({block:blockName,exercise,sets,reps});});if(!rows.length)result.push({block:blockName,exercise:'',sets:'',reps:''});});_pedPlan[_pedWeek]=result;}
function pedSwitchWeek(w){pedReadDOM();_pedWeek=w;pedRenderWeekTabs();pedRenderWeek();}
function pedRenderWeek(){const box=document.getElementById('pedWeekContent');const items=_pedPlan[_pedWeek]||[];if(!items.length){box.innerHTML=`<div style="text-align:center;padding:24px;color:var(--mu2);font-size:13px">РќР°Р¶РјРё В«+ Р”РѕР±Р°РІРёС‚СЊ Р±Р»РѕРєВ» С‡С‚РѕР±С‹ РЅР°С‡Р°С‚СЊ</div>`;return;}const blockOrder=[],blockMap={};items.forEach((item,idx)=>{const b=item.block||'';if(!blockMap[b]){blockMap[b]=[];blockOrder.push(b);}blockMap[b].push({...item,_globalIdx:idx});});let html='';for(const blockName of blockOrder){const bItems=blockMap[blockName];html+=`<div class="ped-block" data-blockkey="${esc(blockName)}"><div class="ped-block-head"><span style="font-size:16px">рџ’Є</span><input class="ped-block-name" placeholder="РќР°Р·РІР°РЅРёРµ Р±Р»РѕРєР° (Р’РµСЂС…, РќРѕРіРё, Р СѓРєРё...)" value="${esc(blockName)}" data-original="${esc(blockName)}" onblur="pedRenameBlock(this)"/><button class="ped-block-del" onclick="pedDeleteBlock('${esc(blockName)}')" title="РЈРґР°Р»РёС‚СЊ Р±Р»РѕРє">вњ•</button></div><div class="ped-col-heads"><span></span><span>РЈРїСЂР°Р¶РЅРµРЅРёРµ</span><span style="text-align:center">РџРѕРґС…РѕРґС‹</span><span style="text-align:center">РџРѕРІС‚РѕСЂРµРЅРёСЏ</span><span></span></div>`;bItems.forEach(item=>{html+=`<div class="ped-ex-row" draggable="true" data-idx="${item._globalIdx}" data-block="${esc(blockName)}" ondragstart="pedDragStart(event,this)" ondragover="pedDragOver(event,this)" ondrop="pedDrop(event,this)" ondragend="pedDragEnd()"><span class="ped-drag-handle" title="РџРµСЂРµС‚Р°С‰РёС‚СЊ">в ї</span><input class="ped-fi ped-ex-name" placeholder="РќР°Р·РІР°РЅРёРµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ" value="${esc(item.exercise)}" oninput="_pedDirty=true" list="pedExSuggest"/><input class="ped-fi ped-fi sm ped-sets" placeholder="4" value="${esc(item.sets)}" oninput="_pedDirty=true"/><input class="ped-fi ped-fi sm ped-reps" placeholder="12" value="${esc(item.reps)}" oninput="_pedDirty=true"/><button class="ped-del-ex" onclick="pedDeleteEx(${item._globalIdx})">вњ•</button></div>`;});html+=`<button class="ped-add-ex" data-block="${esc(blockName)}" onclick="pedAddExBtn(this)">пј‹ РґРѕР±Р°РІРёС‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёРµ</button></div>`;}box.innerHTML=html;}
function pedAddBlock(){pedReadDOM();const existingBlocks=[...new Set((_pedPlan[_pedWeek]||[]).map(e=>e.block))];let newBlockName='РќРѕРІС‹Р№ Р±Р»РѕРє',counter=2;while(existingBlocks.includes(newBlockName)){newBlockName=`РќРѕРІС‹Р№ Р±Р»РѕРє ${counter}`;counter++;}_pedPlan[_pedWeek].push({block:newBlockName,exercise:'',sets:'',reps:''});pedRenderWeek();const blocks=document.querySelectorAll('.ped-block-name');if(blocks.length){const last=blocks[blocks.length-1];last.focus();last.select();}}
function pedAddExBtn(btn){pedAddEx(btn.dataset.block);}
function pedAddEx(blockName){pedReadDOM();const plan=_pedPlan[_pedWeek];let lastIdx=-1;plan.forEach((e,i)=>{if(e.block===blockName)lastIdx=i;});const insertAt=lastIdx>=0?lastIdx+1:plan.length;plan.splice(insertAt,0,{block:blockName,exercise:'',sets:'',reps:''});pedRenderWeek();const rows=document.querySelectorAll('.ped-ex-row');if(rows[insertAt])rows[insertAt].querySelector('.ped-ex-name')?.focus();}
function pedDeleteEx(idx){pedReadDOM();_pedPlan[_pedWeek].splice(idx,1);pedRenderWeek();}
function pedDeleteBlock(blockName){if(!confirm(`РЈРґР°Р»РёС‚СЊ Р±Р»РѕРє "${blockName}" СЃРѕ РІСЃРµРјРё СѓРїСЂР°Р¶РЅРµРЅРёСЏРјРё?`))return;pedReadDOM();_pedPlan[_pedWeek]=_pedPlan[_pedWeek].filter(e=>e.block!==blockName);pedRenderWeek();}
function pedRenameBlock(input){const oldName=input.dataset.original,newName=input.value.trim()||oldName;if(oldName===newName)return;(_pedPlan[_pedWeek]||[]).forEach(e=>{if(e.block===oldName)e.block=newName;});const blockEl=input.closest('.ped-block');if(blockEl){blockEl.dataset.blockkey=newName;blockEl.querySelectorAll('.ped-ex-row').forEach(row=>{row.dataset.block=newName;});const delBtn=blockEl.querySelector('.ped-block-del');if(delBtn)delBtn.setAttribute('onclick',`pedDeleteBlock('${esc(newName)}')`);const addBtn=blockEl.querySelector('.ped-add-ex');if(addBtn){addBtn.dataset.block=newName;}}input.dataset.original=newName;}
function copyWeekAny(){pedReadDOM();const from=parseInt(document.getElementById('pedCopyFrom').value);const toVal=document.getElementById('pedCopyTo').value;if(toVal!=='all'&&parseInt(toVal)===from){toast('Р’С‹Р±РµСЂРёС‚Рµ РґСЂСѓРіСѓСЋ РЅРµРґРµР»СЋ','e');return;}const src=JSON.parse(JSON.stringify(_pedPlan[from]));if(toVal==='all'){const others=[1,2,3,4].filter(w=>w!==from);if(!confirm(`РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РќРµРґРµР»СЋ ${from} РЅР° РІСЃРµ РѕСЃС‚Р°Р»СЊРЅС‹Рµ (${others.join(', ')})? Р”Р°РЅРЅС‹Рµ Р±СѓРґСѓС‚ Р·Р°РјРµРЅРµРЅС‹.`))return;others.forEach(w=>{_pedPlan[w]=JSON.parse(JSON.stringify(src));});toast(`вњ… РќРµРґРµР»СЏ ${from} СЃРєРѕРїРёСЂРѕРІР°РЅР° РЅР° РЅРµРґРµР»Рё ${others.join(', ')}`,'s');}else{const to=parseInt(toVal);if(!confirm(`РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РќРµРґРµР»СЋ ${from} в†’ РќРµРґРµР»СЋ ${to}? Р”Р°РЅРЅС‹Рµ РЅРµРґРµР»Рё ${to} Р±СѓРґСѓС‚ Р·Р°РјРµРЅРµРЅС‹.`))return;_pedPlan[to]=JSON.parse(JSON.stringify(src));toast(`вњ… РќРµРґРµР»СЏ ${from} в†’ РќРµРґРµР»СЏ ${to}`,'s');}pedRenderWeekTabs();}
async function savePlanEditor(){pedReadDOM();const clean={};for(let w=1;w<=4;w++){clean[w]=(_pedPlan[w]||[]).filter(e=>e.exercise.trim());}const total=Object.values(clean).reduce((s,a)=>s+a.length,0);if(!total){toast('Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ СѓРїСЂР°Р¶РЅРµРЅРёРµ','e');return;}try{await api('/api/users/'+_pedUserId+'/plan','POST',{trainingPlan:clean});_pedDirty=false;toast(`вњ… РџР»Р°РЅ СЃРѕС…СЂР°РЅС‘РЅ: ${total} СѓРїСЂР°Р¶РЅРµРЅРёР№`,'s');closeMo('mPlanEditor');allStudents=[];loadAdminHome();}catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}}

let _pedDragIdx=null,_pedDragBlock=null;
function pedDragStart(e,row){
  pedReadDOM();
  _pedDragIdx=parseInt(row.dataset.idx);
  _pedDragBlock=row.dataset.block;
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
}
function pedDragOver(e,row){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  document.querySelectorAll('.ped-ex-row').forEach(r=>r.classList.remove('drag-over'));
  row.classList.add('drag-over');
}
function pedDrop(e,row){
  e.preventDefault();
  const toIdx=parseInt(row.dataset.idx);
  const toBlock=row.dataset.block;
  if(_pedDragIdx===null||_pedDragIdx===toIdx)return;
  const plan=_pedPlan[_pedWeek];
  const item=plan.splice(_pedDragIdx,1)[0];
  item.block=toBlock;
  const newTo=toIdx>_pedDragIdx?toIdx-1:toIdx;
  plan.splice(newTo,0,item);
  _pedDirty=true;
  pedRenderWeek();
}
function pedDragEnd(){
  _pedDragIdx=null;_pedDragBlock=null;
  document.querySelectorAll('.ped-ex-row').forEach(r=>r.classList.remove('dragging','drag-over'));
}

let _trainingPlan=null,_currentWeek=1;
async function loadUserPlan(){const box=document.getElementById('uPlanContent');box.innerHTML=`<div class="empty"><div class="sp-ring" style="margin:20px auto"></div></div>`;try{const data=await api('/api/users/'+ME.id+'/plan');if(!data.trainingPlan){box.innerHTML=`<div class="plan-upload-hint"><div style="font-size:36px;margin-bottom:10px">рџ“‹</div><div style="font-weight:600;margin-bottom:6px">РџР»Р°РЅ С‚СЂРµРЅРёСЂРѕРІРѕРє РµС‰С‘ РЅРµ Р·Р°РіСЂСѓР¶РµРЅ</div><div>РўСЂРµРЅРµСЂ Р·Р°РіСЂСѓР·РёС‚ РІР°С€ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹Р№ РїР»Р°РЅ вЂ” РѕРЅ РїРѕСЏРІРёС‚СЃСЏ Р·РґРµСЃСЊ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё</div></div>`;return;}_trainingPlan=data.trainingPlan;if(data.planUpdatedAt){const d=new Date(data.planUpdatedAt);document.getElementById('planUpdatedAt').textContent='РѕР±РЅРѕРІР»С‘РЅ '+d.toLocaleDateString('ru-RU');}renderPlanWeek(_currentWeek);}catch(e){box.innerHTML=`<div class="empty">${e.message}</div>`;}}
function renderPlanWeek(week){_currentWeek=week;const box=document.getElementById('uPlanContent');if(!_trainingPlan)return;const exercises=_trainingPlan[week]||[];const BLOCK_ICONS={'РІРµСЂС…':'рџ’Є','РЅРѕРіРё':'рџ¦µ','СЂСѓРєРё':'рџ’Є','СЏРіРѕРґРёС†С‹':'рџЌ‘','СЃРїРёРЅР°':'рџЏ‹пёЏ','РіСЂСѓРґСЊ':'рџЏ‹пёЏ','РїР»РµС‡Рё':'рџЋЇ','РїСЂРµСЃСЃ':'рџ”Ґ','РєР°СЂРґРёРѕ':'рџЏѓ','СЂР°Р·РјРёРЅРєР°':'рџ¤ё'};function blockIcon(name){const low=(name||'').toLowerCase();for(const[kw,ic]of Object.entries(BLOCK_ICONS)){if(low.startsWith(kw))return ic;}return'рџ’Є';}let html=`<div class="week-switcher">`;for(let w=1;w<=4;w++){const cnt=(_trainingPlan[w]||[]).length;html+=`<button class="week-btn${w===week?' active':''}" onclick="renderPlanWeek(${w})">РќРµРґРµР»СЏ ${w}<br><span style="font-size:10px;opacity:.6">${cnt} СѓРїСЂ.</span></button>`;}html+=`</div>`;if(!exercises.length){html+=`<div class="plan-empty"><div style="font-size:36px;margin-bottom:8px">рџЏ–</div>РќРµРґРµР»СЏ ${week} РїРѕРєР° РїСѓСЃС‚Р°СЏ</div>`;box.innerHTML=html;return;}const blockOrder=[],blocks={};exercises.forEach((ex,idx)=>{const b=ex.block||'';if(!blocks[b]){blocks[b]=[];blockOrder.push(b);}blocks[b].push({...ex,num:idx+1});});for(const blockName of blockOrder){const exList=blocks[blockName];html+=`<div class="plan-block">`;if(blockName)html+=`<div class="plan-block-title">${blockIcon(blockName)} ${esc(blockName)}</div>`;html+=`<div><table class="ex-table"><thead><tr><th>#</th><th>РЈРїСЂР°Р¶РЅРµРЅРёРµ</th><th style="text-align:center">РџРѕРґС…РѕРґС‹</th><th style="text-align:center">РџРѕРІС‚РѕСЂРµРЅРёСЏ</th></tr></thead><tbody>`;exList.forEach(ex=>{html+=`<tr><td class="ex-num">${ex.num}</td><td style="font-weight:500">${esc(ex.exercise)}</td><td style="text-align:center"><span class="ex-sets">${ex.sets||'вЂ”'}</span></td><td style="text-align:center"><span class="ex-reps">${ex.reps||'вЂ”'}</span></td></tr>`;});html+=`</tbody></table></div><div class="ex-cards">`;exList.forEach(ex=>{html+=`<div class="ex-card"><div class="ex-card-num">${ex.num}</div><div class="ex-card-name">${esc(ex.exercise)}</div><div class="ex-card-meta"><div><div style="font-size:9px;color:var(--mu2);text-transform:uppercase">РџРѕРґС….</div><div class="ex-card-sets">${ex.sets||'вЂ”'}</div></div><div><div style="font-size:9px;color:var(--mu2);text-transform:uppercase">РџРѕРІС‚.</div><div class="ex-card-reps">${ex.reps||'вЂ”'}</div></div></div></div>`;});html+=`</div></div>`;}box.innerHTML=html;}

async function loadAdminHome(){loadAdminStats();loadAdminStudents();loadAdminPosts();}
async function loadAdminStats(){try{const s=await api('/api/users');allStudents=s;const today=new Date().toISOString().split('T')[0];document.getElementById('aStats').innerHTML=`<div class="sb"><div class="sn cg">${s.length}</div><div class="sl">РЈС‡РµРЅРёРєРѕРІ</div></div><div class="sb"><div class="sn cw">${s.filter(x=>x.sessions<=2&&x.sessions>0).length}</div><div class="sl">РњР°Р»Рѕ Р·Р°РЅСЏС‚РёР№</div></div><div class="sb"><div class="sn cr">${s.filter(x=>x.sessions<=0).length}</div><div class="sl">РђР±РѕРЅРµРјРµРЅС‚ 0</div></div><div class="sb"><div class="sn cw">${s.filter(x=>x.paymentDate===today).length}</div><div class="sl">РћРїР»Р°С‚Р° СЃРµРіРѕРґРЅСЏ</div></div>`;}catch(e){toast(e.message,'e');}}

async function loadAdminStudents(){
  const box=document.getElementById('aStudents');
  try{
    if(!allStudents.length){const s=await api('/api/users');allStudents=s;}
    if(!allStudents.length){box.innerHTML=`<div class="empty"><div class="ei">рџ‘Ґ</div>РќРµС‚ СѓС‡РµРЅРёРєРѕРІ</div>`;return;}
    renderStudentCards();
  }catch(e){box.innerHTML=`<div class="empty">${e.message}</div>`;}
}

function renderStudentCards(){
  const box=document.getElementById('aStudents');
  if(!box||!allStudents.length)return;
  const q=(document.getElementById('studentSearch')?.value||'').trim().toLowerCase();
  const list=q?allStudents.filter(u=>u.name.toLowerCase().includes(q)):allStudents;
  if(!list.length){box.innerHTML=`<div class="empty" style="padding:20px 0">рџ” РќРёРєРѕРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ</div>`;return;}
  const today=new Date().toISOString().split('T')[0];
  box.innerHTML=[...list].sort((a,b)=>a.sessions-b.sessions).map(u=>{
    let pillCls='pill-green',sessIcon='вњ…';
    if(u.sessions<=0){pillCls='pill-red';sessIcon='вќЊ';}
    else if(u.sessions<=2){pillCls='pill-yel';sessIcon='вљ пёЏ';}
    const pd=u.paymentDate?new Date(u.paymentDate).toLocaleDateString('ru-RU'):'вЂ”';
    const ptCls=u.paymentDate===today?'pill-yel':'pill-gray';
    const hasPlan=u.trainingPlan?true:false;
    return `<div class="student-card">
      <div class="sc-top">
        <div class="sc-ava">${u.name.charAt(0).toUpperCase()}</div>
        <div><div class="sc-name">${esc(u.name)}</div><div class="sc-login">рџ”‘ ${esc(u.login)}</div></div>
      </div>
      <div class="sc-pills">
        <span class="pill ${pillCls}">${sessIcon} ${u.sessions} Р·Р°РЅСЏС‚РёР№</span>
        <span class="pill ${ptCls}">рџ’і РћРїР»Р°С‚Р°: ${pd}${u.paymentDate===today?' вљ пёЏ':''}</span>
        ${u.telegramId?`<span class="pill pill-gray">вњ€пёЏ TG</span>`:''}
        ${hasPlan?`<span class="pill pill-green">рџ“‹ РџР»Р°РЅ РіРѕС‚РѕРІ</span>`:''}
      </div>
      <div class="sc-btns">
        <button class="mark-btn" data-id="${u.id}" data-name="${esc(u.name)}" onclick="markAtt(this.dataset.id,this.dataset.name)">вњ“ РћС‚РјРµС‚РёС‚СЊ С‚СЂРµРЅРёСЂРѕРІРєСѓ</button>
        <button class="btn btn-g sm" data-id="${u.id}" data-name="${esc(u.name)}" onclick="openUploadPlan(this.dataset.id,this.dataset.name)">рџ“‹ Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РїР»Р°РЅ</button>
        <button class="btn btn-g sm" data-id="${u.id}" onclick="openCopyPlanModal(this.dataset.id,'student')">рџ“‹ РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РїР»Р°РЅ</button>
        <button class="btn btn-g sm" data-id="${u.id}" data-name="${esc(u.name)}" onclick="openNotes(this.dataset.id,this.dataset.name)">рџ’¬ Р—Р°РјРµС‚РєРё</button>
        <button class="btn btn-w sm" data-id="${u.id}" data-name="${esc(u.name)}" onclick="resetWeight(this.dataset.id,this.dataset.name)">вљ–пёЏ РЎР±СЂРѕСЃРёС‚СЊ РІРµСЃ</button>
        <button class="btn btn-g sm" data-id="${u.id}" onclick="openEditUser(this.dataset.id)">вњЏпёЏ РР·РјРµРЅРёС‚СЊ</button>
        <button class="btn btn-d sm" data-id="${u.id}" onclick="delUser(this.dataset.id)">рџ—‘</button>
      </div>
    </div>`;
  }).join('');
}

async function markAtt(id,name){if(!confirm(`РћС‚РјРµС‚РёС‚СЊ С‚СЂРµРЅРёСЂРѕРІРєСѓ ${name}? (-1 Р·Р°РЅСЏС‚РёРµ)`))return;try{const r=await api(`/api/users/${id}/attendance`,'POST');toast(`вњ… ${name}: РѕСЃС‚Р°Р»РѕСЃСЊ ${r.sessions} Р·Р°РЅСЏС‚РёР№`,'s');allStudents=[];loadAdminHome();}catch(e){toast(e.message,'e');}}

async function loadAdminPosts(){const box=document.getElementById('aPosts');try{const posts=await api('/api/posts');if(!posts.length){box.innerHTML=`<div class="empty"><div class="ei">рџ“ў</div>РџРѕСЃС‚РѕРІ РЅРµС‚</div>`;return;}box.innerHTML=posts.map(p=>renderPost(p,true)).join('');}catch(e){box.innerHTML=`<div class="empty">${e.message}</div>`;}}

function renderPost(p,isAdmin){
  const dt=fmtDt(p.createdAt);
  let pollHtml='';
  if(p.hasPoll&&p.pollOptions?.length){const votes=p.votes||{};const total=Object.values(votes).reduce((s,a)=>s+(a?.length||0),0);const myVote=Object.entries(votes).find(([,arr])=>arr?.some(v=>v.userId===ME?.id))?.[0];pollHtml=`<div class="poll-wrap">`+p.pollOptions.map(opt=>{const cnt=votes[opt]?.length||0;const pct=total?Math.round(cnt/total*100):0;const isVoted=myVote===opt;let votersHtml='';if(isAdmin&&votes[opt]?.length){votersHtml=`<div class="poll-voters">РџСЂРѕРіРѕР»РѕСЃРѕРІР°Р»Рё: `+votes[opt].map(v=>`<b>${esc(v.userName)}</b>`).join(', ')+'</div>';}return`<div class="poll-opt ${isVoted?'voted':''}" onclick="${isAdmin?'':` votePost('${p.id}','${esc(opt)}')`}"><div class="poll-bar" style="width:${pct}%"></div><span class="poll-label">${esc(opt)}</span><span class="poll-count">${cnt} ${pct?'('+pct+'%)':''}</span></div>${votersHtml}`;}).join('')+'</div>';}
  const reactions=p.reactions||{};let reactHtml='';
  if(isAdmin){reactHtml=EMOJIS.filter(e=>reactions[e]?.length>0).map(emoji=>{const arr=reactions[emoji]||[];const myR=arr.some(r=>typeof r==='string'?r===ME?.id:r.userId===ME?.id);const count=arr.length;const names=arr.map(r=>typeof r==='string'?'?':esc(r.userName||'?')).join(', ');return`<div class="react-group"><button class="react-btn${myR?' active':''}" onclick="reactPost('${p.id}','${emoji}')">${emoji}<span class="react-count">${count}</span></button><div class="react-names">${names}</div></div>`;}).join('');}else{const myEmoji=EMOJIS.find(emoji=>{const arr=reactions[emoji]||[];return arr.some(r=>typeof r==='string'?r===ME?.id:r.userId===ME?.id);});reactHtml=EMOJIS.map(emoji=>{const arr=reactions[emoji]||[];const count=arr.length;const isMe=emoji===myEmoji;return`<button class="react-btn${isMe?' active':''}" onclick="reactPost('${p.id}','${emoji}')">${emoji}${count>0?`<span class="react-count">${count}</span>`:''}</button>`;}).join('');}
  return`<div class="post-card" id="post-${p.id}"><div class="post-txt">${esc(p.text)}</div>${p.link?`<a class="post-link" href="${p.link}" target="_blank">рџ”— РћС‚РєСЂС‹С‚СЊ СЃСЃС‹Р»РєСѓ</a>`:''} ${pollHtml}<div class="reactions-row">${reactHtml}</div><div class="post-meta"><div class="post-dt">${dt}</div>${isAdmin?`<button class="btn btn-d sm" onclick="delPost('${p.id}')">рџ—‘</button>`:''}</div></div>`;
}

function togglePoll(){const on=document.getElementById('pollToggle').checked;document.getElementById('pollEditor').classList.toggle('show',on);}
function addOpt(){const list=document.getElementById('pollOptsList');const div=document.createElement('div');div.className='poll-opt-input';div.innerHTML=`<input class="fi" placeholder="Р’Р°СЂРёР°РЅС‚"/><button class="del-opt-btn" onclick="delOpt(this)">вњ•</button>`;list.appendChild(div);}
function delOpt(btn){const row=btn.closest('.poll-opt-input');if(document.querySelectorAll('.poll-opt-input').length>1)row.remove();}
async function addPost(){const text=v('postTxt'),link=v('postLnk');if(!text){toast('РўРµРєСЃС‚ РѕР±СЏР·Р°С‚РµР»РµРЅ','e');return;}const hasPoll=document.getElementById('pollToggle').checked;const opts=hasPoll?[...document.querySelectorAll('#pollOptsList input')].map(i=>i.value.trim()).filter(Boolean):[];try{await api('/api/posts','POST',{text,link:link||null,hasPoll:hasPoll&&opts.length>0,pollOptions:opts});toast('вњ… РћРїСѓР±Р»РёРєРѕРІР°РЅРѕ','s');closeMo('mPost');clr(['postTxt','postLnk']);document.getElementById('pollToggle').checked=false;document.getElementById('pollEditor').classList.remove('show');document.getElementById('pollOptsList').innerHTML=`<div class="poll-opt-input"><input class="fi" placeholder="Р”Р°" value="Р”Р°"/><button class="del-opt-btn" onclick="delOpt(this)">вњ•</button></div><div class="poll-opt-input"><input class="fi" placeholder="РќРµС‚" value="РќРµС‚"/><button class="del-opt-btn" onclick="delOpt(this)">вњ•</button></div>`;loadAdminPosts();}catch(e){toast(e.message,'e');}}
async function delPost(id){if(!confirm('РЈРґР°Р»РёС‚СЊ РїРѕСЃС‚?'))return;try{await api('/api/posts/'+id,'DELETE');loadAdminPosts();}catch(e){toast(e.message,'e');}}
async function reactPost(postId,emoji){if(!ME)return;try{await api(`/api/posts/${postId}/react`,'POST',{userId:ME.id,userName:ME.name,emoji,single:true});const posts=await api('/api/posts');const p=posts.find(x=>x.id===postId);if(!p)return;const el=document.getElementById('post-'+postId);if(el)el.outerHTML=renderPost(p,ME.role==='admin');}catch(e){toast(e.message,'e');}}
async function votePost(postId,option){if(!ME)return;try{await api(`/api/posts/${postId}/vote`,'POST',{userId:ME.id,userName:ME.name,option});const posts=await api('/api/posts');const p=posts.find(x=>x.id===postId);if(!p)return;const el=document.getElementById('post-'+postId);if(el)el.outerHTML=renderPost(p,false);}catch(e){toast(e.message,'e');}}

async function addUser(){const name=v('uN'),login=v('uL'),pwd=v('uPw'),tg=v('uTg'),sess=v('uSe'),pd=v('uPd');if(!name||!login||!pwd){toast('РРјСЏ, Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹','e');return;}try{await api('/api/users','POST',{name,login,password:pwd,telegramId:tg||null,sessions:parseInt(sess)||0,paymentDate:pd||null});toast(`вњ… РЈС‡РµРЅРёРє ${name} РґРѕР±Р°РІР»РµРЅ`,'s');closeMo('mAddU');clr(['uN','uL','uPw','uTg','uPd']);document.getElementById('uSe').value='8';allStudents=[];loadAdminHome();}catch(e){toast(e.message,'e');}}
async function openEditUser(id){try{const u=await api('/api/users/'+id);document.getElementById('eId').value=u.id;document.getElementById('eN').value=u.name;document.getElementById('ePw').value='';document.getElementById('eTg').value=u.telegramId||'';document.getElementById('eSe').value=u.sessions;document.getElementById('ePd').value=u.paymentDate||'';openMo('mEditU');}catch(e){toast(e.message,'e');}}
async function saveEditUser(){const id=document.getElementById('eId').value;const d={name:v('eN'),telegramId:v('eTg')||null,sessions:parseInt(v('eSe'))||0,paymentDate:v('ePd')||null};const np=v('ePw');if(np)d.password=np;try{await api('/api/users/'+id,'PUT',d);toast('вњ… РЎРѕС…СЂР°РЅРµРЅРѕ','s');closeMo('mEditU');allStudents=[];loadAdminHome();}catch(e){toast(e.message,'e');}}
async function delUser(id){if(!confirm('РЈРґР°Р»РёС‚СЊ СѓС‡РµРЅРёРєР°?'))return;try{await api('/api/users/'+id,'DELETE');toast('РЈРґР°Р»С‘РЅ','w');allStudents=[];loadAdminHome();}catch(e){toast(e.message,'e');}}

async function loadAdminWorkouts(){const box=document.getElementById('aWorkouts');try{const ws=await api('/api/workouts');if(!ws.length){box.innerHTML=`<div class="empty"><div class="ei">рџЏ‹пёЏ</div>РўСЂРµРЅРёСЂРѕРІРѕРє РЅРµС‚. РЎРѕР·РґР°Р№С‚Рµ РїРµСЂРІСѓСЋ!</div>`;return;}const byDate={};ws.forEach(w=>{const d=new Date(w.datetime).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});if(!byDate[d])byDate[d]=[];byDate[d].push(w);});box.innerHTML=Object.entries(byDate).map(([date,items])=>`<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--mu2);margin-bottom:8px">${date}</div>${items.map(w=>renderWCard(w,true)).join('')}</div>`).join('');}catch(e){box.innerHTML=`<div class="empty">${e.message}</div>`;}}
function renderWCard(w,isAdmin){const time=new Date(w.datetime).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});const isGrp=w.type==='group';const chips=(w.studentIds||[]).map(sid=>{const s=allStudents.find(x=>x.id===sid);return`<span class="chip">${s?esc(s.name):sid}</span>`;}).join('');return`<div class="wcard ${isGrp?'group':''}"><div class="w-title">${esc(w.title)}<span class="wbadge ${isGrp?'wb-g':'wb-p'}">${isGrp?'Р“СЂСѓРїРїР°':'РџРµСЂСЃРѕРЅР°Р»СЊРЅР°СЏ'}</span></div><div class="w-meta">рџ•ђ ${time} В· вЏ± ${w.duration} РјРёРЅ</div>${chips?`<div class="w-chips">${chips}</div>`:''}${w.note?`<div class="w-note">рџ“ќ ${esc(w.note)}</div>`:''}${isAdmin?`<div><button class="btn btn-d sm" onclick="delWorkout('${w.id}')">рџ—‘ РЈРґР°Р»РёС‚СЊ</button></div>`:''}</div>`;}
async function delWorkout(id){if(!confirm('РЈРґР°Р»РёС‚СЊ?'))return;try{await api('/api/workouts/'+id,'DELETE');loadAdminWorkouts();}catch(e){toast(e.message,'e');}}
async function onOpenAddW(){const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());document.getElementById('wDt').value=now.toISOString().slice(0,16);const box=document.getElementById('wChecks');try{const s=allStudents.length?allStudents:await api('/api/users');allStudents=s;if(!s.length){box.innerHTML='<div style="color:var(--mu);font-size:13px">РќРµС‚ СѓС‡РµРЅРёРєРѕРІ</div>';return;}box.innerHTML=s.map(u=>`<label class="stu-check" id="sc-${u.id}"><input type="checkbox" value="${u.id}" onchange="document.getElementById('sc-${u.id}').classList.toggle('sel',this.checked)"/><span style="font-size:13px">${esc(u.name)}</span><span style="font-size:11px;color:var(--mu2);margin-left:auto">${u.sessions} Р·Р°РЅ.</span></label>`).join('');}catch(e){box.innerHTML=`<div style="color:var(--red);font-size:13px">${e.message}</div>`;}}
function onWType(){document.getElementById('wStuLbl').textContent=document.getElementById('wType').value==='group'?'РЈС‡РµРЅРёРєРё РіСЂСѓРїРїС‹':'РЈС‡РµРЅРёРє';}
async function createWorkout(){const title=v('wTitle'),type=document.getElementById('wType').value,dt=v('wDt'),dur=v('wDur'),note=v('wNote');if(!title||!dt){toast('РќР°Р·РІР°РЅРёРµ Рё РґР°С‚Р° РѕР±СЏР·Р°С‚РµР»СЊРЅС‹','e');return;}const ids=[...document.querySelectorAll('#wChecks input:checked')].map(c=>c.value);if(!ids.length){toast('Р’С‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕРіРѕ СѓС‡РµРЅРёРєР°','e');return;}try{await api('/api/workouts','POST',{title,type,datetime:dt,duration:parseInt(dur)||60,studentIds:ids,note:note||''});toast('вњ… РўСЂРµРЅРёСЂРѕРІРєР° СЃРѕР·РґР°РЅР°','s');closeMo('mAddW');clr(['wTitle','wNote']);document.getElementById('wDur').value='60';document.querySelectorAll('#wChecks input').forEach(c=>{c.checked=false;});document.querySelectorAll('.stu-check').forEach(l=>l.classList.remove('sel'));loadAdminWorkouts();}catch(e){toast(e.message,'e');}}

async function loadProgPanel(){try{const s=allStudents.length?allStudents:await api('/api/users');allStudents=s;const sel=document.getElementById('progSel');sel.innerHTML='<option value="">вЂ” РІС‹Р±РµСЂРёС‚Рµ СѓС‡РµРЅРёРєР° вЂ”</option>'+s.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');document.getElementById('progContent').innerHTML='';}catch(e){toast(e.message,'e');}}
async function loadAdminProg(){const uid=document.getElementById('progSel').value;const box=document.getElementById('progContent');if(!uid){box.innerHTML='';return;}box.innerHTML=`<div class="empty"><div class="sp-ring" style="margin:30px auto"></div></div>`;try{const[progressData,diaryData]=await Promise.all([authFetch('/api/progress/'+uid,{headers:{'Accept':'application/json'}}).then(r=>r.json()).catch(()=>[]),authFetch('/api/diary/'+uid,{headers:{'Accept':'application/json'}}).then(r=>r.json()).catch(()=>[])]);const weights=(Array.isArray(progressData)?progressData:[]).filter(d=>d.type==='weight');const photos=(Array.isArray(progressData)?progressData:[]).filter(d=>d.type==='photo');const entries=Array.isArray(diaryData)?diaryData:[];let html='';html+=`<div class="card card-a"><div class="ct">вљ–пёЏ Р“СЂР°С„РёРє РІРµСЃР°</div>`;html+=weights.length?`<div class="chart-w"><canvas id="adm-wc"></canvas></div>`:`<div class="empty" style="padding:20px 0"><div class="ei">вљ–пёЏ</div>РќРµС‚ РґР°РЅРЅС‹С… Рѕ РІРµСЃРµ</div>`;html+=`</div>`;if(photos.length){html+=`<div class="st" style="margin-bottom:10px">рџ“ё Р¤РѕС‚Рѕ РїСЂРѕРіСЂРµСЃСЃР°</div><div class="ph-g">`;html+=photos.map(p=>`<img class="ph-img" src="${p.photoUrl}" onclick="openLightbox('${p.photoUrl}')"/>`).join('');html+=`</div><div style="margin-bottom:16px"></div>`;}html+=`<div class="sh" style="margin-bottom:12px"><div class="st">рџ“Љ Р”РЅРµРІРЅРёРє С‚СЂРµРЅРёСЂРѕРІРѕРє</div><span style="font-size:12px;color:var(--mu2)">${entries.length} Р·Р°РїРёСЃРµР№</span></div>`;if(!entries.length){html+=`<div class="empty" style="padding:20px 0"><div class="ei">рџ“Љ</div>РЈС‡РµРЅРёРє РµС‰С‘ РЅРµ РІС‘Р» РґРЅРµРІРЅРёРє</div>`;}else{html+=entries.map(e=>{const stars=e.rating?'в­ђ'.repeat(e.rating):'';const d=new Date(e.date).toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short',year:'numeric'});const exCount=(e.exercises||[]).length;return`<div class="diary-day" style="cursor:default"><div class="diary-day-head"><span style="font-size:18px">рџЏ‹пёЏ</span><div><div class="diary-day-date">${d}</div><div class="diary-day-excount">${exCount} СѓРїСЂР°Р¶РЅРµРЅРёР№${e.note?' В· '+esc(e.note.slice(0,50)):''}</div></div><div class="diary-day-rating">${stars}</div></div>${(e.exercises||[]).length?`<div style="margin-top:10px">`+e.exercises.map(ex=>{const chips=(ex.sets||[]).map(s=>`<span class="diary-set-chip">${s.weight?s.weight+'РєРіГ—':''}${s.reps}</span>`).join('');return`<div class="diary-ex-row"><span class="diary-ex-name">${esc(ex.name)}</span><div class="diary-ex-sets">${chips}</div></div>`;}).join('')+`</div>`:''}</div>`;}).join('');}box.innerHTML=html;if(weights.length)new Chart(document.getElementById('adm-wc'),chartCfg(weights));}catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`;}}

async function loadUserHome(){try{ME=await api('/api/me/'+ME.id);}catch{}loadUserPosts();loadUserWorkouts();loadUserCalendar();}
async function loadUserPosts(){const box=document.getElementById('uPosts');try{const posts=await api('/api/posts');if(!posts.length){box.innerHTML=`<div class="empty"><div class="ei">рџ“ў</div>РќРѕРІРѕСЃС‚РµР№ РїРѕРєР° РЅРµС‚</div>`;return;}box.innerHTML=posts.map(p=>renderPost(p,false)).join('');}catch(e){box.innerHTML=`<div class="empty">${e.message}</div>`;}}
async function loadUserWorkouts(){const box=document.getElementById('uWorkouts');if(!box)return;box.innerHTML='<div class="empty"><div class="sp-ring" style="margin:16px auto"></div></div>';try{const ws=await api('/api/workouts?userId='+ME.id);if(!ws.length){box.innerHTML=`<div class="empty"><div class="ei">рџЏ‹пёЏ</div>РўСЂРµРЅРёСЂРѕРІРѕРє РїРѕРєР° РЅРµС‚</div>`;return;}const now=Date.now();const future=ws.filter(w=>new Date(w.datetime).getTime()>=now);const past=ws.filter(w=>new Date(w.datetime).getTime()<now).reverse();let html='';if(future.length){html+=`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--ac);margin-bottom:10px">РџСЂРµРґСЃС‚РѕСЏС‰РёРµ</div>`;html+=future.map(w=>`<div class="wcard ${w.type==='group'?'group':''}"><div class="w-title">${esc(w.title)}<span class="wbadge ${w.type==='group'?'wb-g':'wb-p'}">${w.type==='group'?'Р“СЂСѓРїРїР°':'Р›РёС‡РЅР°СЏ'}</span></div><div class="w-meta">рџ“… ${new Date(w.datetime).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} В· вЏ± ${w.duration} РјРёРЅ</div>${w.note?`<div class="w-note">рџ“ќ ${esc(w.note)}</div>`:''}</div>`).join('');}if(past.length){html+=`<div class="div"></div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--mu2);margin-bottom:10px">РСЃС‚РѕСЂРёСЏ</div>`;html+=past.slice(0,8).map(w=>`<div class="wcard" style="opacity:.5;border-left-color:var(--mu)"><div class="w-title">${esc(w.title)}</div><div class="w-meta">рџ“… ${new Date(w.datetime).toLocaleDateString('ru-RU')} В· вЏ± ${w.duration} РјРёРЅ</div></div>`).join('');}box.innerHTML=html;}catch(e){box.innerHTML=`<div class="empty">${e.message}</div>`;}}

let _uCalYear = new Date().getFullYear();
let _uCalMonth = new Date().getMonth();
let _uCalWorkouts = [];

async function loadUserCalendar(){
  try {
    _uCalWorkouts = await api('/api/workouts?userId='+ME.id);
  } catch(e){ _uCalWorkouts=[]; }
  renderUserCalendar();
}

function renderUserCalendar(){
  const grid = document.getElementById('uCalGrid');
  const label = document.getElementById('uCalMonthLabel');
  const events = document.getElementById('uCalEvents');
  if(!grid) return;
  const RU_M = ['РЇРЅРІР°СЂСЊ','Р¤РµРІСЂР°Р»СЊ','РњР°СЂС‚','РђРїСЂРµР»СЊ','РњР°Р№','РСЋРЅСЊ','РСЋР»СЊ','РђРІРіСѓСЃС‚','РЎРµРЅС‚СЏР±СЂСЊ','РћРєС‚СЏР±СЂСЊ','РќРѕСЏР±СЂСЊ','Р”РµРєР°Р±СЂСЊ'];
  const RU_D = ['РџРЅ','Р’С‚','РЎСЂ','Р§С‚','РџС‚','РЎР±','Р’СЃ'];
  label.textContent = RU_M[_uCalMonth] + ' ' + _uCalYear;
  const today = new Date().toISOString().split('T')[0];
  let html = RU_D.map(d=>`<div class="cal-head-cell">${d}</div>`).join('');
  const firstDay = new Date(_uCalYear, _uCalMonth, 1);
  const startDow = (firstDay.getDay()+6)%7;
  const daysInMonth = new Date(_uCalYear, _uCalMonth+1, 0).getDate();
  const daysInPrevM = new Date(_uCalYear, _uCalMonth, 0).getDate();
  for(let i=0;i<startDow;i++) html+=`<div class="cal-cell other-month">${daysInPrevM-startDow+1+i}</div>`;
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${_uCalYear}-${String(_uCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasW = _uCalWorkouts.some(w=>w.datetime&&w.datetime.startsWith(dateStr));
    const isToday = dateStr===today;
    let cls='cal-cell'+(hasW?' has-workout':'')+(isToday?' today':'');
    const dot = hasW?'<div class="cal-dots"><div class="cal-dot cal-dot-w"></div></div>':'';
    html+=`<div class="${cls}" onclick="showUserCalDay('${dateStr}')">${d}${dot}</div>`;
  }
  const total=startDow+daysInMonth;
  const remain=total%7===0?0:7-(total%7);
  for(let i=1;i<=remain;i++) html+=`<div class="cal-cell other-month">${i}</div>`;
  grid.innerHTML=html;
  events.innerHTML='';
}

function showUserCalDay(dateStr){
  const ws = _uCalWorkouts.filter(w=>w.datetime&&w.datetime.startsWith(dateStr));
  const box = document.getElementById('uCalEvents');
  if(!ws.length){ box.innerHTML=''; return; }
  const d = new Date(dateStr).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
  box.innerHTML=`<div style="margin-top:10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--ac);margin-bottom:8px">${d}</div>`+
    ws.map(w=>`<div class="wcard ${w.type==='group'?'group':''}"><div class="w-title">${esc(w.title)}<span class="wbadge ${w.type==='group'?'wb-g':'wb-p'}">${w.type==='group'?'Р“СЂСѓРїРїР°':'Р›РёС‡РЅР°СЏ'}</span></div><div class="w-meta">вЏ° ${new Date(w.datetime).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} В· вЏ± ${w.duration} РјРёРЅ</div>${w.note?`<div class="w-note">рџ“ќ ${esc(w.note)}</div>`:''}</div>`).join('');
}

function uCalPrev(){ _uCalMonth--; if(_uCalMonth<0){_uCalMonth=11;_uCalYear--;} renderUserCalendar(); }
function uCalNext(){ _uCalMonth++; if(_uCalMonth>11){_uCalMonth=0;_uCalYear++;} renderUserCalendar(); }

async function loadUserProgress(){document.getElementById('wtD').value=new Date().toISOString().split('T')[0];try{const data=await api('/api/progress/'+ME.id);const weights=data.filter(d=>d.type==='weight');const photos=data.filter(d=>d.type==='photo');if(wChartInst){wChartInst.destroy();wChartInst=null;}const chartBox=document.querySelector('#p-uprog .chart-w');if(chartBox){if(weights.length){chartBox.innerHTML='<canvas id="wChart"></canvas>';wChartInst=new Chart(document.getElementById('wChart'),chartCfg(weights));}else{chartBox.innerHTML=`<div class="empty"><div class="ei">вљ–пёЏ</div>Р”РѕР±Р°РІСЊС‚Рµ РїРµСЂРІСѓСЋ Р·Р°РїРёСЃСЊ РІРµСЃР°</div>`;}}const pg=document.getElementById('phGrid');pg.innerHTML=photos.length?photos.map(p=>`<div class="ph-wrap"><img class="ph-img" src="${p.photoUrl}" onclick="openLightbox('${esc(p.photoUrl)}')"/><button class="ph-del" onclick="deletePhoto('${p.id}',event)" title="РЈРґР°Р»РёС‚СЊ С„РѕС‚Рѕ">вњ•</button></div>`).join(''):`<div class="empty" style="grid-column:1/-1"><div class="ei">рџ“ё</div>РќРµС‚ С„РѕС‚Рѕ</div>`;}catch(e){toast('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РїСЂРѕРіСЂРµСЃСЃР°: '+e.message,'e');}}
async function addWeight(){const w=v('wtV'),d=v('wtD');if(!w){toast('Р’РІРµРґРёС‚Рµ РІРµСЃ','e');return;}try{await api('/api/progress','POST',{userId:ME.id,weight:w,date:d});toast('вњ… Р’РµСЃ СЃРѕС…СЂР°РЅС‘РЅ','s');closeMo('mAddWt');document.getElementById('wtV').value='';loadUserProgress();}catch(e){toast(e.message,'e');}}
function prevPhoto(e){const f=e.target.files[0];if(!f)return;const p=document.getElementById('phPrev');p.src=URL.createObjectURL(f);p.style.display='block';document.getElementById('phUpLbl').style.display='none';}
async function uploadPhoto(){const file=document.getElementById('phFile').files[0];if(!file){toast('Р’С‹Р±РµСЂРёС‚Рµ С„РѕС‚Рѕ','e');return;}toast('вЏі Р—Р°РіСЂСѓР·РєР° С„РѕС‚Рѕ...','w');const fd=new FormData();fd.append('userId',ME.id);fd.append('photo',file);try{const r=await authFetch('/api/progress/photo',{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error);toast('вњ… Р¤РѕС‚Рѕ Р·Р°РіСЂСѓР¶РµРЅРѕ','s');closeMo('mAddPh');document.getElementById('phFile').value='';document.getElementById('phPrev').style.display='none';document.getElementById('phUpLbl').style.display='flex';loadUserProgress();}catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}}
async function deletePhoto(photoId,e){if(e)e.stopPropagation();if(!confirm('РЈРґР°Р»РёС‚СЊ СЌС‚Рѕ С„РѕС‚Рѕ?'))return;try{await api('/api/progress/photo/'+photoId,'DELETE');toast('рџ—‘ Р¤РѕС‚Рѕ СѓРґР°Р»РµРЅРѕ','w');loadUserProgress();}catch(err){toast('РћС€РёР±РєР°: '+err.message,'e');}}

let _diaryRating=0;let _diaryPlan=null;let _diaryWeek=1;let _diaryActiveBlock=null;let _diaryEntryId=null;let _diaryExercises=[];let _diaryAllExercises=[];let _diaryCustomCount=0;
let _pickerCb=null;const _drumState={drum1:0,drum2:0};const _drumItems={drum1:[],drum2:[]};
function drumBuild(drumId,items){_drumItems[drumId]=items;_drumState[drumId]=0;const track=document.getElementById(drumId+'-track');track.innerHTML=items.map(v=>`<div class="drum-item">${v}</div>`).join('');drumApply(drumId);}
function drumApply(drumId){const idx=_drumState[drumId];const track=document.getElementById(drumId+'-track');track.style.transform=`translateY(${-idx*56}px)`;track.querySelectorAll('.drum-item').forEach((el,i)=>{el.style.opacity=i===idx?'1':'0.3';el.style.fontSize=i===idx?'22px':'16px';});}
function drumScroll(drumId,dir){const items=_drumItems[drumId];_drumState[drumId]=Math.max(0,Math.min(items.length-1,_drumState[drumId]+dir));drumApply(drumId);}
function openPicker(title,subtitle,opts,cb){_pickerCb=cb;document.getElementById('pickerTitle').textContent=title;document.getElementById('pickerSubtitle').textContent=subtitle||'';if(opts.type==='weight'){const integers=Array.from({length:301},(_,i)=>i);const decimals=['0','5'];const cur=parseFloat(opts.currentVal)||0;const intPart=Math.floor(cur);const decPart=(Math.round((cur-intPart)*10)===5)?1:0;drumBuild('drum1',integers);drumBuild('drum2',decimals);_drumState.drum1=Math.max(0,Math.min(300,intPart));_drumState.drum2=decPart;drumApply('drum1');drumApply('drum2');document.getElementById('drum2').style.display='flex';document.getElementById('pickerSep').style.display='flex';}else{const reps=Array.from({length:50},(_,i)=>i+1);const cur=parseInt(opts.currentVal)||1;drumBuild('drum1',reps);_drumState.drum1=Math.max(0,Math.min(49,cur-1));drumApply('drum1');document.getElementById('drum2').style.display='none';document.getElementById('pickerSep').style.display='none';}openMo('mPicker');setTimeout(initDrumTouchSupport,80);}
function pickerConfirm(){if(!_pickerCb){closeMo('mPicker');return;}const d2=document.getElementById('drum2');let val;if(d2.style.display!=='none'){const intPart=_drumItems.drum1[_drumState.drum1];const decPart=_drumItems.drum2[_drumState.drum2];val=parseFloat(`${intPart}.${decPart}`);}else{val=_drumItems.drum1[_drumState.drum1];}_pickerCb(val);closeMo('mPicker');}
function initDrumTouchSupport(){['drum1','drum2'].forEach(drumId=>{const vp=document.querySelector(`#${drumId} .drum-viewport`);if(!vp||vp._touchBound)return;vp._touchBound=true;let lastY=0;vp.addEventListener('touchstart',e=>{lastY=e.touches[0].clientY;},{passive:true});vp.addEventListener('touchmove',e=>{const dy=lastY-e.touches[0].clientY;lastY=e.touches[0].clientY;if(Math.abs(dy)>12)drumScroll(drumId,dy>0?1:-1);},{passive:true});vp.addEventListener('wheel',e=>{e.preventDefault();drumScroll(drumId,e.deltaY>0?1:-1);},{passive:false});});}
function diaryExerciseHTML(ex,idx){const setsHTML=ex.sets.map((s,si)=>`<div class="diary-set-row" id="setrow-${idx}-${si}"><div class="diary-set-num">${si+1}</div><div class="diary-set-field"><div class="diary-set-label">Р’РµСЃ РєРі</div><div class="diary-set-val wt" onclick="pickWeight(${idx},${si})">${s.weight!==''&&s.weight!==undefined?s.weight:'вЂ”'}</div></div><div class="diary-set-field"><div class="diary-set-label">РџРѕРІС‚</div><div class="diary-set-val rp" onclick="pickReps(${idx},${si})">${s.reps||'вЂ”'}</div></div><div class="diary-set-done ${s.done?'ok':''}" onclick="toggleSetDone(${idx},${si})">${s.done?'вњ“':'в—‹'}</div><button class="diary-set-del" onclick="delDiarySet(${idx},${si})">вњ•</button></div>`).join('');const isFromPlan=!ex.custom;const planHint=ex.planSets?`${ex.planSets}Г—${ex.planReps}`:'';return`<div class="diary-ex-card ${ex.expanded?'active':''}" id="dex-${idx}"><div class="diary-ex-header" onclick="toggleDiaryEx(${idx})"><div class="diary-ex-icon">${isFromPlan?'рџ“‹':'вћ•'}</div><div class="diary-ex-name-label">${esc(ex.name)}</div>${planHint?`<div class="diary-ex-plan-hint">${planHint}</div>`:''}<div class="diary-ex-toggle">в–ѕ</div></div><div class="diary-ex-body"><div class="diary-sets-list" id="setslist-${idx}">${setsHTML}</div><button class="diary-add-set-btn" onclick="addDiarySet(${idx})">+ Р”РѕР±Р°РІРёС‚СЊ РїРѕРґС…РѕРґ</button><button class="diary-ex-del-btn" onclick="removeDiaryEx(${idx})">вњ• РЈР±СЂР°С‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёРµ</button></div></div>`;}
function renderDiaryExList(){const box=document.getElementById('diaryExList');if(!_diaryExercises.length){box.innerHTML='';return;}const blockOrder=[],blockMap={};_diaryExercises.forEach((ex,idx)=>{const b=ex.block||'';if(!blockMap[b]){blockMap[b]=[];blockOrder.push(b);}blockMap[b].push({ex,idx});});let html='';for(const blockName of blockOrder){const items=blockMap[blockName];if(blockName){html+=`<div class="diary-plan-block-title">рџ’Є ${esc(blockName)}</div>`;}html+=items.map(({ex,idx})=>diaryExerciseHTML(ex,idx)).join('');}box.innerHTML=html;}
function toggleDiaryEx(idx){_diaryExercises[idx].expanded=!_diaryExercises[idx].expanded;renderDiaryExList();}
function pickWeight(exIdx,setIdx){const cur=_diaryExercises[exIdx].sets[setIdx].weight;openPicker('вљ–пёЏ Р’РµСЃ',_diaryExercises[exIdx].name,{type:'weight',currentVal:cur},val=>{_diaryExercises[exIdx].sets[setIdx].weight=val;renderDiaryExList();});}
function pickReps(exIdx,setIdx){const cur=_diaryExercises[exIdx].sets[setIdx].reps;openPicker('рџ”Ѓ РџРѕРІС‚РѕСЂРµРЅРёСЏ',_diaryExercises[exIdx].name,{type:'reps',currentVal:cur},val=>{_diaryExercises[exIdx].sets[setIdx].reps=val;renderDiaryExList();});}
function toggleSetDone(exIdx,setIdx){_diaryExercises[exIdx].sets[setIdx].done=!_diaryExercises[exIdx].sets[setIdx].done;renderDiaryExList();}
function delDiarySet(exIdx,setIdx){_diaryExercises[exIdx].sets.splice(setIdx,1);renderDiaryExList();}
function addDiarySet(exIdx){const sets=_diaryExercises[exIdx].sets;const lastSet=sets.length?sets[sets.length-1]:{};_diaryExercises[exIdx].sets.push({weight:lastSet.weight!==undefined?lastSet.weight:'',reps:lastSet.reps||(_diaryExercises[exIdx].planReps||''),done:false});_diaryExercises[exIdx].expanded=true;renderDiaryExList();}
function removeDiaryEx(idx){_diaryExercises.splice(idx,1);renderDiaryExList();}
function addDiaryEx(){_diaryCustomCount++;const name=prompt('РќР°Р·РІР°РЅРёРµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ:');if(!name||!name.trim())return;_diaryExercises.push({name:name.trim(),block:'',custom:true,planSets:'',planReps:'',expanded:true,sets:[{weight:'',reps:'',done:false}]});renderDiaryExList();}
function buildDefaultSets(ex){const count=parseInt(ex.sets)||3;const reps=ex.reps||'';return Array.from({length:count},()=>({weight:'',reps:reps,done:false}));}
function diarySelectWeek(week){_diaryWeek=week;_diaryActiveBlock=null;document.querySelectorAll('.diary-week-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.week)===week));renderBlockBtns();}
function renderBlockBtns(){const bar=document.getElementById('diaryBlockBar');const btns=document.getElementById('diaryBlockBtns');if(!_diaryPlan){bar.style.display='none';return;}const planWeek=_diaryPlan[_diaryWeek]||[];const exList=planWeek.filter(ex=>ex.exercise&&ex.exercise.trim());const blocks=[];const seen=new Set();exList.forEach(ex=>{const b=ex.block||'Р‘РµР· Р±Р»РѕРєР°';if(!seen.has(b)){seen.add(b);blocks.push(b);}});if(!blocks.length){bar.style.display='none';_diaryExercises=[];renderDiaryExList();return;}bar.style.display='block';if(!_diaryActiveBlock)_diaryActiveBlock=blocks[0];btns.innerHTML=blocks.map(b=>{const cnt=exList.filter(e=>(e.block||'Р‘РµР· Р±Р»РѕРєР°')===b).length;const isActive=b===_diaryActiveBlock;return`<button class="block-btn${isActive?' active':''}" onclick="diarySelectBlock('${b.replace(/'/g,"\\'")}'">${b}<span class="block-cnt">${cnt}</span></button>`;}).join('');loadBlockExercises();}
function diarySelectBlock(blockName){_diaryActiveBlock=blockName;document.querySelectorAll('.block-btn').forEach(b=>b.classList.toggle('active',b.textContent.trim().startsWith(blockName)));loadBlockExercises();}
function loadBlockExercises(){if(!_diaryPlan)return;flushCurrentBlockToStore();const planWeek=_diaryPlan[_diaryWeek]||[];const exList=planWeek.filter(ex=>ex.exercise&&ex.exercise.trim()&&(ex.block||'Р‘РµР· Р±Р»РѕРєР°')===_diaryActiveBlock);const stored=_diaryAllExercises.filter(e=>e.block===_diaryActiveBlock);if(stored.length){_diaryExercises=stored;}else{_diaryExercises=exList.map(ex=>({name:ex.exercise,block:ex.block||'Р‘РµР· Р±Р»РѕРєР°',custom:false,planSets:ex.sets||'',planReps:ex.reps||'',expanded:true,sets:buildDefaultSets(ex)}));_diaryAllExercises=_diaryAllExercises.filter(e=>e.block!==_diaryActiveBlock);_diaryAllExercises.push(..._diaryExercises);}renderDiaryExList();}
function flushCurrentBlockToStore(){if(!_diaryExercises.length)return;const curBlock=_diaryExercises[0]?.block;if(curBlock!==undefined){_diaryAllExercises=_diaryAllExercises.filter(e=>e.block!==curBlock);_diaryAllExercises.push(..._diaryExercises);}}
async function openDiaryModal(){_diaryEntryId=null;_diaryRating=0;_diaryExercises=[];_diaryAllExercises=[];_diaryActiveBlock=null;document.getElementById('diaryDate').value=new Date().toISOString().split('T')[0];document.getElementById('diaryNote').value='';document.getElementById('diaryModalTitle').textContent='рџ“Љ Р—Р°РїРёСЃСЊ С‚СЂРµРЅРёСЂРѕРІРєРё';document.getElementById('diarySaveBtn').setAttribute('onclick','saveDiary()');document.querySelectorAll('#starRow .star-btn').forEach(b=>b.classList.remove('active'));try{const data=await api('/api/users/'+ME.id+'/plan');_diaryPlan=data.trainingPlan||null;}catch{_diaryPlan=null;}const weekBar=document.getElementById('diaryWeekBar');const weekBtns=document.getElementById('diaryWeekBtns');if(_diaryPlan){weekBar.style.display='block';weekBtns.innerHTML=[1,2,3,4].map(w=>{const cnt=(_diaryPlan[w]||[]).filter(e=>e.exercise).length;return`<button class="week-btn diary-week-btn${w===1?' active':''}" data-week="${w}" onclick="diarySelectWeek(${w})">РќРµРґ. ${w}<span class="block-cnt">${cnt}</span></button>`;}).join('');_diaryWeek=1;renderBlockBtns();}else{weekBar.style.display='none';document.getElementById('diaryBlockBar').style.display='none';renderDiaryExList();}openMo('mDiary');}
function setStar(n){_diaryRating=n;document.querySelectorAll('#starRow .star-btn').forEach((b,i)=>b.classList.toggle('active',i<n));}
async function saveDiary(){const date=document.getElementById('diaryDate').value;if(!date){toast('РЈРєР°Р¶РёС‚Рµ РґР°С‚Сѓ','e');return;}flushCurrentBlockToStore();const allEx=[..._diaryAllExercises,..._diaryExercises.filter(e=>e.custom&&!_diaryAllExercises.find(x=>x===e))];const exercises=allEx.map(ex=>({name:ex.name,sets:ex.sets.filter(s=>s.reps).map(s=>({weight:s.weight!==''?s.weight:'',reps:parseInt(s.reps)||0}))})).filter(ex=>ex.sets.length);if(!exercises.length){toast('Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ СѓРїСЂР°Р¶РЅРµРЅРёРµ СЃ РїРѕРґС…РѕРґР°РјРё','e');return;}const note=document.getElementById('diaryNote').value;try{const r=await authFetch('/api/diary/'+ME.id,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({date,exercises,note,rating:_diaryRating||null})});const d=await r.json();if(!r.ok)throw new Error(d.error||'РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');toast('вњ… РўСЂРµРЅРёСЂРѕРІРєР° СЃРѕС…СЂР°РЅРµРЅР°!','s');closeMo('mDiary');loadDiary();}catch(e){toast(e.message,'e');}}
async function saveDiaryEdit(entryId){const date=document.getElementById('diaryDate').value;if(!date){toast('РЈРєР°Р¶РёС‚Рµ РґР°С‚Сѓ','e');return;}const exercises=_diaryExercises.map(ex=>({name:ex.name,sets:ex.sets.filter(s=>s.reps).map(s=>({weight:s.weight!==''?s.weight:'',reps:parseInt(s.reps)||0}))})).filter(ex=>ex.sets.length);if(!exercises.length){toast('Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ СѓРїСЂР°Р¶РЅРµРЅРёРµ СЃ РїРѕРґС…РѕРґР°РјРё','e');return;}const note=document.getElementById('diaryNote').value;try{await api('/api/diary/'+ME.id+'/'+entryId,'PUT',{date,exercises,note,rating:_diaryRating||null});toast('вњ… Р—Р°РїРёСЃСЊ РѕР±РЅРѕРІР»РµРЅР°!','s');closeMo('mDiary');loadDiary();}catch(e){toast(e.message,'e');}}
async function loadDiary(){const box=document.getElementById('diaryList');box.innerHTML='<div class="empty"><div class="sp-ring" style="margin:20px auto"></div></div>';try{const r=await authFetch('/api/diary/'+ME.id,{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('РЎС‚Р°С‚СѓСЃ '+r.status);const ct=r.headers.get('content-type')||'';if(!ct.includes('application/json'))throw new Error('РЎРµСЂРІРµСЂ РІРµСЂРЅСѓР» РЅРµ JSON. РџСЂРѕРІРµСЂСЊС‚Рµ server.js');const entries=await r.json();if(!entries.length){box.innerHTML='<div class="empty"><div class="ei">рџ“Љ</div>РќР°С‡РЅРё Р·Р°РїРёСЃС‹РІР°С‚СЊ С‚СЂРµРЅРёСЂРѕРІРєРё!<br><small style="color:var(--mu)">РќР°Р¶РјРё В«+ Р—Р°РїРёСЃСЊВ» С‡С‚РѕР±С‹ РґРѕР±Р°РІРёС‚СЊ</small></div>';return;}box.innerHTML=entries.map(e=>{const stars=e.rating?'в­ђ'.repeat(e.rating):'';const exCount=(e.exercises||[]).length;const d=new Date(e.date).toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short'});return`<div class="diary-day" id="diary-${e.id}"><div class="diary-day-head"><span style="font-size:18px">рџЏ‹пёЏ</span><div><div class="diary-day-date">${d}</div><div class="diary-day-excount">${exCount} СѓРїСЂР°Р¶РЅРµРЅРёР№${e.note?' В· '+esc(e.note.slice(0,40)):''}</div></div><div class="diary-day-rating">${stars}</div></div>${(e.exercises||[]).length?'<div style="margin-top:10px">'+e.exercises.map(ex=>{const chips=(ex.sets||[]).map(s=>`<span class="diary-set-chip">${s.weight?s.weight+'РєРіГ—':''}${s.reps}</span>`).join('');return`<div class="diary-ex-row"><span class="diary-ex-name">${esc(ex.name)}</span><div class="diary-ex-sets">${chips}</div></div>`;}).join('')+'</div>':''}<div class="diary-day-actions"><button class="btn btn-g sm" onclick="editDiary('${e.id}')">вњЏпёЏ Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ</button><button class="btn btn-d sm" onclick="deleteDiary('${e.id}')">рџ—‘ РЈРґР°Р»РёС‚СЊ</button></div></div>`;}).join('');}catch(e){box.innerHTML=`<div class="empty"><div class="ei">рџ“Љ</div>${esc(e.message)}</div>`;console.error('loadDiary:',e);}}
function resetDiaryModal(){document.getElementById('diarySaveBtn').setAttribute('onclick','saveDiary()');document.getElementById('diaryModalTitle').textContent='рџ“Љ Р—Р°РїРёСЃСЊ С‚СЂРµРЅРёСЂРѕРІРєРё';}
async function deleteDiary(entryId){if(!confirm('РЈРґР°Р»РёС‚СЊ Р·Р°РїРёСЃСЊ С‚СЂРµРЅРёСЂРѕРІРєРё?'))return;try{await api('/api/diary/'+ME.id+'/'+entryId,'DELETE');toast('рџ—‘ Р—Р°РїРёСЃСЊ СѓРґР°Р»РµРЅР°','w');loadDiary();}catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}}
async function editDiary(entryId){try{const r=await authFetch('/api/diary/'+ME.id,{headers:{'Accept':'application/json'}});const entries=await r.json();const e=entries.find(x=>x.id===entryId);if(!e){toast('Р—Р°РїРёСЃСЊ РЅРµ РЅР°Р№РґРµРЅР°','e');return;}_diaryEntryId=entryId;_diaryRating=e.rating||0;document.getElementById('diaryDate').value=e.date;document.getElementById('diaryNote').value=e.note||'';document.getElementById('diaryModalTitle').textContent='вњЏпёЏ Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ Р·Р°РїРёСЃСЊ';document.getElementById('diarySaveBtn').setAttribute('onclick',`saveDiaryEdit('${entryId}')`);document.querySelectorAll('#starRow .star-btn').forEach((b,i)=>b.classList.toggle('active',i<_diaryRating));document.getElementById('diaryWeekBar').style.display='none';_diaryExercises=(e.exercises||[]).map(ex=>({name:ex.name,block:'',custom:true,planSets:'',planReps:'',expanded:true,sets:(ex.sets||[]).map(s=>({weight:s.weight!==undefined?s.weight:'',reps:s.reps||'',done:false}))}));renderDiaryExList();openMo('mDiary');}catch(err){toast('РћС€РёР±РєР°: '+err.message,'e');}}

let _calYear=new Date().getFullYear(),_calMonth=new Date().getMonth(),_calWorkouts=[];
const RU_MONTHS=['РЇРЅРІР°СЂСЊ','Р¤РµРІСЂР°Р»СЊ','РњР°СЂС‚','РђРїСЂРµР»СЊ','РњР°Р№','РСЋРЅСЊ','РСЋР»СЊ','РђРІРіСѓСЃС‚','РЎРµРЅС‚СЏР±СЂСЊ','РћРєС‚СЏР±СЂСЊ','РќРѕСЏР±СЂСЊ','Р”РµРєР°Р±СЂСЊ'];
const RU_DAYS=['РџРЅ','Р’С‚','РЎСЂ','Р§С‚','РџС‚','РЎР±','Р’СЃ'];
async function loadCalendar(){try{const[ws,students]=await Promise.all([api('/api/workouts'),allStudents.length?Promise.resolve(allStudents):api('/api/users')]);_calWorkouts=ws;if(students.length)allStudents=students;renderCalendar();}catch(e){console.error(e);}}
function calPrev(){_calMonth--;if(_calMonth<0){_calMonth=11;_calYear--;}renderCalendar();}
function calNext(){_calMonth++;if(_calMonth>11){_calMonth=0;_calYear++;}renderCalendar();}
function renderCalendar(){document.getElementById('calMonthLabel').textContent=RU_MONTHS[_calMonth]+' '+_calYear;const grid=document.getElementById('calGrid');const today=new Date().toISOString().split('T')[0];const paymentDates=new Set(allStudents.map(s=>s.paymentDate).filter(Boolean));let html=RU_DAYS.map(d=>`<div class="cal-head-cell">${d}</div>`).join('');const firstDay=new Date(_calYear,_calMonth,1);const startDow=(firstDay.getDay()+6)%7;const daysInMonth=new Date(_calYear,_calMonth+1,0).getDate();const daysInPrevM=new Date(_calYear,_calMonth,0).getDate();for(let i=0;i<startDow;i++)html+=`<div class="cal-cell other-month">${daysInPrevM-startDow+1+i}</div>`;for(let d=1;d<=daysInMonth;d++){const dateStr=`${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const hasW=_calWorkouts.some(w=>w.datetime&&w.datetime.startsWith(dateStr));const hasP=paymentDates.has(dateStr);const isToday=dateStr===today;let cls='cal-cell';if(hasW)cls+=' has-workout';if(hasP)cls+=' has-payment';if(isToday)cls+=' today';let dots='';if(hasW||hasP){dots='<div class="cal-dots">';if(hasW)dots+=`<div class="cal-dot cal-dot-w"></div>`;if(hasP)dots+=`<div class="cal-dot cal-dot-p"></div>`;dots+='</div>';}html+=`<div class="${cls}" onclick="showCalDay('${dateStr}')">${d}${dots}</div>`;}const total=startDow+daysInMonth;const remain=total%7===0?0:7-(total%7);for(let i=1;i<=remain;i++)html+=`<div class="cal-cell other-month">${i}</div>`;grid.innerHTML=html;document.getElementById('calEvents').innerHTML='';}
function showCalDay(dateStr){const ws=_calWorkouts.filter(w=>w.datetime&&w.datetime.startsWith(dateStr));const payers=allStudents.filter(s=>s.paymentDate===dateStr);const evBox=document.getElementById('calEvents');const d=new Date(dateStr).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});if(!ws.length&&!payers.length){evBox.innerHTML=`<div style="color:var(--mu2);font-size:13px;padding:10px 0">${d} вЂ” СЃРѕР±С‹С‚РёР№ РЅРµС‚</div>`;return;}let html=`<div style="font-size:12px;font-weight:700;color:var(--mu2);text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px">${d}</div>`;ws.forEach(w=>{const t=new Date(w.datetime).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});html+=`<div class="cal-event" style="border-left:3px solid var(--ac)"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">рџЏ‹пёЏ</span><div><div style="font-weight:600;font-size:13px">${esc(w.title)}</div><div style="font-size:12px;color:var(--mu2)">${t} В· ${w.type==='group'?'рџ‘Ґ Р“СЂСѓРїРїР°':'рџ‘¤ Р›РёС‡РЅР°СЏ'} В· ${w.duration} РјРёРЅ</div></div></div></div>`;});payers.forEach(s=>{const sessColor=s.sessions<=0?'var(--red)':s.sessions<=2?'var(--yel)':'var(--ac)';html+=`<div class="cal-event" style="border-left:3px solid var(--yel);background:rgba(251,191,36,.06)"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">рџ’і</span><div><div style="font-weight:600;font-size:13px">${esc(s.name)}</div><div style="font-size:12px;color:var(--mu2)">Р”Р°С‚Р° РѕРїР»Р°С‚С‹ В· <span style="color:${sessColor};font-weight:600">${s.sessions} Р·Р°РЅСЏС‚РёР№</span></div></div></div></div>`;});evBox.innerHTML=html;}

let _reviewRating=0;
function setReviewStar(n){_reviewRating=n;document.querySelectorAll('#reviewStarRow .star-btn').forEach((b,i)=>b.classList.toggle('active',i<n));}
async function submitReview(){if(!_reviewRating){toast('Р’С‹Р±РµСЂРёС‚Рµ РѕС†РµРЅРєСѓ','e');return;}const text=document.getElementById('reviewText').value.trim();try{await api('/api/reviews','POST',{userId:ME.id,userName:ME.name,rating:_reviewRating,text});toast('в­ђ РЎРїР°СЃРёР±Рѕ Р·Р° РѕС‚Р·С‹РІ!','s');closeMo('mReview');_reviewRating=0;setReviewStar(0);document.getElementById('reviewText').value='';}catch(e){toast(e.message,'e');}}
async function loadReviews(){const box=document.getElementById('reviewsList'),avgBox=document.getElementById('avgRating');box.innerHTML='<div class="empty"><div class="sp-ring" style="margin:20px auto"></div></div>';avgBox.innerHTML='';try{const r=await authFetch('/api/reviews',{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('РЎРµСЂРІРµСЂ РІРµСЂРЅСѓР» СЃС‚Р°С‚СѓСЃ '+r.status);const ct=r.headers.get('content-type')||'';if(!ct.includes('application/json')){box.innerHTML='<div class="empty"><div class="ei">в­ђ</div>РћС‚Р·С‹РІРѕРІ РїРѕРєР° РЅРµС‚</div>';return;}const reviews=await r.json();if(!reviews.length){box.innerHTML='<div class="empty"><div class="ei">в­ђ</div>РћС‚Р·С‹РІРѕРІ РїРѕРєР° РЅРµС‚</div>';return;}reviews.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));const avg=(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1);const stars=Math.round(avg);avgBox.innerHTML=`<div class="avg-rating"><div class="avg-num">${avg}</div><div class="avg-stars">${'в­ђ'.repeat(stars)}${'в†'.repeat(5-stars)}</div><div class="avg-count">${reviews.length} РѕС‚Р·С‹РІРѕРІ</div></div>`;box.innerHTML=reviews.map(rv=>{const d=new Date(rv.createdAt).toLocaleDateString('ru-RU');const ratingStars='в­ђ'.repeat(Math.min(5,Math.max(1,rv.rating)));const delBtn=ME?.role==='admin'?`<button class="btn btn-d sm" style="margin-top:8px" onclick="delReview('${rv.id}')">рџ—‘ РЈРґР°Р»РёС‚СЊ</button>`:'';return`<div class="review-card"><div class="review-head"><div class="review-ava">${(rv.userName||'?').charAt(0).toUpperCase()}</div><div><div class="review-name">${esc(rv.userName||'РЈС‡РµРЅРёРє')}</div><div class="review-stars">${ratingStars}</div></div><div class="review-date">${d}</div></div>${rv.text?`<div class="review-text">${esc(rv.text)}</div>`:''}${delBtn}</div>`;}).join('');}catch(e){box.innerHTML=`<div class="empty"><div class="ei">в­ђ</div>${esc(e.message)}</div>`;}}
async function delReview(id){if(!confirm('РЈРґР°Р»РёС‚СЊ СЌС‚РѕС‚ РѕС‚Р·С‹РІ?'))return;try{await api('/api/reviews/'+id,'DELETE');toast('рџ—‘ РћС‚Р·С‹РІ СѓРґР°Р»С‘РЅ','w');loadReviews();}catch(e){toast(e.message,'e');}}
async function testNotifications(){const chatId=prompt('Telegram ID РґР»СЏ С‚РµСЃС‚Р° (РѕСЃС‚Р°РІСЊС‚Рµ РїСѓСЃС‚С‹Рј = РѕС‚РїСЂР°РІРёС‚СЊ С‚СЂРµРЅРµСЂСѓ):');if(chatId===null)return;try{const r=await api('/api/notifications/test','POST',{chatId:chatId||null});if(r.success)toast('вњ… РўРµСЃС‚ РѕС‚РїСЂР°РІР»РµРЅ в†’ '+r.sentTo,'s');else toast('вќЊ РЈРІРµРґРѕРјР»РµРЅРёСЏ РЅРµ СЂР°Р±РѕС‚Р°СЋС‚: '+r.reason,'e');}catch(e){toast(e.message,'e');}}

async function openNotes(userId,userName){document.getElementById('notesUserId').value=userId;document.getElementById('notesUserName').textContent='рџ‘¤ '+userName;document.getElementById('noteText').value='';openMo('mNotes');loadNotes(userId);}
async function loadNotes(userId){const box=document.getElementById('notesList');box.innerHTML='<div class="sp-ring" style="margin:10px auto"></div>';try{const notes=await api('/api/notes/'+userId);if(!notes.length){box.innerHTML='<div style="color:var(--mu2);font-size:13px">Р—Р°РјРµС‚РѕРє РїРѕРєР° РЅРµС‚</div>';return;}box.innerHTML=notes.map(n=>`<div class="note-item"><div class="note-date">${new Date(n.createdAt).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div><div class="note-text">${esc(n.text)}</div><button class="note-del" onclick="deleteNote('${n.id}','${userId}')">вњ•</button></div>`).join('');}catch(e){box.innerHTML='<div style="color:var(--red)">'+e.message+'</div>';}}
async function saveNote(){const userId=document.getElementById('notesUserId').value,text=document.getElementById('noteText').value.trim();if(!text){toast('Р’РІРµРґРёС‚Рµ С‚РµРєСЃС‚ Р·Р°РјРµС‚РєРё','e');return;}try{await api('/api/notes/'+userId,'POST',{text});document.getElementById('noteText').value='';toast('вњ… Р—Р°РјРµС‚РєР° СЃРѕС…СЂР°РЅРµРЅР°','s');loadNotes(userId);}catch(e){toast(e.message,'e');}}
async function deleteNote(noteId,userId){try{await api('/api/notes/'+userId+'/'+noteId,'DELETE');loadNotes(userId);}catch(e){toast(e.message,'e');}}

async function resetWeight(userId,userName){if(!confirm(`РЈРґР°Р»РёС‚СЊ РІСЃРµ Р·Р°РїРёСЃРё РІРµСЃР° В«${userName}В»?\n\nР­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµР»СЊР·СЏ РѕС‚РјРµРЅРёС‚СЊ.`))return;try{const r=await api(`/api/progress/${userId}/weight`,'DELETE');toast(`вљ–пёЏ Р“СЂР°С„РёРє РІРµСЃР° В«${userName}В» РѕС‡РёС‰РµРЅ (${r.deleted} Р·Р°РїРёСЃРµР№)`,'w');}catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}}

function toggleRules(){document.querySelectorAll('.rules-card').forEach(card=>{card.classList.toggle('open');});}

function tplSave(t){localStorage.setItem('cs_plan_templates',JSON.stringify(t));}
function tplLoad(){try{return JSON.parse(localStorage.getItem('cs_plan_templates')||'[]');}catch{return[];}}

async function openTemplates(){
  await _populateTplUserSel();
  renderTemplatesList();
  openMo('mTemplates');
}

function renderTemplatesList(){
  const templates=tplLoad();
  const list=document.getElementById('tplList');
  const empty=document.getElementById('tplEmpty');
  if(!templates.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  list.innerHTML=templates.map((t,i)=>{
    const totalEx=Object.values(t.plan||{}).reduce((s,w)=>s+(w||[]).length,0);
    const weeks=Object.values(t.plan||{}).filter(w=>w&&w.length).length;
    return `<div class="tpl-card">
      <div class="tpl-icon">рџ“„</div>
      <div class="tpl-info">
        <div class="tpl-name">${esc(t.name)}</div>
        <div class="tpl-meta">${weeks} РЅРµРґ. В· ${totalEx} СѓРїСЂ.${t.desc?' В· '+esc(t.desc):''}</div>
      </div>
      <div class="tpl-actions">
        <button class="btn btn-p sm" onclick="openCopyPlanModal(null,'template',${i})">РџСЂРёРјРµРЅРёС‚СЊ</button>
        <button class="btn btn-d sm" onclick="deleteTemplate(${i})">рџ—‘</button>
      </div>
    </div>`;
  }).join('');
}

function openSaveTemplate(){
  document.getElementById('tplName').value='';
  document.getElementById('tplDesc').value='';
  _populateTplUserSel();
  openMo('mSaveTpl');
}

async function _populateTplUserSel(){
  const students=allStudents.length?allStudents:await api('/api/users');
  if(students.length)allStudents=students;
  const opts=students.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  const sel=document.getElementById('tplFromUser');
  if(sel)sel.innerHTML='<option value="">вЂ” РІС‹Р±РµСЂРёС‚Рµ вЂ”</option>'+opts;
}

async function saveTemplate(){
  const name=document.getElementById('tplName').value.trim();
  const desc=document.getElementById('tplDesc').value.trim();
  const userId=document.getElementById('tplFromUser').value;
  if(!name){toast('Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ','e');return;}
  if(!userId){toast('Р’С‹Р±РµСЂРёС‚Рµ СѓС‡РµРЅРёРєР°-РёСЃС‚РѕС‡РЅРёРє','e');return;}
  try{
    const data=await api('/api/users/'+userId+'/plan');
    if(!data.trainingPlan){toast('РЈ СѓС‡РµРЅРёРєР° РЅРµС‚ РїР»Р°РЅР°','e');return;}
    const templates=tplLoad();
    templates.push({id:Date.now().toString(),name,desc,plan:data.trainingPlan,createdAt:new Date().toISOString()});
    tplSave(templates);
    toast('вњ… РЁР°Р±Р»РѕРЅ В«'+name+'В» СЃРѕС…СЂР°РЅС‘РЅ','s');
    closeMo('mSaveTpl');
    renderTemplatesList();
  }catch(e){toast(e.message,'e');}
}

function deleteTemplate(idx){
  const templates=tplLoad();
  if(!confirm('РЈРґР°Р»РёС‚СЊ С€Р°Р±Р»РѕРЅ В«'+(templates[idx]&&templates[idx].name)+'В»?'))return;
  templates.splice(idx,1);
  tplSave(templates);
  toast('рџ—‘ РЁР°Р±Р»РѕРЅ СѓРґР°Р»С‘РЅ','w');
  renderTemplatesList();
}

let _pendingTplIdx=null;
let _cpSourceType='student';

async function openCopyPlanModal(sourceUserId,sourceType,tplIdx){
  sourceUserId=sourceUserId||null;
  sourceType=sourceType||'student';
  tplIdx=(tplIdx!==undefined&&tplIdx!==null)?tplIdx:null;
  const students=allStudents.length?allStudents:await api('/api/users');
  if(students.length)allStudents=students;
  const opts=students.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  document.getElementById('cpFrom').innerHTML='<option value="">вЂ” РІС‹Р±РµСЂРёС‚Рµ вЂ”</option>'+opts;
  document.getElementById('cpTo').innerHTML='<option value="">вЂ” РІС‹Р±РµСЂРёС‚Рµ вЂ”</option>'+opts;
  document.getElementById('cpFromPreview').style.display='none';
  _pendingTplIdx=tplIdx;
  if(sourceType==='template'){
    switchCopySource('template');
    if(tplIdx!==null){
      document.getElementById('cpSourceId').value=String(tplIdx);
      renderCopyTplList(tplIdx);
    }
  }else{
    switchCopySource('student');
    if(sourceUserId){
      document.getElementById('cpFrom').value=sourceUserId;
      await previewCopySource();
    }
  }
  document.getElementById('cpSourceType').value=sourceType;
  _cpSourceType=sourceType;
  openMo('mCopyPlan');
}

function switchCopySource(type){
  _cpSourceType=type;
  document.getElementById('cpSourceType').value=type;
  document.getElementById('csrcStudent').classList.toggle('active',type==='student');
  document.getElementById('csrcTemplate').classList.toggle('active',type==='template');
  document.getElementById('csrcStudentBox').style.display=type==='student'?'block':'none';
  document.getElementById('csrcTemplateBox').style.display=type==='template'?'block':'none';
  if(type==='template')renderCopyTplList(_pendingTplIdx);
}

function renderCopyTplList(selectedIdx){
  const templates=tplLoad();
  const list=document.getElementById('cpTplList');
  const empty=document.getElementById('cpTplEmpty');
  if(!templates.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  list.innerHTML=templates.map((t,i)=>{
    const totalEx=Object.values(t.plan||{}).reduce((s,w)=>s+(w||[]).length,0);
    const weeks=Object.values(t.plan||{}).filter(w=>w&&w.length).length;
    const isSel=i===selectedIdx;
    return `<div class="tpl-card" style="cursor:pointer;${isSel?'border-color:var(--ac);background:rgba(139,92,246,.08)':''}" onclick="selectCopyTpl(${i})">
      <div class="tpl-icon">${isSel?'вњ…':'рџ“„'}</div>
      <div class="tpl-info">
        <div class="tpl-name">${esc(t.name)}</div>
        <div class="tpl-meta">${weeks} РЅРµРґ. В· ${totalEx} СѓРїСЂ.${t.desc?' В· '+esc(t.desc):''}</div>
      </div>
    </div>`;
  }).join('');
}

function selectCopyTpl(idx){
  _pendingTplIdx=idx;
  document.getElementById('cpSourceId').value=String(idx);
  renderCopyTplList(idx);
}

async function previewCopySource(){
  const userId=document.getElementById('cpFrom').value;
  const prevBox=document.getElementById('cpFromPreview');
  if(!userId){prevBox.style.display='none';return;}
  try{
    const data=await api('/api/users/'+userId+'/plan');
    const plan=data.trainingPlan;
    if(!plan){prevBox.style.display='none';toast('РЈ СѓС‡РµРЅРёРєР° РЅРµС‚ РїР»Р°РЅР°','w');return;}
    document.getElementById('cpSourceId').value=userId;
    document.getElementById('cpWeekPrev').innerHTML=[1,2,3,4].map(w=>{
      const cnt=(plan[w]||[]).filter(e=>e.exercise).length;
      return `<div class="copy-week-opt${cnt>0?' sel':''}">
        <div class="wn">${w}</div>
        <div class="wc">${cnt} СѓРїСЂ.</div>
      </div>`;
    }).join('');
    prevBox.style.display='block';
  }catch(e){prevBox.style.display='none';}
}

async function doCopyPlan(){
  const toUserId=document.getElementById('cpTo').value;
  const sourceType=document.getElementById('cpSourceType').value;
  if(!toUserId){toast('Р’С‹Р±РµСЂРёС‚Рµ СѓС‡РµРЅРёРєР°-РїРѕР»СѓС‡Р°С‚РµР»СЏ','e');return;}
  let planToCopy=null,sourceName='';
  if(sourceType==='template'){
    if(_pendingTplIdx===null){toast('Р’С‹Р±РµСЂРёС‚Рµ С€Р°Р±Р»РѕРЅ','e');return;}
    const templates=tplLoad();
    const tpl=templates[_pendingTplIdx];
    if(!tpl){toast('РЁР°Р±Р»РѕРЅ РЅРµ РЅР°Р№РґРµРЅ','e');return;}
    planToCopy=tpl.plan;
    sourceName='С€Р°Р±Р»РѕРЅР° В«'+tpl.name+'В»';
  }else{
    const fromUserId=document.getElementById('cpSourceId').value;
    if(!fromUserId){toast('Р’С‹Р±РµСЂРёС‚Рµ СѓС‡РµРЅРёРєР°-РёСЃС‚РѕС‡РЅРёРє','e');return;}
    if(fromUserId===toUserId){toast('РСЃС‚РѕС‡РЅРёРє Рё РїРѕР»СѓС‡Р°С‚РµР»СЊ РѕРґРёРЅР°РєРѕРІС‹Рµ','e');return;}
    try{
      const data=await api('/api/users/'+fromUserId+'/plan');
      if(!data.trainingPlan){toast('РЈ СѓС‡РµРЅРёРєР°-РёСЃС‚РѕС‡РЅРёРєР° РЅРµС‚ РїР»Р°РЅР°','e');return;}
      planToCopy=data.trainingPlan;
      const src=allStudents.find(u=>u.id===fromUserId);
      sourceName=src?esc(src.name):'СѓС‡РµРЅРёРєР°';
    }catch(e){toast(e.message,'e');return;}
  }
  const tgt=allStudents.find(u=>u.id===toUserId);
  const tgtName=tgt?tgt.name:'СѓС‡РµРЅРёРєР°';
  if(!confirm('РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РїР»Р°РЅ РѕС‚ '+sourceName+' в†’ '+tgtName+'?\n\nРЎСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ РїР»Р°РЅ Р±СѓРґРµС‚ Р·Р°РјРµРЅС‘РЅ.'))return;
  try{
    await api('/api/users/'+toUserId+'/plan','POST',{trainingPlan:planToCopy});
    const total=Object.values(planToCopy).reduce((s,w)=>s+(w||[]).length,0);
    toast('вњ… РџР»Р°РЅ СЃРєРѕРїРёСЂРѕРІР°РЅ в†’ '+esc(tgtName)+' ('+total+' СѓРїСЂ.)','s');
    closeMo('mCopyPlan');
    allStudents=[];
    loadAdminHome();
  }catch(e){toast(e.message,'e');}
}


async function loadVideoLibrary(){
  const box=document.getElementById('vidCatList');
  if(!box)return;
  box.innerHTML='<div class="empty"><div class="sp-ring" style="margin:16px auto"></div></div>';
  try{
    const [cats,videos]=await Promise.all([
      api('/api/video-categories'),
      api('/api/exercise-videos')
    ]);
    if(!cats.length){
      box.innerHTML=`<div class="empty"><div class="ei">рџЋ¬</div>РљР°С‚РµРіРѕСЂРёР№ РїРѕРєР° РЅРµС‚.<br><small style="color:var(--mu)">РќР°Р¶РјРёС‚Рµ В«+ РљР°С‚РµРіРѕСЂРёСЏВ» С‡С‚РѕР±С‹ СЃРѕР·РґР°С‚СЊ РїРµСЂРІСѓСЋ</small></div>`;
      return;
    }
    const bycat={};
    videos.forEach(v=>{if(!bycat[v.categoryId])bycat[v.categoryId]=[];bycat[v.categoryId].push(v);});
    box.innerHTML=cats.map(cat=>{
      const cvids=bycat[cat.id]||[];
      const vRows=cvids.map(v=>`
        <div class="vid-item">
          <div class="vid-item-name">
            <div>${esc(v.title)}</div>
            ${v.description?`<div style="font-size:11px;color:var(--mu2);margin-top:2px">${esc(v.description)}</div>`:''}
          </div>
          <button class="btn btn-g sm" data-vid-title="${esc(v.title)}" data-vid-url="${esc(v.videoUrl)}" onclick="openVideoModal(this.dataset.vidTitle,this.dataset.vidUrl)">в–¶</button>
          <button class="btn btn-d sm" data-vid-id="${esc(v.id)}" data-vid-title="${esc(v.title)}" onclick="deleteVideo(this.dataset.vidId,this.dataset.vidTitle)">рџ—‘</button>
        </div>`).join('');
      return`<div class="vid-cat-block">
        <div class="vid-cat-head">
          <span class="vid-cat-icon">рџ“Ѓ</span>
          <span class="vid-cat-title">${esc(cat.name)}</span>
          <span class="vid-cat-count">${cvids.length} РІРёРґРµРѕ</span>
          <button class="btn btn-g sm" onclick="openUploadVideoModal('${esc(cat.id)}','${esc(cat.name)}')">+ Р’РёРґРµРѕ</button>
          <button class="btn btn-d sm" onclick="deleteCategory('${esc(cat.id)}','${esc(cat.name)}')">рџ—‘</button>
        </div>
        <div class="vid-item-list">${vRows||'<div style="padding:10px 14px;font-size:12px;color:var(--mu2)">Р’РёРґРµРѕ РїРѕРєР° РЅРµС‚</div>'}</div>
      </div>`;
    }).join('');
  }catch(e){box.innerHTML=`<div class="empty"><div class="ei">вљ пёЏ</div>${esc(e.message)}</div>`;}
}

async function showCreateCategory(){
  const name=prompt('РќР°Р·РІР°РЅРёРµ РєР°С‚РµРіРѕСЂРёРё:');
  if(!name||!name.trim())return;
  try{
    await api('/api/video-categories','POST',{name:name.trim()});
    toast('вњ… РљР°С‚РµРіРѕСЂРёСЏ СЃРѕР·РґР°РЅР°','s');
    loadVideoLibrary();
  }catch(e){toast(e.message,'e');}
}

async function deleteCategory(id,name){
  if(!confirm('РЈРґР°Р»РёС‚СЊ РєР°С‚РµРіРѕСЂРёСЋ В«'+name+'В»?\n\nР’СЃРµ РІРёРґРµРѕ РІ РЅРµР№ С‚РѕР¶Рµ Р±СѓРґСѓС‚ СѓРґР°Р»РµРЅС‹.'))return;
  try{
    await api('/api/video-categories/'+id,'DELETE');
    toast('рџ—‘ РљР°С‚РµРіРѕСЂРёСЏ СѓРґР°Р»РµРЅР°','w');
    loadVideoLibrary();
  }catch(e){toast(e.message,'e');}
}

function openUploadVideoModal(catId,catName){
  _mVidCatId=catId;_mVidCatName=catName;
  const lbl=document.getElementById('mVidCatLabel');
  if(lbl)lbl.textContent=catName;
  const title=document.getElementById('mVidTitle');
  if(title)title.value='';
  const desc=document.getElementById('mVidDesc');
  if(desc)desc.value='';
  clearMVidPreview();
  openMo('mAddVideo');
  api('/api/users').then(users=>{
    const exSet=new Set();
    users.forEach(u=>{
      const tp=u.trainingPlan;
      if(!tp)return;
      [1,2,3,4].forEach(w=>{(tp[w]||[]).forEach(e=>{if(e.exercise&&e.exercise.trim())exSet.add(e.exercise.trim());});});
    });
    const dl=document.getElementById('mVidExSuggest');
    if(dl)dl.innerHTML=[...exSet].sort().map(x=>`<option value="${esc(x)}">`).join('');
  }).catch(()=>{});
  const zone=document.getElementById('mVidZone');
  if(zone&&!zone._ddBound){
    zone._ddBound=true;
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover');});
    zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
    zone.addEventListener('drop',e=>{
      e.preventDefault();zone.classList.remove('dragover');
      const f=e.dataTransfer.files[0];
      if(f&&f.type.startsWith('video/')){_mVidFile=f;_showMVidPreview(f);}
      else toast('Р’С‹Р±РµСЂРёС‚Рµ РІРёРґРµРѕ С„Р°Р№Р»','e');
    });
  }
}

function onMVidFileSelected(e){
  const file=e.target.files[0];
  if(!file)return;
  if(file.size>50*1024*1024){toast('Р¤Р°Р№Р» СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№ (РјР°РєСЃ. 50 РњР‘)','e');return;}
  _mVidFile=file;_showMVidPreview(file);
}

function _showMVidPreview(file){
  const wrap=document.getElementById('mVidPreviewWrap');
  const preview=document.getElementById('mVidPreview');
  const content=document.getElementById('mVidContent');
  const sizeEl=document.getElementById('mVidSizeLabel');
  if(!preview)return;
  preview.src=URL.createObjectURL(file);
  if(wrap)wrap.style.display='block';
  if(content)content.style.display='none';
  if(sizeEl)sizeEl.textContent=(file.size/1024/1024).toFixed(1)+' РњР‘ В· '+file.name;
  const title=document.getElementById('mVidTitle');
  if(title&&!title.value){
    title.value=file.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ');
  }
}

function clearMVidPreview(){
  _mVidFile=null;
  const preview=document.getElementById('mVidPreview');
  const wrap=document.getElementById('mVidPreviewWrap');
  const content=document.getElementById('mVidContent');
  const fi=document.getElementById('mVidFile');
  if(preview){preview.pause();preview.src='';}
  if(wrap)wrap.style.display='none';
  if(content)content.style.display='block';
  if(fi)fi.value='';
}

async function submitUploadVideo(){
  const title=document.getElementById('mVidTitle').value.trim();
  if(!title){toast('Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РІРёРґРµРѕ','e');return;}
  if(!_mVidFile){toast('Р’С‹Р±РµСЂРёС‚Рµ РІРёРґРµРѕ С„Р°Р№Р»','e');return;}

  const progress=document.getElementById('mVidProgress');
  const bar=document.getElementById('mVidProgressBar');
  if(progress)progress.style.display='block';

  const desc=(document.getElementById('mVidDesc')?.value||'').trim();
  const fd=new FormData();
  fd.append('categoryId',_mVidCatId);
  fd.append('categoryName',_mVidCatName);
  fd.append('title',title);
  if(desc)fd.append('description',desc);
  fd.append('video',_mVidFile);

  const xhr=new XMLHttpRequest();
  xhr.upload.onprogress=e=>{
    if(e.lengthComputable&&bar)bar.style.width=Math.round(e.loaded/e.total*100)+'%';
  };
  xhr.onload=()=>{
    if(bar)bar.style.width='100%';
    setTimeout(()=>{if(progress)progress.style.display='none';if(bar)bar.style.width='0%';},600);
    try{
      const d=JSON.parse(xhr.responseText);
      if(xhr.status!==200)throw new Error(d.error||'РћС€РёР±РєР° СЃРµСЂРІРµСЂР°');
      toast('вњ… Р’РёРґРµРѕ Р·Р°РіСЂСѓР¶РµРЅРѕ: В«'+title+'В»','s');
      closeMo('mAddVideo');
      clearMVidPreview();
      loadVideoLibrary();
    }catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}
  };
  xhr.onerror=()=>{toast('РћС€РёР±РєР° СЃРµС‚Рё','e');if(progress)progress.style.display='none';};
  toast('вЏі Р—Р°РіСЂСѓР¶Р°СЋ...','w');
  xhr.open('POST','/api/exercise-videos');
  const _xhrTok=_getToken();if(_xhrTok)xhr.setRequestHeader('Authorization','Bearer '+_xhrTok);
  xhr.send(fd);
}

async function deleteVideo(id,title){
  if(!confirm('РЈРґР°Р»РёС‚СЊ РІРёРґРµРѕ В«'+title+'В»?'))return;
  try{
    await api('/api/exercise-videos/'+id,'DELETE');
    toast('рџ—‘ Р’РёРґРµРѕ СѓРґР°Р»РµРЅРѕ','w');
    loadVideoLibrary();
  }catch(e){toast(e.message,'e');}
}


async function loadUserVideoLibrary(){
  const box=document.getElementById('uVidContent');
  if(!box)return;
  box.innerHTML='<div class="empty"><div class="sp-ring" style="margin:20px auto"></div></div>';
  try{
    const [cats,videos]=await Promise.all([
      api('/api/video-categories'),
      api('/api/exercise-videos')
    ]);
    if(!cats.length){
      box.innerHTML=`<div class="empty"><div class="ei">рџЋ¬</div>Р’РёРґРµРѕС‚РµРєР° РїРѕРєР° РїСѓСЃС‚Р°</div>`;
      return;
    }
    const bycat={};
    videos.forEach(v=>{if(!bycat[v.categoryId])bycat[v.categoryId]=[];bycat[v.categoryId].push(v);});
    _uVidData={cats,bycat};
    _renderUVidCategories(box,cats,bycat);
  }catch(e){box.innerHTML=`<div class="empty"><div class="ei">вљ пёЏ</div>${esc(e.message)}</div>`;}
}

function _renderUVidCategories(box,cats,bycat){
  box.innerHTML=`
    <div class="st" style="margin-bottom:14px">рџЋ¬ Р’РёРґРµРѕС‚РµРєР°</div>
    <div class="vid-cat-grid">
      ${cats.map(cat=>{
        const cnt=(bycat[cat.id]||[]).length;
        return`<div class="vid-cat-card" onclick="_openUVidCategory('${esc(cat.id)}','${esc(cat.name)}')">`+`
          <div class="vid-cat-card-icon">рџ“Ѓ</div>
          <div class="vid-cat-card-name">${esc(cat.name)}</div>
          <div class="vid-cat-card-cnt">${cnt} РІРёРґРµРѕ</div>
        </div>`;
      }).join('')}
    </div>`;
}

function _openUVidCategory(catId,catName){
  const box=document.getElementById('uVidContent');
  if(!box)return;
  const videos=(_uVidData.bycat&&_uVidData.bycat[catId])||[];
  if(!videos.length){
    box.innerHTML=`
      <button class="vid-back-btn" onclick="loadUserVideoLibrary()">в†ђ РќР°Р·Р°Рґ</button>
      <div class="st" style="margin-bottom:14px">рџ“Ѓ ${esc(catName)}</div>
      <div class="empty"><div class="ei">рџЋ¬</div>Р’ СЌС‚РѕР№ РєР°С‚РµРіРѕСЂРёРё РїРѕРєР° РЅРµС‚ РІРёРґРµРѕ</div>`;
    return;
  }
  box.innerHTML=`
    <button class="vid-back-btn" onclick="loadUserVideoLibrary()">в†ђ РќР°Р·Р°Рґ</button>
    <div class="st" style="margin-bottom:14px">рџ“Ѓ ${esc(catName)}</div>
    ${videos.map(v=>`
      <div class="uvid-item" data-vid-title="${esc(v.title)}" data-vid-url="${esc(v.videoUrl)}" onclick="openVideoModal(this.dataset.vidTitle,this.dataset.vidUrl)">
        <div class="uvid-play">в–¶</div>
        <div>
          <div class="uvid-name">${esc(v.title)}</div>
          ${v.description?`<div style="font-size:11px;color:var(--mu2);margin-top:2px">${esc(v.description)}</div>`:''}
        </div>
      </div>`).join('')}`;
}


function openVideoModal(title,url){
  const titleEl=document.getElementById('videoModalTitle');
  const player=document.getElementById('videoPlayer');
  if(titleEl)titleEl.textContent='в–¶ '+title;
  if(!player)return;
  player.src=url;
  player.load();
  openMo('mVideo');
  player.play().catch(()=>{});
}

function closeVideoModal(){
  const player=document.getElementById('videoPlayer');
  if(player){player.pause();player.src='';}
  closeMo('mVideo');
}

function _todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
let _nutDate=_todayLocal();
let _anutDate=_todayLocal();
let _anutStudentId=null,_anutStudentName='';
let _nutStudents=[];
let _nutSaveFav=false;
let _nutFavsCache=[];
let _nutRecentCache=[];
let _nutActiveTab='search';
const _NUT_EMOJI={breakfast:'рџЊ…',lunch:'вЂпёЏ',dinner:'рџЊ™',snack:'рџЌЋ'};
const _NUT_NAME={breakfast:'Р—Р°РІС‚СЂР°Рє',lunch:'РћР±РµРґ',dinner:'РЈР¶РёРЅ',snack:'РџРµСЂРµРєСѓСЃ'};

// в”Ђв”Ђ Coach Space AI Chat в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const _aiHistory = [];

function aiInputResize(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,100)+'px';
}

function aiInputKeydown(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();aiSend();}
}

function aiSendChip(text){
  document.getElementById('aiInput').value=text;
  aiSend();
}

function aiAddMsg(role,text){
  const box=document.getElementById('aiMsgs');
  const isBot=role==='bot';
  const ava=isBot?'<div class="ai-msg-ava">рџ¤–</div>':'<div class="ai-msg-ava user-ava">'+(ME&&ME.name?ME.name[0].toUpperCase():'РЇ')+'</div>';
  const bubble='<div class="ai-msg-bubble">'+text.replace(/\n/g,'<br>')+'</div>';
  const div=document.createElement('div');
  div.className='ai-msg '+(isBot?'bot':'user');
  div.innerHTML=isBot?(ava+bubble):(bubble+ava);
  box.appendChild(div);
  box.scrollTop=box.scrollHeight;
}

async function aiSend(){
  const input=document.getElementById('aiInput');
  const text=input.value.trim();
  if(!text)return;
  input.value='';input.style.height='auto';
  document.getElementById('aiSendBtn').disabled=true;

  aiAddMsg('user',text);
  _aiHistory.push({role:'user',content:text});

  // РїРѕРєР°Р·Р°С‚СЊ typing
  const typingRow=document.getElementById('aiTypingRow');
  const typingAnim=document.getElementById('aiTyping');
  typingRow.style.display='flex';
  typingAnim.style.display='flex';
  document.getElementById('aiMsgs').scrollTop=9999;

  try{
    const todayLog=await _aiGetTodayLog();
    const reply=await _aiCallAPI(text,todayLog);
    typingRow.style.display='none';
    _aiHistory.push({role:'assistant',content:reply});
    aiAddMsg('bot',reply);
  }catch(e){
    typingRow.style.display='none';
    aiAddMsg('bot','вљ пёЏ РћС€РёР±РєР°: '+e.message);
  }
  document.getElementById('aiSendBtn').disabled=false;
}

async function _aiGetTodayLog(){
  try{
    const r=await authFetch(`/api/nutrition/${ME.id}?date=${_nutDate}`);
    if(!r.ok)return null;
    const entries=await r.json();
    if(!entries.length)return null;
    const tot=entries.reduce((a,e)=>({k:a.k+(e.kcal||0),p:a.p+(e.protein||0),f:a.f+(e.fat||0),c:a.c+(e.carbs||0)}),{k:0,p:0,f:0,c:0});
    const list=entries.map(e=>`- ${e.name} (${e.type}): ${e.kcal} РєРєР°Р», Р‘${e.protein} Р–${e.fat} РЈ${e.carbs}`).join('\n');
    return `РЎРµРіРѕРґРЅСЏ СЃСЉРµРґРµРЅРѕ: ${tot.k} РєРєР°Р», Р±РµР»РєРё ${Math.round(tot.p)}Рі, Р¶РёСЂС‹ ${Math.round(tot.f)}Рі, СѓРіР»РµРІРѕРґС‹ ${Math.round(tot.c)}Рі.\nРЎРїРёСЃРѕРє РїСЂРёС‘РјРѕРІ:\n${list}`;
  }catch{return null;}
}

async function _aiCallAPI(userMsg,todayLog){
  const r=await authFetch('/api/ai/nutrition',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({messages:_aiHistory,todayLog})
  });
  if(!r.ok){const d=await r.json();throw new Error(d.error||'РћС€РёР±РєР° AI');}
  const d=await r.json();
  return d.reply;
}
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

async function loadUserNutrition(){
  const box=document.getElementById('uNutContent');
  box.innerHTML='<div class="empty"><div class="sp-ring" style="margin:20px auto"></div></div>';
  try{
    const r=await authFetch(`/api/nutrition/${ME.id}?date=${_nutDate}`);
    if(!r.ok)throw new Error('РЎС‚Р°С‚СѓСЃ '+r.status);
    const entries=await r.json();
    renderUserNutrition(box,entries);
  }catch(e){box.innerHTML=`<div class="empty"><div class="ei">рџҐ—</div>РћС€РёР±РєР°: ${esc(e.message)}</div>`;}
}

function renderUserNutrition(box,entries){
  const tot=entries.reduce((a,e)=>({k:a.k+(e.kcal||0),p:a.p+(e.protein||0),f:a.f+(e.fat||0),c:a.c+(e.carbs||0)}),{k:0,p:0,f:0,c:0});
  const today=_todayLocal();
  const isToday=_nutDate===today;
  const dateLabel=isToday?'РЎРµРіРѕРґРЅСЏ':new Date(_nutDate+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
  const MEALS=[{key:'breakfast',icon:'рџЊ…',label:'Р—Р°РІС‚СЂР°Рє'},{key:'lunch',icon:'вЂпёЏ',label:'РћР±РµРґ'},{key:'dinner',icon:'рџЊ†',label:'РЈР¶РёРЅ'},{key:'snack',icon:'рџЌЋ',label:'РџРµСЂРµРєСѓСЃ'}];
  const sections=MEALS.map(m=>{
    const mel=entries.filter(e=>e.type===m.key);
    const mkcal=mel.reduce((s,e)=>s+(e.kcal||0),0);
    const rows=mel.map(e=>`
      <div class="nut-meal-entry">
        <div class="nut-meal-entry-info">
          <div class="nut-meal-entry-name">${esc(e.name)}</div>
          <div class="nut-meal-entry-macros">Р‘:${+(e.protein||0).toFixed(1)}Рі В· Р–:${+(e.fat||0).toFixed(1)}Рі В· РЈ:${+(e.carbs||0).toFixed(1)}Рі</div>
        </div>
        <div class="nut-meal-entry-kcal">${e.kcal||0} РєРєР°Р»</div>
        <button class="nut-meal-entry-del" onclick="deleteNutEntry('${e.id}')">вњ•</button>
      </div>`).join('');
    return `<div class="nut-meal-section">
      <div class="nut-meal-hdr">
        <div class="nut-meal-icon">${m.icon}</div>
        <div class="nut-meal-title">${m.label}</div>
        ${mkcal?`<div class="nut-meal-kcal">${mkcal} РєРєР°Р»</div>`:''}
        <button class="nut-meal-plus" onclick="openMo('mAddNut','${m.key}')" title="Р”РѕР±Р°РІРёС‚СЊ ${m.label}">+</button>
      </div>
      ${rows?`<div class="nut-meal-entries">${rows}</div>`:''}
    </div>`;
  }).join('');
  box.innerHTML=`
    <div class="nut-date-nav">
      <button class="btn btn-g sm" onclick="nutDateShift(-1)">вЂ№</button>
      <input type="date" class="fi" value="${_nutDate}" onchange="_nutDate=this.value;loadUserNutrition()"/>
      <button class="btn btn-g sm" onclick="nutDateShift(1)">вЂє</button>
    </div>
    <div style="text-align:center;margin-bottom:10px">
      <span style="font-size:12px;color:var(--mu2)">${dateLabel}</span>
    </div>
    <div class="nut-macro-bar">
      <div class="nut-mb-item"><div class="nut-mb-val">${Math.round(tot.f)}Рі</div><div class="nut-mb-lbl">Р–РёСЂС‹</div></div>
      <div class="nut-mb-item"><div class="nut-mb-val">${Math.round(tot.c)}Рі</div><div class="nut-mb-lbl">РЈРіР»РµРІРѕРґС‹</div></div>
      <div class="nut-mb-item"><div class="nut-mb-val">${Math.round(tot.p)}Рі</div><div class="nut-mb-lbl">Р‘РµР»РєРё</div></div>
      <div class="nut-mb-item kcal"><div class="nut-mb-val">${tot.k}</div><div class="nut-mb-lbl">РљР°Р»РѕСЂРёРё</div></div>
    </div>
    ${sections}`;
}

function nutDateShift(d){const dt=new Date(_nutDate);dt.setDate(dt.getDate()+d);_nutDate=dt.toISOString().split('T')[0];loadUserNutrition();}

async function saveNutEntry(){
  if(!_nutSelectedFood)return toast('Р’С‹Р±РµСЂРёС‚Рµ РїСЂРѕРґСѓРєС‚ РёР· РїРѕРёСЃРєР°','e');
  const weight=parseFloat(document.getElementById('nutWeight').value)||100;
  const type=document.getElementById('nutType').value;
  const k=_nutSelectedFood.per100;
  const mul=weight/100;
  const kcal=Math.round(k.kcal*mul);
  const protein=Math.round(k.protein*mul*10)/10;
  const fat=Math.round(k.fat*mul*10)/10;
  const carbs=Math.round(k.carbs*mul*10)/10;
  const name=_nutSelectedFood.name;
  const btn=document.getElementById('nutSaveBtn');
  btn.disabled=true;btn.textContent='...';
  try{
    const r=await authFetch(`/api/nutrition/${ME.id}`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,type,kcal,protein,fat,carbs,date:_nutDate})});
    if(!r.ok){const d=await r.json();throw new Error(d.error||'РћС€РёР±РєР°');}
    if(_nutSaveFav){
      await authFetch(`/api/favorites/${ME.id}`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,type,kcal,protein,fat,carbs,per100:k})}).catch(()=>{});
      toast('в­ђ Р”РѕР±Р°РІР»РµРЅРѕ РІ РёР·Р±СЂР°РЅРЅРѕРµ','w');
    }
    closeMo('mAddNut');resetNutModal();
    toast('Р—Р°РїРёСЃР°РЅРѕ!','s');loadUserNutrition();
  }catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}
  btn.disabled=false;btn.textContent='Р”РѕР±Р°РІРёС‚СЊ';
}

async function deleteNutEntry(id){
  try{
    const r=await authFetch(`/api/nutrition/${ME.id}/${id}`,{method:'DELETE'});
    if(!r.ok)throw new Error('РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ');
    loadUserNutrition();
  }catch(e){toast(e.message,'e');}
}

async function loadAdminNutrition(){
  const box=document.getElementById('aNutContent');
  if(!_anutStudentId){
    try{
      const students=await authFetch('/api/users').then(r=>r.json());
      _nutStudents=students;
      if(!students.length){box.innerHTML='<div class="empty"><div class="ei">рџ‘Ґ</div>РќРµС‚ СѓС‡РµРЅРёРєРѕРІ</div>';return;}
      box.innerHTML=`<div class="card"><div class="ct">Р’С‹Р±РµСЂРёС‚Рµ СѓС‡РµРЅРёРєР° РґР»СЏ РїСЂРѕСЃРјРѕС‚СЂР° РїРёС‚Р°РЅРёСЏ</div>
        <input class="fi" id="nutStudentSearch" placeholder="рџ”Ќ РџРѕРёСЃРє РїРѕ РёРјРµРЅРё..." oninput="filterNutStudents()" style="margin-bottom:10px">
        <div class="nut-student-list" id="nutStudentList">
          ${students.map(s=>`<div class="nut-student-row" data-sid="${s.id}" data-name="${esc(s.name).toLowerCase()}" onclick="anutSelectStudent(this.dataset.sid)">
            <div class="sc-ava">${(s.name||'?')[0].toUpperCase()}</div>
            <div><div style="font-weight:700;font-size:14px">${esc(s.name)}</div><div style="font-size:12px;color:var(--mu2)">@${esc(s.login)}</div></div>
            <div style="margin-left:auto;color:var(--ac);font-size:20px;font-weight:300">вЂє</div>
          </div>`).join('')}
        </div></div>`;
    }catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`;}
    return;
  }
  box.innerHTML='<div class="empty"><div class="sp-ring" style="margin:20px auto"></div></div>';
  try{
    const r=await authFetch(`/api/nutrition/${_anutStudentId}?date=${_anutDate}`);
    if(!r.ok)throw new Error('РЎС‚Р°С‚СѓСЃ '+r.status);
    const entries=await r.json();
    const tot=entries.reduce((a,e)=>({k:a.k+(e.kcal||0),p:a.p+(e.protein||0),f:a.f+(e.fat||0),c:a.c+(e.carbs||0)}),{k:0,p:0,f:0,c:0});
    const rows=entries.length?entries.map(e=>`
      <div class="nut-entry">
        <div class="nut-entry-icon">${_NUT_EMOJI[e.type]||'рџЌЅ'}</div>
        <div class="nut-entry-info">
          <div class="nut-entry-name">${esc(e.name)}</div>
          <div class="nut-entry-macros">Р‘: ${+(e.protein||0).toFixed(1)}Рі В· Р–: ${+(e.fat||0).toFixed(1)}Рі В· РЈ: ${+(e.carbs||0).toFixed(1)}Рі</div>
        </div>
        <div class="nut-entry-right">
          <div class="nut-entry-kcal">${e.kcal||0} РєРєР°Р»</div>
          <div class="nut-entry-type-lbl">${_NUT_NAME[e.type]||e.type}</div>
        </div>
      </div>`).join(''):'<div class="empty" style="padding:24px 0"><div class="ei">рџҐ—</div>РќРµС‚ Р·Р°РїРёСЃРµР№ Р·Р° СЌС‚РѕС‚ РґРµРЅСЊ</div>';
    box.innerHTML=`
      <button class="nut-back-btn" onclick="_anutStudentId=null;loadAdminNutrition()">в†ђ Р’СЃРµ СѓС‡РµРЅРёРєРё</button>
      <div class="sh"><div class="st">рџ‘¤ ${esc(_anutStudentName)}</div></div>
      <div class="nut-date-nav">
        <button class="btn btn-g sm" onclick="anutDateShift(-1)">вЂ№</button>
        <input type="date" class="fi" value="${_anutDate}" onchange="_anutDate=this.value;loadAdminNutrition()"/>
        <button class="btn btn-g sm" onclick="anutDateShift(1)">вЂє</button>
      </div>
      <div class="nut-macro-bar" style="margin-bottom:14px">
        <div class="nut-mb-item"><div class="nut-mb-val">${Math.round(tot.f)}Рі</div><div class="nut-mb-lbl">Р–РёСЂС‹</div></div>
        <div class="nut-mb-item"><div class="nut-mb-val">${Math.round(tot.c)}Рі</div><div class="nut-mb-lbl">РЈРіР»РµРІРѕРґС‹</div></div>
        <div class="nut-mb-item"><div class="nut-mb-val">${Math.round(tot.p)}Рі</div><div class="nut-mb-lbl">Р‘РµР»РєРё</div></div>
        <div class="nut-mb-item kcal"><div class="nut-mb-val">${tot.k}</div><div class="nut-mb-lbl">РљР°Р»РѕСЂРёРё</div></div>
      </div>
      <div class="sh"><div class="st" style="font-size:13px">рџ“‹ Р”РЅРµРІРЅРёРє РїРёС‚Р°РЅРёСЏ</div></div>
      ${rows}`;
  }catch(e){box.innerHTML=`<div class="empty"><button class="nut-back-btn" onclick="_anutStudentId=null;loadAdminNutrition()">в†ђ РќР°Р·Р°Рґ</button><div class="ei">вљ пёЏ</div>${esc(e.message)}</div>`;}
}

function filterNutStudents(){
  const q=(document.getElementById('nutStudentSearch')?.value||'').trim().toLowerCase();
  document.querySelectorAll('#nutStudentList .nut-student-row').forEach(row=>{
    row.style.display=(!q||row.dataset.name.includes(q))?'':'none';
  });
}

function anutSelectStudent(sid){
  const s=_nutStudents.find(x=>x.id===sid);if(!s)return;
  _anutStudentId=sid;_anutStudentName=s.name;loadAdminNutrition();
}
function anutDateShift(d){const dt=new Date(_anutDate);dt.setDate(dt.getDate()+d);_anutDate=dt.toISOString().split('T')[0];loadAdminNutrition();}

function switchNutTab(tab){
  _nutActiveTab=tab;
  ['search','build','fav','recent','own','shared'].forEach(t=>{
    document.getElementById('ntab-'+t)?.classList.toggle('active',t===tab);
    document.getElementById('npanel-'+t)?.classList.toggle('active',t===tab);
  });
  if(tab==='search')setTimeout(()=>document.getElementById('nutName')?.focus(),100);
  if(tab==='build')setTimeout(()=>document.getElementById('buildIngName')?.focus(),100);
  if(tab==='shared')loadSharedFoods();
}

let _nutSelectedFood=null;
let _nutCustomFoodsCache=[];
let _localFoods=[];
async function loadLocalFoods(){
  try{const r=await fetch('/foods.json');if(r.ok)_localFoods=await r.json();}
  catch(e){_localFoods=[];}
}

async function loadCustomFoods(){
  if(!ME)return;
  try{
    const [myFoods, sharedFoods] = await Promise.all([
      authFetch(`/api/custom-foods/${ME.id}`).then(r=>r.ok?r.json():[]).catch(()=>[]),
      api('/api/shared-foods').catch(()=>[])
    ]);
    const myNames=new Set(myFoods.map(f=>f.name.toLowerCase()));
    const uniqueShared=sharedFoods.filter(f=>!myNames.has(f.name.toLowerCase()));
    _nutCustomFoodsCache=[...myFoods,...uniqueShared];
  }catch(e){_nutCustomFoodsCache=[];}
}

function nutSetupAutocomplete(){
  const input=document.getElementById('nutName');
  if(!input||input._fsSetup)return;
  input._fsSetup=true;
  let timer=null;
  input.addEventListener('input',()=>{
    clearTimeout(timer);
    const q=input.value.trim();
    if(q.length<2){hideNutDropdown();return;}
    timer=setTimeout(()=>doNutSearch(q,'nutDropdown','selectNutFood'),100);
  });
  input.addEventListener('blur',()=>setTimeout(()=>hideDropdown('nutDropdown'),200));
}
function buildSetupAutocomplete(){
  const input=document.getElementById('buildIngName');
  if(!input||input._fsSetup)return;
  input._fsSetup=true;
  let timer=null;
  input.addEventListener('input',()=>{
    clearTimeout(timer);
    const q=input.value.trim();
    if(q.length<2){hideDropdown('buildDropdown');return;}
    timer=setTimeout(()=>doNutSearch(q,'buildDropdown','selectBuildIng'),100);
  });
  input.addEventListener('blur',()=>setTimeout(()=>hideDropdown('buildDropdown'),200));
}
function doNutSearch(q,ddId,selectFn){
  const dd=document.getElementById(ddId);if(!dd)return;
  const ql=q.toLowerCase();
  const custom=_nutCustomFoodsCache.filter(f=>f.name.toLowerCase().includes(ql)).slice(0,5);
  const startsWith=_localFoods.filter(f=>f.name.toLowerCase().startsWith(ql));
  const includes=_localFoods.filter(f=>!f.name.toLowerCase().startsWith(ql)&&f.name.toLowerCase().includes(ql));
  const locals=[...startsWith,...includes].slice(0,10);
  const customRows=custom.map(f=>{
    const isMine=ME&&f.userId===ME.id;
    const label=isMine?'рџЏ  РјРѕС‘':(f.userName?`рџ‘¤ ${esc(f.userName)}`:'рџ‘Ґ РѕР±С‰РµРµ');
    return`<div class="nut-dd-item" style="border-left:2px solid var(--ac)"
      data-name="${esc(f.name)}" data-kcal="${f.kcal}" data-p="${f.protein}" data-f="${f.fat}" data-c="${f.carbs}" data-custom="1"
      onclick="${selectFn}(this)">
      <div class="nut-dd-name">${esc(f.name)} <span style="font-size:11px;color:var(--mu2)">${label}</span></div>
      <div class="nut-dd-desc">${f.kcal} РєРєР°Р» В· Р‘:${f.protein}Рі Р–:${f.fat}Рі РЈ:${f.carbs}Рі РЅР° 100Рі</div>
    </div>`;}).join('');
  const localRows=locals.map(f=>`
    <div class="nut-dd-item"
      data-name="${esc(f.name)}" data-kcal="${f.kcal}" data-p="${f.protein}" data-f="${f.fat}" data-c="${f.carbs}" data-local="1"
      onclick="${selectFn}(this)">
      <div class="nut-dd-name">${esc(f.name)}</div>
      <div class="nut-dd-desc">${f.kcal} РєРєР°Р» В· Р‘:${f.protein}Рі Р–:${f.fat}Рі РЈ:${f.carbs}Рі РЅР° 100Рі</div>
    </div>`).join('');
  const html=customRows+localRows;
  if(!html){dd.style.display='none';return;}
  dd.innerHTML=html;
  dd.style.display='block';
}
function hideDropdown(id){const dd=document.getElementById(id);if(dd)dd.style.display='none';}
function hideNutDropdown(){hideDropdown('nutDropdown');}

function selectNutFood(el){
  hideDropdown('nutDropdown');
  const name=el.dataset.name;
  let per100;
  if(el.dataset.custom==='1'||el.dataset.local==='1'){
    per100={kcal:parseFloat(el.dataset.kcal)||0,protein:parseFloat(el.dataset.p)||0,fat:parseFloat(el.dataset.f)||0,carbs:parseFloat(el.dataset.c)||0};
  }else{
    per100=parseFoodDescription(el.dataset.desc||'');
    if(!per100)per100={kcal:0,protein:0,fat:0,carbs:0};
  }
  _nutSelectedFood={name,per100};
  document.getElementById('nutSearchArea').style.display='none';
  document.getElementById('nutSelectedCard').style.display='block';
  document.getElementById('nutSelName').textContent=name;
  document.getElementById('nutSelPer100').textContent=`РЅР° 100Рі: ${per100.kcal} РєРєР°Р» В· Р‘:${per100.protein}Рі Р–:${per100.fat}Рі РЈ:${per100.carbs}Рі`;
  document.getElementById('nutWeight').value=100;
  document.getElementById('nutSaveBtn').style.display='';
  recalcNutByWeight();
}
function clearNutSelection(){
  _nutSelectedFood=null;
  document.getElementById('nutSearchArea').style.display='';
  document.getElementById('nutSelectedCard').style.display='none';
  document.getElementById('nutSaveBtn').style.display='none';
  document.getElementById('nutName').value='';
  document.getElementById('nutName').focus();
}
function recalcNutByWeight(){
  if(!_nutSelectedFood)return;
  const w=parseFloat(document.getElementById('nutWeight').value)||100;
  const k=_nutSelectedFood.per100;const m=w/100;
  document.getElementById('ncb-k').textContent=Math.round(k.kcal*m);
  document.getElementById('ncb-p').textContent=Math.round(k.protein*m*10)/10+'Рі';
  document.getElementById('ncb-f').textContent=Math.round(k.fat*m*10)/10+'Рі';
  document.getElementById('ncb-c').textContent=Math.round(k.carbs*m*10)/10+'Рі';
}

let _buildSelectedIng=null;
let _buildIngredients=[];

function selectBuildIng(el){
  hideDropdown('buildDropdown');
  const name=el.dataset.name;
  let per100;
  if(el.dataset.custom==='1'||el.dataset.local==='1'){
    per100={kcal:parseFloat(el.dataset.kcal)||0,protein:parseFloat(el.dataset.p)||0,fat:parseFloat(el.dataset.f)||0,carbs:parseFloat(el.dataset.c)||0};
  }else{
    per100=parseFoodDescription(el.dataset.desc||'');
    if(!per100)per100={kcal:0,protein:0,fat:0,carbs:0};
  }
  _buildSelectedIng={name,per100};
  document.getElementById('buildIngSelName').textContent=name;
  document.getElementById('buildIngPer100').textContent=`РЅР° 100Рі: ${per100.kcal} РєРєР°Р» В· Р‘:${per100.protein}Рі Р–:${per100.fat}Рі РЈ:${per100.carbs}Рі`;
  document.getElementById('buildIngCard').style.display='block';
  document.getElementById('buildIngWeight').value=100;
  recalcBuildIng();
}
function recalcBuildIng(){
  if(!_buildSelectedIng)return;
  const w=parseFloat(document.getElementById('buildIngWeight').value)||100;
  const k=_buildSelectedIng.per100;const m=w/100;
  document.getElementById('bncb-k').textContent=Math.round(k.kcal*m);
  document.getElementById('bncb-p').textContent=Math.round(k.protein*m*10)/10+'Рі';
  document.getElementById('bncb-f').textContent=Math.round(k.fat*m*10)/10+'Рі';
  document.getElementById('bncb-c').textContent=Math.round(k.carbs*m*10)/10+'Рі';
}
function addBuildIngredient(){
  if(!_buildSelectedIng)return;
  const w=parseFloat(document.getElementById('buildIngWeight').value)||100;
  const k=_buildSelectedIng.per100;const m=w/100;
  _buildIngredients.push({
    name:_buildSelectedIng.name,weight:w,
    kcal:Math.round(k.kcal*m),protein:Math.round(k.protein*m*10)/10,
    fat:Math.round(k.fat*m*10)/10,carbs:Math.round(k.carbs*m*10)/10
  });
  _buildSelectedIng=null;
  document.getElementById('buildIngCard').style.display='none';
  document.getElementById('buildIngName').value='';
  renderBuildIngredients();
}
function removeBuildIngredient(idx){
  _buildIngredients.splice(idx,1);renderBuildIngredients();
}
function renderBuildIngredients(){
  const list=document.getElementById('buildIngList');
  const totBox=document.getElementById('buildTotalBox');
  if(!_buildIngredients.length){list.innerHTML='';totBox.style.display='none';return;}
  list.innerHTML=_buildIngredients.map((ing,i)=>`
    <div class="nut-ing-item">
      <div class="nut-ing-info">
        <div class="nut-ing-name">${esc(ing.name)}</div>
        <div class="nut-ing-macros">${ing.weight}Рі В· Р‘:${ing.protein}Рі Р–:${ing.fat}Рі РЈ:${ing.carbs}Рі</div>
      </div>
      <div class="nut-ing-kcal">${ing.kcal} РєРєР°Р»</div>
      <button class="nut-ing-del" onclick="removeBuildIngredient(${i})">вњ•</button>
    </div>`).join('');
  const tot=_buildIngredients.reduce((a,i)=>({k:a.k+i.kcal,p:a.p+i.protein,f:a.f+i.fat,c:a.c+i.carbs}),{k:0,p:0,f:0,c:0});
  document.getElementById('btot-k').textContent=tot.k;
  document.getElementById('btot-p').textContent=Math.round(tot.p*10)/10+'Рі';
  document.getElementById('btot-f').textContent=Math.round(tot.f*10)/10+'Рі';
  document.getElementById('btot-c').textContent=Math.round(tot.c*10)/10+'Рі';
  totBox.style.display='block';
}
async function saveCustomDish(){
  const name=(document.getElementById('buildDishName').value||'').trim();
  if(!name)return toast('Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ Р±Р»СЋРґР°','e');
  if(!_buildIngredients.length)return toast('Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РёРЅРіСЂРµРґРёРµРЅС‚','e');
  const tot=_buildIngredients.reduce((a,i)=>({k:a.k+i.kcal,p:a.p+i.protein,f:a.f+i.fat,c:a.c+i.carbs}),{k:0,p:0,f:0,c:0});
  const type=document.getElementById('buildType').value;
  const btn=document.getElementById('buildSaveBtn');
  btn.disabled=true;btn.textContent='...';
  try{
    await authFetch(`/api/custom-foods/${ME.id}`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,ingredients:_buildIngredients,kcal:tot.k,protein:tot.p,fat:tot.f,carbs:tot.c})});
    const r=await authFetch(`/api/nutrition/${ME.id}`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,type,kcal:tot.k,protein:tot.p,fat:tot.f,carbs:tot.c,date:_nutDate})});
    if(!r.ok){const d=await r.json();throw new Error(d.error||'РћС€РёР±РєР°');}
    await loadCustomFoods();
    closeMo('mAddNut');resetNutModal();
    toast('Р‘Р»СЋРґРѕ СЃРѕС…СЂР°РЅРµРЅРѕ Рё РґРѕР±Р°РІР»РµРЅРѕ!','s');loadUserNutrition();
  }catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}
  btn.disabled=false;btn.textContent='РЎРѕС…СЂР°РЅРёС‚СЊ Рё РґРѕР±Р°РІРёС‚СЊ';
}

function parseFoodDescription(desc){
  if(!desc)return null;
  const cal=desc.match(/Calories:\s*([\d.]+)/i);
  const fat=desc.match(/Fat:\s*([\d.]+)/i);
  const carb=desc.match(/Carbs:\s*([\d.]+)/i);
  const prot=desc.match(/Prot:\s*([\d.]+)/i);
  if(!cal)return null;
  return{kcal:Math.round(parseFloat(cal[1])||0),fat:parseFloat(fat?.[1])||0,carbs:parseFloat(carb?.[1])||0,protein:parseFloat(prot?.[1])||0};
}

function toggleNutStar(){
  _nutSaveFav=!_nutSaveFav;
  document.getElementById('nutStarToggle').classList.toggle('active',_nutSaveFav);
  document.getElementById('nutStarIcon').textContent=_nutSaveFav?'в­ђ':'в†';
}
function resetNutModal(){
  _nutSaveFav=false;_nutSelectedFood=null;
  _buildSelectedIng=null;_buildIngredients=[];
  document.getElementById('nutStarToggle')?.classList.remove('active');
  const icon=document.getElementById('nutStarIcon');if(icon)icon.textContent='в†';
  document.getElementById('nutSearchArea').style.display='';
  document.getElementById('nutSelectedCard').style.display='none';
  const saveBtn=document.getElementById('nutSaveBtn');if(saveBtn)saveBtn.style.display='none';
  document.getElementById('nutName').value='';
  document.getElementById('buildDishName').value='';
  document.getElementById('buildIngName').value='';
  document.getElementById('buildIngCard').style.display='none';
  document.getElementById('buildIngList').innerHTML='';
  document.getElementById('buildTotalBox').style.display='none';
  hideDropdown('nutDropdown');hideDropdown('buildDropdown');
  const title=document.getElementById('nutModalTitle');
  if(title)title.textContent='рџҐ— Р”РѕР±Р°РІРёС‚СЊ РїСЂРёС‘Рј РїРёС‰Рё';
  const ownFields=['ownNutName','ownNutKcal','ownNutProt','ownNutFat','ownNutCarb'];
  ownFields.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const ownGrams=document.getElementById('ownNutGrams');if(ownGrams)ownGrams.value='100';
  const ownPrev=document.getElementById('ownNutPreview');if(ownPrev)ownPrev.innerHTML='';
  switchNutTab('search');
}

async function loadNutFavorites(){
  if(!ME)return;
  const list=document.getElementById('nutFavList');if(!list)return;
  try{
    const r=await authFetch(`/api/favorites/${ME.id}`);
    if(!r.ok){list.innerHTML='<div class="empty" style="padding:20px 0"><div class="ei">в­ђ</div>РќРµС‚ РёР·Р±СЂР°РЅРЅРѕРіРѕ</div>';return;}
    _nutFavsCache=await r.json();
    if(!_nutFavsCache.length){list.innerHTML='<div class="empty" style="padding:20px 0"><div class="ei">в­ђ</div>РќРµС‚ РёР·Р±СЂР°РЅРЅРѕРіРѕ</div>';return;}
    list.innerHTML=_nutFavsCache.map(f=>`
      <div class="nut-recent-item" onclick="applyNutFavorite('${f.id}')">
        <div class="nut-recent-icon">${_NUT_EMOJI[f.type]||'рџЌЅ'}</div>
        <div class="nut-recent-info">
          <div class="nut-recent-name">${esc(f.name)}</div>
          <div class="nut-recent-macros">Р‘:${+(f.protein||0).toFixed(1)}Рі В· Р–:${+(f.fat||0).toFixed(1)}Рі В· РЈ:${+(f.carbs||0).toFixed(1)}Рі</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div class="nut-recent-kcal">${f.kcal||0} РєРєР°Р»</div>
          <button class="nut-meal-entry-del" onclick="event.stopPropagation();deleteNutFavorite('${f.id}')" title="РЈРґР°Р»РёС‚СЊ">вњ•</button>
        </div>
      </div>`).join('');
  }catch(e){list.innerHTML='<div class="empty" style="padding:20px 0"><div class="ei">в­ђ</div>РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё</div>';}
}
function applyNutFavorite(id){
  const fav=_nutFavsCache.find(f=>f.id===id);if(!fav)return;
  const per100=fav.per100||{kcal:fav.kcal||0,protein:fav.protein||0,fat:fav.fat||0,carbs:fav.carbs||0};
  _nutSelectedFood={name:fav.name,per100};
  document.getElementById('nutSearchArea').style.display='none';
  document.getElementById('nutSelectedCard').style.display='block';
  document.getElementById('nutSelName').textContent=fav.name;
  document.getElementById('nutSelPer100').textContent=`РЅР° 100Рі: ${per100.kcal} РєРєР°Р» В· Р‘:${per100.protein}Рі Р–:${per100.fat}Рі РЈ:${per100.carbs}Рі`;
  document.getElementById('nutWeight').value=100;
  document.getElementById('nutType').value=fav.type||'snack';
  document.getElementById('nutSaveBtn').style.display='';
  recalcNutByWeight();
  switchNutTab('search');
}
async function deleteNutFavorite(id){
  try{
    await authFetch(`/api/favorites/${ME.id}/${id}`,{method:'DELETE'});
    toast('РЈРґР°Р»РµРЅРѕ РёР· РёР·Р±СЂР°РЅРЅРѕРіРѕ','w');loadNutFavorites();
  }catch(e){toast('РћС€РёР±РєР°','e');}
}

async function loadNutRecent(){
  const list=document.getElementById('nutRecentList');if(!list||!ME)return;
  try{
    const r=await authFetch(`/api/nutrition/${ME.id}`);
    if(!r.ok){list.innerHTML='<div class="empty" style="padding:20px 0"><div class="ei">рџ•ђ</div>РќРµС‚ РЅРµРґР°РІРЅРёС…</div>';return;}
    const all=await r.json();
    const seen=new Map();
    all.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    for(const e of all){if(!seen.has(e.name))seen.set(e.name,e);}
    _nutRecentCache=[...seen.values()].slice(0,20);
    if(!_nutRecentCache.length){list.innerHTML='<div class="empty" style="padding:20px 0"><div class="ei">рџ•ђ</div>РќРµС‚ РЅРµРґР°РІРЅРёС… Р·Р°РїРёСЃРµР№</div>';return;}
    list.innerHTML=_nutRecentCache.map(e=>`
      <div class="nut-recent-item" onclick="applyNutRecent(${JSON.stringify(e.name)})">
        <div class="nut-recent-icon">${_NUT_EMOJI[e.type]||'рџЌЅ'}</div>
        <div class="nut-recent-info">
          <div class="nut-recent-name">${esc(e.name)}</div>
          <div class="nut-recent-macros">Р‘:${+(e.protein||0).toFixed(1)}Рі В· Р–:${+(e.fat||0).toFixed(1)}Рі В· РЈ:${+(e.carbs||0).toFixed(1)}Рі</div>
        </div>
        <div class="nut-recent-kcal">${e.kcal||0} РєРєР°Р»</div>
      </div>`).join('');
  }catch(ex){list.innerHTML='<div class="empty" style="padding:20px 0"><div class="ei">рџ•ђ</div>РќРµС‚ РґР°РЅРЅС‹С…</div>';}
}
function applyNutRecent(name){
  const e=_nutRecentCache.find(x=>x.name===name);if(!e)return;
  const per100={kcal:e.kcal||0,protein:e.protein||0,fat:e.fat||0,carbs:e.carbs||0};
  _nutSelectedFood={name:e.name,per100};
  document.getElementById('nutSearchArea').style.display='none';
  document.getElementById('nutSelectedCard').style.display='block';
  document.getElementById('nutSelName').textContent=e.name;
  document.getElementById('nutSelPer100').textContent=`${per100.kcal} РєРєР°Р» В· Р‘:${per100.protein}Рі Р–:${per100.fat}Рі РЈ:${per100.carbs}Рі`;
  document.getElementById('nutWeight').value=100;
  document.getElementById('nutType').value=e.type||'snack';
  document.getElementById('nutSaveBtn').style.display='';
  recalcNutByWeight();
  switchNutTab('search');
}

function v(id){return document.getElementById(id).value.trim();}
function clr(a){a.forEach(id=>document.getElementById(id).value='');}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtDt(iso){return new Date(iso).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function toast(msg,type='s'){const ic={s:'вњ…',e:'вќЊ',w:'вљ пёЏ'};const t=document.createElement('div');t.className=`toast ${type}`;t.textContent=`${ic[type]||'вЂў'} ${msg}`;document.getElementById('toasts').appendChild(t);setTimeout(()=>t.remove(),4500);}
function updateViewportVars(){
  const vv=window.visualViewport;
  const h=vv?Math.round(vv.height):window.innerHeight;
  document.documentElement.style.setProperty('--vvh',`${h}px`);
}
function syncPlanEditorToInput(target){
  if(!target)return;
  const mo=document.getElementById('mPlanEditor');
  if(!mo||!mo.classList.contains('open'))return;
  const scroller=mo.querySelector('.ped-editor-scroll');
  if(!scroller||!scroller.contains(target))return;
  requestAnimationFrame(()=>target.scrollIntoView({block:'nearest',inline:'nearest'}));
}
function openMo(id,nutType){
  document.getElementById(id).classList.add('open');
  updateViewportVars();
  if(id==='mAddW')onOpenAddW();
  if(id==='mAddNut'){
    nutSetupAutocomplete();
    buildSetupAutocomplete();
    switchNutTab('search');
    if(nutType){
      const sel=document.getElementById('nutType');if(sel)sel.value=nutType;
      const sel2=document.getElementById('buildType');if(sel2)sel2.value=nutType;
      const names={breakfast:'рџЊ… Р—Р°РІС‚СЂР°Рє',lunch:'вЂпёЏ РћР±РµРґ',dinner:'рџЊ† РЈР¶РёРЅ',snack:'рџЌЋ РџРµСЂРµРєСѓСЃ'};
      const title=document.getElementById('nutModalTitle');
      if(title)title.textContent='рџҐ— '+names[nutType];
    }else{
      const title=document.getElementById('nutModalTitle');
      if(title)title.textContent='рџҐ— Р”РѕР±Р°РІРёС‚СЊ РїСЂРёС‘Рј РїРёС‰Рё';
    }
    loadCustomFoods();
    loadNutFavorites();
    loadNutRecent();
  }
}
function closeMo(id){document.getElementById(id).classList.remove('open');}
updateViewportVars();
window.addEventListener('resize',updateViewportVars);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',updateViewportVars);
  window.visualViewport.addEventListener('scroll',updateViewportVars);
}
document.addEventListener('focusin',e=>{
  const t=e.target;
  if(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))syncPlanEditorToInput(t);
});
document.querySelectorAll('.mo').forEach(m=>m.addEventListener('click',e=>{
  if(e.target!==m)return;
  if(m.id==='mPlanEditor'){
    if(_pedDirty){if(!confirm('Р•СЃС‚СЊ РЅРµСЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ. Р—Р°РєСЂС‹С‚СЊ Р±РµР· СЃРѕС…СЂР°РЅРµРЅРёСЏ?'))return;}
    _pedDirty=false;
  }
  m.classList.remove('open');
}));
function chartCfg(weights){return{type:'line',data:{labels:weights.map(w=>w.date),datasets:[{label:'Р’РµСЃ (РєРі)',data:weights.map(w=>w.weight),borderColor:'#a78bfa',backgroundColor:'rgba(139,92,246,.08)',borderWidth:2.5,pointBackgroundColor:'#a78bfa',pointRadius:5,tension:.35,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8b9eb5',font:{size:11}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#8b9eb5',font:{size:11}},grid:{color:'rgba(255,255,255,.04)'}}}}}}
function openLightbox(url){document.getElementById('lightbox-img').src=url;document.getElementById('lightbox').classList.add('open');document.body.style.overflow='hidden';}
function closeLightbox(e){if(e&&e.target===document.getElementById('lightbox-img'))return;document.getElementById('lightbox').classList.remove('open');document.getElementById('lightbox-img').src='';document.body.style.overflow='';}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();});
function exportExcel(){toast('вЏі РџРѕРґРіРѕС‚РѕРІРєР° С„Р°Р№Р»Р°...','w');const a=document.createElement('a');a.href='/api/export/students';a.download='';document.body.appendChild(a);a.click();document.body.removeChild(a);}

(async function init(){
  const splash=document.getElementById('splash');
  const ok=await tryAutoLogin();
  setTimeout(()=>{
    splash.classList.add('hide');
    setTimeout(()=>splash.style.display='none',400);
    if(ok){ startApp(); }
    else {
      document.getElementById('landingPage').classList.add('show');
      loadCrossEvent();
    }
  },800);
})();

function showLogin(){
  document.getElementById('landingPage').classList.remove('show');
  document.getElementById('loginPage').classList.add('show');
}

function showLanding(){
  document.getElementById('loginPage').classList.remove('show');
  document.getElementById('landingPage').classList.add('show');
  loadCrossEvent();
}

// в”Ђв”Ђ РљР°СЂС‚РѕС‡РєР° СЃРѕР±С‹С‚РёСЏ РєСЂРѕСЃСЃР° РЅР° Р»РµРЅРґРёРЅРіРµ в”Ђв”Ђ
function loadCrossEvent() {
  const card = document.getElementById('crossEventCard');
  if (!card) return;
  const ev = window._CE || {};
  if (!ev.datetime && !ev.location) { card.style.display = 'none'; return; }
  document.getElementById('ceDateTime').textContent = ev.datetime || 'вЂ”';
  document.getElementById('ceLocation').textContent = ev.location || 'вЂ”';
  card.style.display = 'block';
}

async function saveCrossEvent() {
  const datetime = (document.getElementById('ceEditDate')?.value || '').trim();
  const location = (document.getElementById('ceEditLocation')?.value || '').trim();
  if (!datetime && !location) { toast('Р—Р°РїРѕР»РЅРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ РїРѕР»Рµ','e'); return; }
  const status = document.getElementById('ceStatus');
  if (status) status.textContent = 'РЎРѕС…СЂР°РЅРµРЅРёРµ...';
  try {
    await api('/api/cross-event', 'POST', { datetime, location });
    window._CE = { datetime, location };
    if (status) status.textContent = 'вњ… РћРїСѓР±Р»РёРєРѕРІР°РЅРѕ';
    document.getElementById('ceClearBtn').style.display = '';
    loadCrossEvent();
    toast('вњ… РћРїСѓР±Р»РёРєРѕРІР°РЅРѕ РЅР° РІРёР·РёС‚РєРµ', 's');
  } catch(e) { toast('РћС€РёР±РєР°: ' + e.message, 'e'); if (status) status.textContent = ''; }
}

async function clearCrossEvent() {
  if (!confirm('РЈР±СЂР°С‚СЊ СЃ РІРёР·РёС‚РєРё?')) return;
  try {
    await api('/api/cross-event', 'DELETE');
    document.getElementById('ceEditDate').value = '';
    document.getElementById('ceEditLocation').value = '';
    document.getElementById('ceStatus').textContent = '';
    document.getElementById('ceClearBtn').style.display = 'none';
    document.getElementById('crossEventCard').style.display = 'none';
    toast('РЈР±СЂР°РЅРѕ', 'w');
  } catch(e) { toast('РћС€РёР±РєР°: ' + e.message, 'e'); }
}

async function loadCrossEventAdmin() {
  try {
    const ev = await api('/api/cross-event');
    const dtEl = document.getElementById('ceEditDate');
    const locEl = document.getElementById('ceEditLocation');
    if (dtEl && ev.datetime) dtEl.value = ev.datetime;
    if (locEl && ev.location) locEl.value = ev.location;
    const hasEvent = ev.datetime || ev.location;
    const status = document.getElementById('ceStatus');
    if (status) status.textContent = hasEvent ? 'вњ… РЎРµР№С‡Р°СЃ РѕРїСѓР±Р»РёРєРѕРІР°РЅРѕ' : '';
    const clearBtn = document.getElementById('ceClearBtn');
    if (clearBtn) clearBtn.style.display = hasEvent ? '' : 'none';
  } catch(e) {}
}


let _cregCooldown=0;
async function submitCrossReg(){
  const name=(document.getElementById('cregName').value||'').trim();
  const phone=(document.getElementById('cregPhone').value||'').trim();
  const tg=(document.getElementById('cregTg').value||'').trim();
  const honeypot=(document.getElementById('cregWebsite').value||'').trim();
  const err=document.getElementById('cregErr');
  err.style.display='none';
  if(honeypot) return;
  if(!name){err.style.display='block';err.textContent='Р’РІРµРґРёС‚Рµ РёРјСЏ';return;}
  if(!phone){err.style.display='block';err.textContent='Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°';return;}
  const digits=phone.replace(/\D/g,'');
  if(digits.length<7){err.style.display='block';err.textContent='Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°';return;}
  const now=Date.now();
  if(now<_cregCooldown){
    const sec=Math.ceil((_cregCooldown-now)/1000);
    err.style.display='block';err.textContent=`РџРѕРґРѕР¶РґРёС‚Рµ ${sec} СЃРµРє. РїРµСЂРµРґ РїРѕРІС‚РѕСЂРЅРѕР№ РѕС‚РїСЂР°РІРєРѕР№`;return;
  }
  const btn=document.getElementById('cregBtn');
  btn.disabled=true;btn.textContent='...';
  try{
    const res=await fetch('/api/cross-register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,telegram:tg})});
    const data=await res.json();
    if(!res.ok){err.style.display='block';err.textContent=data.error||'РћС€РёР±РєР°';btn.disabled=false;btn.textContent='Р—Р°РїРёСЃР°С‚СЊСЃСЏ';return;}
    _cregCooldown=Date.now()+30000;
    document.getElementById('crossRegForm').style.display='none';
    document.getElementById('crossRegSuccess').style.display='block';
    ['cregName','cregPhone','cregTg'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  }catch(e){err.style.display='block';err.textContent='РћС€РёР±РєР°: '+e.message;}
  btn.disabled=false;btn.textContent='Р—Р°РїРёСЃР°С‚СЊСЃСЏ';
}

function _resetCrossRegModal(){
  document.getElementById('crossRegForm').style.display='block';
  document.getElementById('crossRegSuccess').style.display='none';
  ['cregName','cregPhone','cregTg'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});;
  const err=document.getElementById('cregErr');if(err)err.style.display='none';
}
var _origCloseMo = closeMo;
closeMo = function(id){
  _origCloseMo(id);
  if(id==='mCrossReg') setTimeout(_resetCrossRegModal, 300);
  if(id==='mProjReg') setTimeout(_resetProjRegModal, 300);
};

function _resetProjRegModal(){
  document.getElementById('projRegForm').style.display='block';
  document.getElementById('projRegSuccess').style.display='none';
  ['pregName','pregPhone','pregTg'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const err=document.getElementById('pregErr');if(err)err.style.display='none';
}

let _pregCooldown=0;
async function submitProjReg(){
  const name=(document.getElementById('pregName').value||'').trim();
  const phone=(document.getElementById('pregPhone').value||'').trim();
  const tg=(document.getElementById('pregTg').value||'').trim();
  const honeypot=(document.getElementById('pregWebsite').value||'').trim();
  const err=document.getElementById('pregErr');
  err.style.display='none';
  if(honeypot) return;
  if(!name){err.style.display='block';err.textContent='Р’РІРµРґРёС‚Рµ РёРјСЏ';return;}
  if(!phone){err.style.display='block';err.textContent='Р’РІРµРґРёС‚Рµ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°';return;}
  const digits=phone.replace(/\D/g,'');
  if(digits.length<7){err.style.display='block';err.textContent='Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°';return;}
  const now=Date.now();
  if(now<_pregCooldown){
    const sec=Math.ceil((_pregCooldown-now)/1000);
    err.style.display='block';err.textContent=`РџРѕРґРѕР¶РґРёС‚Рµ ${sec} СЃРµРє.`;return;
  }
  const btn=document.getElementById('pregBtn');
  btn.disabled=true;btn.textContent='...';
  try{
    const res=await fetch('/api/project-register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,telegram:tg})});
    const data=await res.json();
    if(!res.ok){err.style.display='block';err.textContent=data.error||'РћС€РёР±РєР°';btn.disabled=false;btn.textContent='Р—Р°РїРёСЃР°С‚СЊСЃСЏ';return;}
    _pregCooldown=Date.now()+30000;
    document.getElementById('projRegForm').style.display='none';
    document.getElementById('projRegSuccess').style.display='block';
    ['pregName','pregPhone','pregTg'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  }catch(e){err.style.display='block';err.textContent='РћС€РёР±РєР°: '+e.message;}
  btn.disabled=false;btn.textContent='Р—Р°РїРёСЃР°С‚СЊСЃСЏ';
}

async function loadProjRegistrants(){
  const list=document.getElementById('projRegList');
  const cnt=document.getElementById('projRegCount');
  if(!list)return;
  try{
    const data=await api('/api/project-register');
    if(cnt) cnt.textContent=`Р’СЃРµРіРѕ Р·Р°СЏРІРѕРє: ${data.length}`;
    if(!data.length){list.innerHTML='<div class="empty" style="padding:16px 0"><div class="ei">рџ’Є</div>РџРѕРєР° РЅРµС‚ Р·Р°СЏРІРѕРє</div>';return;}
    list.innerHTML=data.map(r=>{
      const d=new Date(r.registeredAt);
      const dateStr=d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
      const meta=[r.phone,r.telegram].filter(Boolean).join(' В· ');
      return`<div class="creg-row">
        <div class="creg-ava">рџ’Є</div>
        <div class="creg-info">
          <div class="creg-name">${esc(r.name)}</div>
          <div class="creg-meta">${meta?esc(meta)+'<br>':''}<span style="opacity:.6">${dateStr}</span></div>
        </div>
        <button class="creg-del" onclick="deleteProjReg('${r.id}',this)">вњ•</button>
      </div>`;
    }).join('');
  }catch(e){list.innerHTML='<div class="empty" style="padding:16px 0">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё</div>';}
}

async function deleteProjReg(id, btn){
  if(!confirm('РЈРґР°Р»РёС‚СЊ Р·Р°СЏРІРєСѓ?'))return;
  btn.disabled=true;
  try{await api('/api/project-register/'+id,'DELETE');loadProjRegistrants();}
  catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');btn.disabled=false;}
}

function switchAcrossTab(tab, btn){
  document.querySelectorAll('#p-across .across-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('#p-across .across-section').forEach(s=>s.classList.remove('active'));
  btn.classList.add('active');
  if(tab==='cross'){
    document.getElementById('acrossCrossSection').classList.add('active');
    loadCrossRegistrants();
  } else if(tab==='project'){
    document.getElementById('acrossProjectSection').classList.add('active');
    loadProjRegistrants();
  }
}

async function loadCrossRegistrants(){
  const list=document.getElementById('crossRegList');
  const cnt=document.getElementById('crossRegCount');
  try{
    const data=await api('/api/cross-register');
    if(cnt) cnt.textContent=`Р’СЃРµРіРѕ Р·Р°СЏРІРѕРє: ${data.length}`;
    if(!data.length){list.innerHTML='<div class="empty" style="padding:16px 0"><div class="ei">рџЏѓ</div>РџРѕРєР° РЅРµС‚ Р·Р°СЏРІРѕРє</div>';return;}
    list.innerHTML=data.map(r=>{
      const d=new Date(r.registeredAt);
      const dateStr=d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
      const meta=[r.phone,r.telegram].filter(Boolean).join(' В· ');
      return`<div class="creg-row">
        <div class="creg-ava">рџЏѓ</div>
        <div class="creg-info">
          <div class="creg-name">${esc(r.name)}</div>
          <div class="creg-meta">${meta?esc(meta)+'<br>':''}<span style="opacity:.6">${dateStr}</span></div>
        </div>
        <button class="creg-del" onclick="deleteCrossReg('${r.id}',this)">вњ•</button>
      </div>`;
    }).join('');
  }catch(e){list.innerHTML='<div class="empty" style="padding:16px 0">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё</div>';}
}

async function deleteCrossReg(id, btn){
  if(!confirm('РЈРґР°Р»РёС‚СЊ Р·Р°СЏРІРєСѓ?'))return;
  btn.disabled=true;
  try{await api('/api/cross-register/'+id,'DELETE');loadCrossRegistrants();}
  catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');btn.disabled=false;}
}

async function loadAcrossStudents(){
  const list=document.getElementById('crossPartList');
  const cnt=document.getElementById('crossPartCount');
  if(!list)return;
  list.innerHTML='<div class="empty"><div class="sp-ring" style="margin:16px auto"></div></div>';
  try{
    const data=await api('/api/cross-participants');
    if(cnt) cnt.textContent=data.length ? `Р’СЃРµРіРѕ: ${data.length} С‡РµР».` : '';
    if(!data.length){list.innerHTML='<div class="empty" style="padding:16px 0"><div class="ei">рџЏѓ</div>РќРµС‚ СѓС‡Р°СЃС‚РЅРёРєРѕРІ РєСЂРѕСЃСЃР°</div>';return;}
    list.innerHTML=data.map(p=>`
      <div class="creg-row">
        <div class="creg-ava" style="background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.2)">${(p.name||'?')[0].toUpperCase()}</div>
        <div class="creg-info">
          <div class="creg-name">${esc(p.name)}</div>
          ${p.note?`<div class="creg-meta">${esc(p.note)}</div>`:''}
        </div>
        <button class="btn btn-g sm" onclick="deleteCrossPart('${p.id}',this)">рџ—‘</button>
      </div>`).join('');
  }catch(e){list.innerHTML='<div class="empty" style="padding:16px 0">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё</div>';}
}

let _crossPartMode = 'manual';
let _csMembers = [];
let _crossPartSelectedIds = new Set();

function openAddCrossParticipant(){
  document.getElementById('addCrossPartForm').style.display='block';
  switchCrossPartMode('manual');
}

function closeAddCrossParticipant(){
  document.getElementById('addCrossPartForm').style.display='none';
  document.getElementById('crossPartName').value='';
  document.getElementById('crossPartNote').value='';
  document.getElementById('crossPartLogin').value='';
  document.getElementById('crossPartPassword').value='';
  document.getElementById('crossPartSearch').value='';
  _crossPartSelectedIds.clear();
  updateSelectedNames();
}

function switchCrossPartMode(mode){
  _crossPartMode = mode;
  document.getElementById('crossPartManualBlock').style.display = mode==='manual' ? 'block' : 'none';
  document.getElementById('crossPartFromCSBlock').style.display = mode==='fromcs' ? 'block' : 'none';
  document.getElementById('crossPartModeManual').className = 'btn sm ' + (mode==='manual' ? 'btn-p' : 'btn-g');
  document.getElementById('crossPartModeFromCS').className  = 'btn sm ' + (mode==='fromcs' ? 'btn-p' : 'btn-g');
  if(mode==='fromcs') loadCSMembersForSelect();
}

async function loadCSMembersForSelect(){
  const box = document.getElementById('crossPartCSList');
  if(_csMembers.length){ renderCSMembers(_csMembers); return; }
  box.innerHTML='<div class="empty"><div class="sp-ring" style="margin:8px auto"></div></div>';
  try{
    _csMembers = await api('/api/users');
    renderCSMembers(_csMembers);
  }catch(e){ box.innerHTML='<div class="empty" style="padding:8px">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё</div>'; }
}

function renderCSMembers(list){
  const q = (document.getElementById('crossPartSearch').value||'').toLowerCase();
  const filtered = q ? list.filter(u=>(u.name||'').toLowerCase().includes(q)) : list;
  const box = document.getElementById('crossPartCSList');
  if(!filtered.length){ box.innerHTML='<div class="empty" style="padding:8px;font-size:13px">РќРµ РЅР°Р№РґРµРЅРѕ</div>'; return; }
  box.innerHTML = filtered.map(u=>{
    const sel = _crossPartSelectedIds.has(u.id);
    return `<div onclick="toggleCSMember('${u.id}','${esc(u.name)}')" style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-radius:10px;cursor:pointer;background:${sel?'rgba(139,92,246,.15)':'transparent'};transition:.15s">
      <div style="width:34px;height:34px;border-radius:50%;background:rgba(139,92,246,.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${(u.name||'?')[0].toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:600;color:#fff">${esc(u.name)}</div>
        <div style="font-size:12px;color:var(--mu2)">@${esc(u.login)} В· ${u.sessions||0} Р·Р°РЅСЏС‚РёР№</div>
      </div>
      <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${sel?'#7c3aed':'#3a4255'};background:${sel?'#7c3aed':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px">${sel?'вњ“':''}</div>
    </div>`;
  }).join('');
}

function toggleCSMember(id, name){
  if(_crossPartSelectedIds.has(id)) _crossPartSelectedIds.delete(id);
  else _crossPartSelectedIds.add(id);
  updateSelectedNames();
  renderCSMembers(_csMembers);
}

function updateSelectedNames(){
  const span = document.getElementById('crossPartSelectedNames');
  if(!span) return;
  if(!_crossPartSelectedIds.size){ span.textContent='РЅРёРєРѕРіРѕ'; return; }
  const names = _csMembers.filter(u=>_crossPartSelectedIds.has(u.id)).map(u=>u.name);
  span.textContent = names.join(', ');
}

function filterCSMembers(){
  renderCSMembers(_csMembers);
}

async function saveCrossParticipant(){
  const btn=document.getElementById('crossPartSaveBtn');
  btn.disabled=true; btn.textContent='РЎРѕС…СЂР°РЅСЏРµРј...';
  try{
    if(_crossPartMode==='manual'){
      const name=document.getElementById('crossPartName').value.trim();
      const login=document.getElementById('crossPartLogin').value.trim();
      const password=document.getElementById('crossPartPassword').value.trim();
      if(!name){toast('Р’РІРµРґРёС‚Рµ РёРјСЏ','e');return;}
      if(login && password){
        await api('/api/users','POST',{name,login,password,sessions:0,role:'cross'});
      }
      await api('/api/cross-participants','POST',{name,note:document.getElementById('crossPartNote').value.trim()||(login?'РђРєРєР°СѓРЅС‚: @'+login:'')});
      toast(login?`РЈС‡Р°СЃС‚РЅРёРє РґРѕР±Р°РІР»РµРЅ + Р°РєРєР°СѓРЅС‚ СЃРѕР·РґР°РЅ вњ“`:'РЈС‡Р°СЃС‚РЅРёРє РґРѕР±Р°РІР»РµРЅ вњ“');
    } else {
      if(!_crossPartSelectedIds.size){toast('Р’С‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕРіРѕ СѓС‡Р°СЃС‚РЅРёРєР°','e');return;}
      const selected = _csMembers.filter(u=>_crossPartSelectedIds.has(u.id));
      await Promise.all(selected.map(u=>api('/api/cross-participants','POST',{name:u.name,note:'РЈС‡Р°СЃС‚РЅРёРє CS'})));
      toast(`Р”РѕР±Р°РІР»РµРЅРѕ ${selected.length} С‡РµР». вњ“`);
    }
    closeAddCrossParticipant();
    loadAcrossStudents();
  }catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');}
  finally{btn.disabled=false;btn.textContent='РЎРѕС…СЂР°РЅРёС‚СЊ';}
}

async function deleteCrossPart(id,btn){
  if(!confirm('РЈРґР°Р»РёС‚СЊ СѓС‡Р°СЃС‚РЅРёРєР°?'))return;
  btn.disabled=true;
  try{await api('/api/cross-participants/'+id,'DELETE');loadAcrossStudents();}
  catch(e){toast('РћС€РёР±РєР°: '+e.message,'e');btn.disabled=false;}
}

document.getElementById('uPd').value=new Date(Date.now()+30*86400000).toISOString().split('T')[0];

let _crossState = 'idle';
let _crossWorker = null;
let _crossElapsed = 0;
let _crossStartTime = 0;
let _crossDistM = 0;
let _crossLastPos = null;
let _crossWatchId = null;
let _crossResult = null;
let _crossMap = null;
let _crossMyMarker = null;
let _crossLiveInterval = null;
let _crossOtherMarkers = {};
let _crossWakeLock = null;
let _crossNotifInterval = null;

async function _crossRequestNotifPerm() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
}

function _crossSendNotif() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const dist = (_crossDistM / 1000).toFixed(2);
  const time = fmtTime(_crossElapsed);
  new Notification('рџЏѓ Coach Space вЂ” С‚СЂРµРЅРёСЂРѕРІРєР° РёРґС‘С‚', {
    body: `вЏ± ${time}  вЂў  рџ“Ќ ${dist} РєРј`,
    icon: '/icon-192.png',
    tag: 'cross-run',
    renotify: true,
    silent: false
  });
}

function _crossStartNotifInterval() {
  _crossStopNotifInterval();
  _crossNotifInterval = setInterval(_crossSendNotif, 30000);
}
function _crossStopNotifInterval() {
  if (_crossNotifInterval) { clearInterval(_crossNotifInterval); _crossNotifInterval = null; }
}

function _crossWorkerStart(startTime) {
  if (_crossWorker) { _crossWorker.terminate(); _crossWorker = null; }
  let _saveTick = 0;
  try {
    _crossWorker = new Worker('/timer-worker.js');
    _crossWorker.onmessage = e => {
      _crossElapsed = e.data.elapsed;
      crossUpdateUI();
      if (++_saveTick % 10 === 0) _crossSaveState(); // РєР°Р¶РґС‹Рµ 10 СЃРµРє
    };
    _crossWorker.postMessage({ cmd: 'start', startTime });
  } catch(err) {
    console.warn('Worker РЅРµРґРѕСЃС‚СѓРїРµРЅ, РёСЃРїРѕР»СЊР·СѓРµРј setInterval');
    _crossWorker = { _iv: setInterval(() => {
      _crossElapsed = Math.floor((Date.now() - startTime) / 1000);
      crossUpdateUI();
      if (++_saveTick % 10 === 0) _crossSaveState();
    }, 1000), terminate() { clearInterval(this._iv); } };
  }
}

function _crossRestartGPS() {
  if (_crossWatchId !== null) { navigator.geolocation.clearWatch(_crossWatchId); _crossWatchId = null; }
  let _lastPosSentAt = 0;
  _crossWatchId = navigator.geolocation.watchPosition(pos => {
    if (_crossState !== 'running') return;
    const acc = pos.coords.accuracy;
    const {latitude: lat, longitude: lon} = pos.coords;
    if (acc <= 20) {
      if (_crossLastPos) {
        const d = haversine(_crossLastPos.lat, _crossLastPos.lon, lat, lon);
        if (d >= 3 && d < 300) { _crossDistM += d; _crossSaveState(); }
      }
      _crossLastPos = {lat, lon};
      document.getElementById('crossGpsWarn').style.display = 'none';
      crossUpdateLiveMap(lat, lon);
    } else {
      document.getElementById('crossGpsWarn').style.display = 'block';
    }
    const now = Date.now();
    if (now - _lastPosSentAt > 5000 && ME) {
      _lastPosSentAt = now;
      api('/api/runs/active','POST',{userId:ME.id,userName:ME.name,lat,lon,isActive:true}).catch(()=>{});
    }
  }, err => {
    console.warn('GPS:', err.message);
    document.getElementById('crossGpsWarn').style.display = 'block';
  }, {enableHighAccuracy: true, maximumAge: 0, timeout: 15000});
}

function _crossWorkerStop() {
  if (_crossWorker) { _crossWorker.terminate(); _crossWorker = null; }
}

async function _crossAcquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      _crossWakeLock = await navigator.wakeLock.request('screen');
    }
  } catch(e) { console.log('WakeLock РЅРµРґРѕСЃС‚СѓРїРµРЅ:', e.message); }
}
function _crossReleaseWakeLock() {
  if (_crossWakeLock) { _crossWakeLock.release().catch(()=>{}); _crossWakeLock = null; }
}

// в”Ђв”Ђ РЎРѕС…СЂР°РЅРµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РєСЂРѕСЃСЃР° РІ localStorage в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function _crossSaveState() {
  if (_crossState !== 'running' && _crossState !== 'paused') return;
  localStorage.setItem('crossState', JSON.stringify({
    state: _crossState,
    startTime: _crossStartTime,
    elapsed: _crossElapsed,
    distM: _crossDistM,
    lastPos: _crossLastPos,
    savedAt: Date.now()
  }));
}

function _crossClearState() {
  localStorage.removeItem('crossState');
}

function _crossRestoreState() {
  try {
    const raw = localStorage.getItem('crossState');
    if (!raw) return false;
    const s = JSON.parse(raw);
    // РµСЃР»Рё СЃРѕС…СЂР°РЅРµРЅРѕ Р±РѕР»РµРµ 2 С‡Р°СЃРѕРІ РЅР°Р·Р°Рґ вЂ” РёРіРЅРѕСЂРёСЂСѓРµРј
    if (Date.now() - s.savedAt > 2 * 60 * 60 * 1000) { _crossClearState(); return false; }
    _crossState = s.state;
    _crossStartTime = s.startTime;
    _crossElapsed = s.elapsed;
    _crossDistM = s.distM;
    _crossLastPos = s.lastPos;
    return true;
  } catch { return false; }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && _crossState === 'running') {
    // РїРµСЂРµСЃС‡РёС‚Р°С‚СЊ РІСЂРµРјСЏ СЃ РјРѕРјРµРЅС‚Р° СѓС…РѕРґР°
    _crossElapsed = Math.floor((Date.now() - _crossStartTime) / 1000);
    crossUpdateUI();
    // РїРµСЂРµРїРѕРґРєР»СЋС‡РёС‚СЊ WakeLock вЂ” iOS РµРіРѕ СЃР±СЂР°СЃС‹РІР°РµС‚
    _crossAcquireWakeLock();
    // РїРµСЂРµР·Р°РїСѓСЃС‚РёС‚СЊ GPS РµСЃР»Рё РѕРЅ СѓРјРµСЂ РІ С„РѕРЅРµ
    if (_crossWatchId === null) {
      _crossRestartGPS();
    }
  }
  if (document.visibilityState === 'hidden' && _crossState === 'running') {
    _crossSaveState();
  }
});

function initCrossMap() {
  const mapEl = document.getElementById('crossMap');
  if (!mapEl) return;
  mapEl.style.display = 'block';
  if (!_crossMap) {
    _crossMap = L.map('crossMap', {zoomControl:true, attributionControl:false}).setView([43.238, 76.889], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(_crossMap);
  }
  setTimeout(() => { if (_crossMap) _crossMap.invalidateSize(); }, 200);
}

async function crossUpdateLiveMap(lat, lon) {
  if (!_crossMap) return;
  const latlng = [lat, lon];
  if (!_crossMyMarker) {
    _crossMyMarker = L.circleMarker(latlng, {radius:9,color:'#38bdf8',fillColor:'#38bdf8',fillOpacity:.9,weight:2}).addTo(_crossMap).bindPopup(esc(ME?.name || 'Р’С‹'));
  } else {
    _crossMyMarker.setLatLng(latlng);
  }
  _crossMap.panTo(latlng);
  if (ME) api('/api/runs/active','POST',{userId:ME.id,lat,lon,isActive:true}).catch(()=>{});
}

async function crossPollOthers() {
  if (!_crossMap || !ME) return;
  try {
    const runners = await api('/api/runs/active');
    const seen = new Set();
    for (const r of runners) {
      if (r.userId === ME.id) continue;
      seen.add(r.userId);
      const latlng = [r.lat, r.lon];
      if (_crossOtherMarkers[r.userId]) {
        _crossOtherMarkers[r.userId].setLatLng(latlng);
      } else {
        _crossOtherMarkers[r.userId] = L.circleMarker(latlng, {radius:7,color:'#a78bfa',fillColor:'#a78bfa',fillOpacity:.8,weight:2})
          .addTo(_crossMap).bindPopup(esc(r.userName || r.userId));
      }
    }
    for (const uid of Object.keys(_crossOtherMarkers)) {
      if (!seen.has(uid)) { _crossOtherMarkers[uid].remove(); delete _crossOtherMarkers[uid]; }
    }
  } catch(e) {}
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function fmtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function fmtDist(m) {
  return m >= 1000 ? (m/1000).toFixed(2) : (m/1000).toFixed(3);
}

function fmtPace(distM, seconds) {
  if (distM < 10) return 'вЂ”';
  const minPerKm = seconds / 60 / (distM / 1000);
  const m = Math.floor(minPerKm), s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

function crossUpdateUI() {
  document.getElementById('crossTimer').textContent = fmtTime(_crossElapsed);
  const m = Math.round(_crossDistM);
  document.getElementById('crossDist').textContent = m >= 1000
    ? Math.floor(m/1000) + ' ' + String(m % 1000).padStart(3,'0')
    : String(m);
  document.getElementById('crossTime').textContent = fmtTime(_crossElapsed);
}

function crossToggleRun() {
  if (_crossState === 'idle') {
    crossStart();
  } else if (_crossState === 'paused') {
    crossResume();
  }
}

function crossStart() {
  if (!navigator.geolocation) {
    document.getElementById('crossGpsWarn').style.display = 'block';
    return;
  }
  _crossState = 'running';
  _crossElapsed = 0; _crossDistM = 0; _crossLastPos = null;
  _crossStartTime = Date.now();
  document.getElementById('crossStateLbl').textContent = 'РўСЂРµРЅРёСЂРѕРІРєР° РёРґС‘С‚...';
  document.getElementById('crossStartBtn').innerHTML = 'вЏё';
  document.getElementById('crossStartBtn').classList.add('running');
  document.getElementById('crossStartBtn').onclick = crossPause;
  document.getElementById('crossCtrl').style.display = 'flex';
  document.getElementById('crossPauseBtn').textContent = 'вЏё РџР°СѓР·Р°';
  document.getElementById('crossPauseBtn').onclick = crossPause;
  _crossWorkerStart(_crossStartTime);
  _crossAcquireWakeLock();
  _crossRequestNotifPerm().then(_crossStartNotifInterval);
  initCrossMap();
  _crossLiveInterval = setInterval(crossPollOthers, 4000);
  _crossRestartGPS();
}

function crossPause() {
  if (_crossState !== 'running') return;
  _crossElapsed = Math.floor((Date.now() - _crossStartTime) / 1000);
  _crossState = 'paused';
  _crossWorkerStop();
  _crossReleaseWakeLock();
  _crossStopNotifInterval();
  if (_crossWatchId !== null) { navigator.geolocation.clearWatch(_crossWatchId); _crossWatchId = null; }
  if (_crossLiveInterval) { clearInterval(_crossLiveInterval); _crossLiveInterval = null; }
  if (ME) api('/api/runs/active','POST',{userId:ME.id,isActive:false}).catch(()=>{});
  document.getElementById('crossStateLbl').textContent = 'РџР°СѓР·Р°';
  document.getElementById('crossStartBtn').innerHTML = 'в–¶';
  document.getElementById('crossStartBtn').classList.remove('running');
  document.getElementById('crossStartBtn').onclick = crossToggleRun;
  document.getElementById('crossPauseBtn').textContent = 'в–¶ РџСЂРѕРґРѕР»Р¶РёС‚СЊ';
  document.getElementById('crossPauseBtn').onclick = crossResume;
}

function crossResume() {
  if (_crossState !== 'paused') return;
  _crossState = 'running';
  _crossStartTime = Date.now() - (_crossElapsed * 1000);
  document.getElementById('crossStateLbl').textContent = 'РўСЂРµРЅРёСЂРѕРІРєР° РёРґС‘С‚...';
  document.getElementById('crossStartBtn').innerHTML = 'вЏё';
  document.getElementById('crossStartBtn').classList.add('running');
  document.getElementById('crossStartBtn').onclick = crossPause;
  document.getElementById('crossPauseBtn').textContent = 'вЏё РџР°СѓР·Р°';
  document.getElementById('crossPauseBtn').onclick = crossPause;
  _crossWorkerStart(_crossStartTime);
  _crossAcquireWakeLock();
  _crossStartNotifInterval();
  _crossLiveInterval = setInterval(crossPollOthers, 4000);
  _crossRestartGPS();
}

function crossFinish() {
  _crossWorkerStop();
  _crossReleaseWakeLock();
  _crossStopNotifInterval();
  _crossClearState();
  if (_crossWatchId !== null) { navigator.geolocation.clearWatch(_crossWatchId); _crossWatchId = null; }
  if (_crossLiveInterval) { clearInterval(_crossLiveInterval); _crossLiveInterval = null; }
  if (ME) api('/api/runs/active','POST',{userId:ME.id,isActive:false}).catch(()=>{});
  _crossState = 'finished';
  _crossResult = { distance: _crossDistM, duration: _crossElapsed, date: new Date().toISOString() };
  document.getElementById('crossTrainScreen').style.display = 'none';
  document.getElementById('crossResultScreen').style.display = 'block';
  document.getElementById('resTime').textContent = fmtTime(_crossElapsed);
  document.getElementById('resDist').textContent = fmtDist(_crossDistM) + ' РєРј';
}

async function crossSaveRun() {
  if (!ME || !_crossResult) return;
  try {
    await api('/api/runs', 'POST', {
      userId: ME.id,
      userName: ME.name,
      distance: _crossResult.distance,
      duration: _crossResult.duration,
      date: _crossResult.date
    });
    toast('вњ… РџСЂРѕР±РµР¶РєР° СЃРѕС…СЂР°РЅРµРЅР°!', 's');
    crossReset();
    loadLeaderboard('week', document.querySelector('#p-ucross .lb-btn.active'));
    loadCrossHistory();
  } catch(e) { toast('РћС€РёР±РєР°: ' + e.message, 'e'); }
}

function crossReset() {
  _crossWorkerStop();
  _crossReleaseWakeLock();
  _crossStopNotifInterval();
  _crossState = 'idle'; _crossElapsed = 0; _crossDistM = 0; _crossLastPos = null; _crossResult = null; _crossStartTime = 0;
  document.getElementById('crossTrainScreen').style.display = 'block';
  document.getElementById('crossResultScreen').style.display = 'none';
  document.getElementById('crossStateLbl').textContent = 'Р“РѕС‚РѕРІ Рє СЃС‚Р°СЂС‚Сѓ';
  document.getElementById('crossTimer').textContent = '00:00';
  document.getElementById('crossDist').textContent = '0';
  document.getElementById('crossTime').textContent = '00:00';
  document.getElementById('crossStartBtn').innerHTML = 'в–¶';
  document.getElementById('crossStartBtn').classList.remove('running');
  document.getElementById('crossStartBtn').onclick = crossToggleRun;
  document.getElementById('crossCtrl').style.display = 'none';
  document.getElementById('crossGpsWarn').style.display = 'none';
  const mapEl = document.getElementById('crossMap');
  if (mapEl) mapEl.style.display = 'none';
  if (_crossLiveInterval) { clearInterval(_crossLiveInterval); _crossLiveInterval = null; }
  if (ME) api('/api/runs/active','POST',{userId:ME.id,isActive:false}).catch(()=>{});
}

function renderLeaderboard(list, containerId) {
  const el = document.getElementById(containerId);
  if (!list || !list.length) { el.innerHTML = '<div class="empty" style="padding:20px 0"><div class="ei">рџЏѓ</div>РџРѕРєР° РЅРµС‚ РїСЂРѕР±РµР¶РµРє</div>'; return; }
  const medals = ['gold','silver','bronze'];
  el.innerHTML = list.map((row, i) => {
    const isMe = ME && row.userId === ME.id;
    const pos = i + 1;
    const distKm = (row.totalDistance / 1000).toFixed(2);
    return `<div class="lb-row${isMe?' me':''}">
      <div class="lb-pos${pos<=3?' '+medals[pos-1]:''}">${pos <= 3 ? ['рџҐ‡','рџҐ€','рџҐ‰'][pos-1] : pos}</div>
      <div>
        <div class="lb-name">${esc(row.userName)}${isMe?' <span style="color:var(--ac);font-size:11px">(РІС‹)</span>':''}</div>
        <div class="lb-meta">${row.totalRuns} РїСЂРѕР±РµР¶${row.totalRuns===1?'РєР°':row.totalRuns<5?'РєРё':'РµРє'}</div>
      </div>
      <div class="lb-dist">${distKm} РєРј</div>
    </div>`;
  }).join('');
}

async function loadLeaderboard(period, btn) {
  if (btn) { document.querySelectorAll('#p-ucross .lb-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }
  try {
    const list = await api('/api/runs/leaderboard?period=' + period);
    renderLeaderboard(list, 'crossLeaderboard');
  } catch(e) { document.getElementById('crossLeaderboard').innerHTML = '<div class="empty" style="padding:16px 0">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё</div>'; }
}

async function loadCrossHistory() {
  if (!ME) return;
  const el = document.getElementById('crossHistory');
  try {
    const list = await api('/api/runs/user/' + ME.id);
    if (!list.length) { el.innerHTML = '<div class="empty" style="padding:16px 0"><div class="ei">рџЏѓ</div>РќРµС‚ РїСЂРѕР±РµР¶РµРє</div>'; return; }
    el.innerHTML = list.map(r => {
      const d = new Date(r.date);
      const dateStr = d.toLocaleDateString('ru-RU', {day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
      return `<div class="run-hist-item">
        <div class="run-hist-icon">рџЏѓ</div>
        <div class="run-hist-info">
          <div class="run-hist-date">${dateStr}</div>
          <div class="run-hist-dist">${fmtDist(r.distance)} РєРј</div>
          <div class="run-hist-meta">${fmtTime(r.duration)}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = '<div class="empty" style="padding:16px 0">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё</div>'; }
}

async function loadAdminLeaderboard(period, btn) {
  if (btn) { document.querySelectorAll('#acrossLeaderboardSection .lb-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }
  try {
    const list = await api('/api/runs/leaderboard?period=' + period);
    renderLeaderboard(list, 'adminLeaderboard');
  } catch(e) { document.getElementById('adminLeaderboard').innerHTML = '<div class="empty" style="padding:16px 0">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё</div>'; }
}

function loadUserCross() {
  if (_crossState === 'idle') crossReset();
  loadLeaderboard('week', document.querySelector('#p-ucross .lb-btn.active'));
  loadCrossHistory();
}

function loadAdminCross() {
  const activeSec = document.querySelector('#p-across .across-section.active');
  if (!activeSec || activeSec.id === 'acrossCrossSection') {
    loadCrossRegistrants();
  } else if (activeSec.id === 'acrossProjectSection') {
    loadProjRegistrants();
  }
}

function ownNutCalc() {
  const grams = parseFloat(document.getElementById('ownNutGrams').value) || 100;
  const k100 = parseFloat(document.getElementById('ownNutKcal').value) || 0;
  const p100 = parseFloat(document.getElementById('ownNutProt').value) || 0;
  const f100 = parseFloat(document.getElementById('ownNutFat').value) || 0;
  const c100 = parseFloat(document.getElementById('ownNutCarb').value) || 0;
  const mul = grams / 100;
  document.getElementById('ownNutPreview').innerHTML =
    `<b>${grams}Рі:</b> ${Math.round(k100*mul)} РєРєР°Р» В· Р‘: ${(p100*mul).toFixed(1)} В· Р–: ${(f100*mul).toFixed(1)} В· РЈ: ${(c100*mul).toFixed(1)}`;
}

async function saveOwnNutEntry() {
  const name = document.getElementById('ownNutName').value.trim();
  if (!name) { toast('Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ', 'e'); return; }
  const grams = parseFloat(document.getElementById('ownNutGrams').value) || 100;
  const k100 = parseFloat(document.getElementById('ownNutKcal').value) || 0;
  const p100 = parseFloat(document.getElementById('ownNutProt').value) || 0;
  const f100 = parseFloat(document.getElementById('ownNutFat').value) || 0;
  const c100 = parseFloat(document.getElementById('ownNutCarb').value) || 0;
  const mul = grams / 100;
  const mealType = document.getElementById('nutType')?.value || 'snack';
  try {
    await api(`/api/custom-foods/${ME.id}`, 'POST', {
      name, kcal: Math.round(k100), protein: parseFloat(p100.toFixed(1)),
      fat: parseFloat(f100.toFixed(1)), carbs: parseFloat(c100.toFixed(1)),
      isShared: true, userName: ME.name
    });
    loadCustomFoods();
    await api(`/api/nutrition/${ME.id}`, 'POST', {
      name: `${name} (${grams}Рі)`, type: mealType,
      kcal: Math.round(k100 * mul),
      protein: parseFloat((p100 * mul).toFixed(1)),
      fat: parseFloat((f100 * mul).toFixed(1)),
      carbs: parseFloat((c100 * mul).toFixed(1)),
      date: _nutDate
    });
    toast('вњ… Р”РѕР±Р°РІР»РµРЅРѕ', 's');
    closeMo('mAddNut');
    resetNutModal();
    loadUserNutrition();
  } catch(e) { toast(e.message, 'e'); }
}

async function loadSharedFoods() {
  const box = document.getElementById('sharedFoodsList');
  if (!box) return;
  box.innerHTML = '<div class="empty" style="padding:20px 0"><div class="sp-ring" style="margin:0 auto 8px"></div>Р—Р°РіСЂСѓР·РєР°...</div>';
  try {
    const foods = await api('/api/shared-foods');
    if (!foods.length) { box.innerHTML = '<div class="empty" style="padding:20px 0"><div class="ei">рџ‘Ґ</div>РџРѕРєР° РЅРµС‚ РѕР±С‰РёС… РїСЂРѕРґСѓРєС‚РѕРІ</div>'; return; }
    box.innerHTML = foods.map(f => `
      <div class="nut-recent-item" style="cursor:pointer" onclick="selectSharedFood(${JSON.stringify(f).replace(/"/g,'&quot;')})">
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${esc(f.name)}</div>
          <div style="font-size:12px;color:var(--mu2)">${f.kcal} РєРєР°Р» В· Р‘:${f.protein} Р–:${f.fat} РЈ:${f.carbs} (РЅР° 100Рі)</div>
          <div style="font-size:11px;color:var(--mu2);margin-top:2px">РѕС‚ ${esc(f.userName||'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ')}</div>
        </div>
        <button class="btn btn-p sm" style="flex-shrink:0" onclick="event.stopPropagation();selectSharedFood(${JSON.stringify(f).replace(/"/g,'&quot;')})">+ Р”РѕР±Р°РІРёС‚СЊ</button>
      </div>`).join('');
  } catch(e) { box.innerHTML = `<div class="empty" style="padding:20px 0"><div class="ei">вљ пёЏ</div>${esc(e.message)}</div>`; }
}

function selectSharedFood(food) {
  switchNutTab('own');
  document.getElementById('ownNutName').value = food.name;
  document.getElementById('ownNutKcal').value = food.kcal;
  document.getElementById('ownNutProt').value = food.protein;
  document.getElementById('ownNutFat').value = food.fat;
  document.getElementById('ownNutCarb').value = food.carbs;
  document.getElementById('ownNutGrams').value = 100;
  ownNutCalc();
}

let _installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
});

function showInstallPrompt() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  if (isInStandalone) {
    toast('РџСЂРёР»РѕР¶РµРЅРёРµ СѓР¶Рµ СѓСЃС‚Р°РЅРѕРІР»РµРЅРѕ вњ“');
    return;
  }

  if (isIOS) {
    document.getElementById('iosInstallModal').style.display = 'flex';
    return;
  }

  if (_installPrompt) {
    _installPrompt.prompt();
    _installPrompt.userChoice.then(r => {
      if (r.outcome === 'accepted') toast('РџСЂРёР»РѕР¶РµРЅРёРµ РґРѕР±Р°РІР»РµРЅРѕ РЅР° РіР»Р°РІРЅС‹Р№ СЌРєСЂР°РЅ вњ“');
      _installPrompt = null;
    });
    return;
  }

  toast('РћС‚РєСЂРѕР№С‚Рµ РјРµРЅСЋ Р±СЂР°СѓР·РµСЂР° Рё РІС‹Р±РµСЂРёС‚Рµ В«Р”РѕР±Р°РІРёС‚СЊ РЅР° РіР»Р°РІРЅС‹Р№ СЌРєСЂР°РЅВ»');
}

function closeIOSModal() {
  document.getElementById('iosInstallModal').style.display = 'none';
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

const NUT_TEMPLATES = {
  gain: { label:'РќР°Р±РѕСЂ РјР°СЃСЃС‹', icon:'рџ’Є', bg:'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
    meals: {
      'Р—Р°РІС‚СЂР°Рє': [
        {name:'РћРІСЃСЏРЅРєР° СЃ СЏР№С†Р°РјРё Рё Р±Р°РЅР°РЅРѕРј',kcal:680,protein:42,fat:22,carbs:82,foods:'РћРІСЃСЏРЅРєР° РЅР° РјРѕР»РѕРєРµ 200Рі, 3 СЏР№С†Р° РІРєСЂСѓС‚СѓСЋ, Р±Р°РЅР°РЅ'},
        {name:'РЇРёС‡РЅРёС†Р° СЃ С…Р»РµР±РѕРј Рё РїРѕРјРёРґРѕСЂРѕРј',kcal:620,protein:38,fat:24,carbs:70,foods:'РЇРёС‡РЅРёС†Р° РёР· 4 СЏРёС†, С†РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 2 Р»РѕРјС‚СЏ, РїРѕРјРёРґРѕСЂ'},
        {name:'Р‘Р»РёРЅС‡РёРєРё СЃ С‚РІРѕСЂРѕРіРѕРј Рё РјС‘РґРѕРј',kcal:750,protein:40,fat:20,carbs:100,foods:'Р‘Р»РёРЅС‡РёРєРё 5С€С‚ РЅР° РјРѕР»РѕРєРµ, С‚РІРѕСЂРѕРі 5% 150Рі, РјС‘Рґ 1 СЃС‚.Р».'},
        {name:'Р“СЂРµС‡РЅРµРІР°СЏ РєР°С€Р° СЃ СЏР№С†Р°РјРё',kcal:660,protein:40,fat:20,carbs:80,foods:'Р“СЂРµС‡РєР° 200Рі, 3 СЏР№С†Р° РІР°СЂС‘РЅС‹С…, РјР°СЃР»Рѕ 10Рі'},
        {name:'РћРјР»РµС‚ СЃ РѕРІРѕС‰Р°РјРё Рё С…Р»РµР±РѕРј',kcal:600,protein:36,fat:22,carbs:68,foods:'РћРјР»РµС‚ РёР· 4 СЏРёС† СЃ РїРѕРјРёРґРѕСЂРѕРј Рё РїРµСЂС†РµРј, С†РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 2 Р»РѕРјС‚СЏ'},
        {name:'РћРІСЃСЏРЅРєР° СЃ Р±Р°РЅР°РЅРѕРј Рё РѕСЂРµС…Р°РјРё',kcal:700,protein:22,fat:25,carbs:95,foods:'РћРІСЃСЏРЅРєР° РЅР° РјРѕР»РѕРєРµ 200Рі, Р±Р°РЅР°РЅ 2С€С‚, РіСЂРµС†РєРёРµ РѕСЂРµС…Рё 30Рі'},
        {name:'Р РёСЃРѕРІР°СЏ РєР°С€Р° СЃ СЏР№С†Р°РјРё',kcal:720,protein:38,fat:18,carbs:100,foods:'Р РёСЃ 180Рі, 3 СЏР№С†Р°, РјРѕР»РѕРєРѕ 200РјР»'},
        {name:'РЎС‹СЂРЅРёРєРё СЃРѕ СЃРјРµС‚Р°РЅРѕР№',kcal:730,protein:45,fat:22,carbs:88,foods:'РЎС‹СЂРЅРёРєРё РёР· С‚РІРѕСЂРѕРіР° 4С€С‚, СЃРјРµС‚Р°РЅР° 20% 50Рі, Р±Р°РЅР°РЅ'},
        {name:'Р‘СѓС‚РµСЂР±СЂРѕРґС‹ СЃ СЏР№С†РѕРј Рё СЃС‹СЂРѕРј',kcal:650,protein:38,fat:28,carbs:60,foods:'Р¦РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 3 Р»РѕРјС‚СЏ, СЏР№С†Р° РІРєСЂСѓС‚СѓСЋ 3С€С‚, С‚РІС‘СЂРґС‹Р№ СЃС‹СЂ 50Рі'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІС‹Рµ РѕР»Р°РґСЊРё',kcal:680,protein:50,fat:15,carbs:85,foods:'РћР»Р°РґСЊРё РЅР° РєРµС„РёСЂРµ 5С€С‚, РїСЂРѕС‚РµРёРЅ 1 РјРµСЂРЅР°СЏ, Р±Р°РЅР°РЅ, РјС‘Рґ'},
        {name:'РўРІРѕСЂРѕРі СЃ РіСЂР°РЅРѕР»РѕР№ Рё СЏРіРѕРґР°РјРё',kcal:700,protein:42,fat:18,carbs:90,foods:'РўРІРѕСЂРѕРі 5% 300Рі, РіСЂР°РЅРѕР»Р° 80Рі, СЏРіРѕРґС‹, РјС‘Рґ'},
        {name:'РњР°РЅРЅР°СЏ РєР°С€Р° СЃ Р±Р°РЅР°РЅРѕРј',kcal:720,protein:28,fat:15,carbs:120,foods:'РњР°РЅРєР° 150Рі РЅР° РјРѕР»РѕРєРµ, Р±Р°РЅР°РЅ, РјР°СЃР»Рѕ 10Рі'},
        {name:'РЇР№С†Р° СЃ Р°РІРѕРєР°РґРѕ Рё С…Р»РµР±РѕРј',kcal:680,protein:34,fat:35,carbs:58,foods:'РЇР№С†Р° РїР°С€РѕС‚ 3С€С‚, Р°РІРѕРєР°РґРѕ С†РµР»С‹Р№, С†РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 2 Р»РѕРјС‚СЏ'},
        {name:'РљСѓРєСѓСЂСѓР·РЅР°СЏ РєР°С€Р° РЅР° РјРѕР»РѕРєРµ',kcal:660,protein:25,fat:15,carbs:105,foods:'РљСѓРєСѓСЂСѓР·РЅР°СЏ РєР°С€Р° 150Рі, РјРѕР»РѕРєРѕ 300РјР», РјР°СЃР»Рѕ 10Рі, РјС‘Рґ'},
        {name:'РћРІСЃСЏРЅРєР° СЃ Р°СЂР°С…РёСЃРѕРІРѕР№ РїР°СЃС‚РѕР№',kcal:780,protein:32,fat:30,carbs:95,foods:'РћРІСЃСЏРЅРєР° 180Рі, Р°СЂР°С…РёСЃРѕРІР°СЏ РїР°СЃС‚Р° 2 СЃС‚.Р»., Р±Р°РЅР°РЅ, РјРѕР»РѕРєРѕ'},
        {name:'РўРІРѕСЂРѕРі СЃ С„СЂСѓРєС‚Р°РјРё Рё РѕСЂРµС…Р°РјРё',kcal:650,protein:40,fat:20,carbs:75,foods:'РўРІРѕСЂРѕРі 5% 250Рі, Р±Р°РЅР°РЅ, РјРёРЅРґР°Р»СЊ 25Рі, РјС‘Рґ'},
        {name:'РџС€С‘РЅРЅР°СЏ РєР°С€Р° СЃ РјР°СЃР»РѕРј',kcal:650,protein:22,fat:18,carbs:98,foods:'РџС€РµРЅРѕ 180Рі РЅР° РјРѕР»РѕРєРµ, РјР°СЃР»Рѕ 15Рі, РјС‘Рґ'},
        {name:'РЇРёС‡РЅС‹Р№ СЃСЌРЅРґРІРёС‡ СЃ СЃС‹СЂРѕРј',kcal:700,protein:42,fat:28,carbs:68,foods:'Р¦РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 3 Р»РѕРјС‚СЏ, СЏРёС‡РЅРёС†Р° РёР· 3 СЏРёС†, СЃС‹СЂ 40Рі, РїРѕРјРёРґРѕСЂ'},
        {name:'РњСЋСЃР»Рё СЃ РјРѕР»РѕРєРѕРј Рё С„СЂСѓРєС‚Р°РјРё',kcal:720,protein:24,fat:18,carbs:108,foods:'РњСЋСЃР»Рё Р±РµР· СЃР°С…Р°СЂР° 120Рі, РјРѕР»РѕРєРѕ 3.2% 300РјР», Р±Р°РЅР°РЅ, СЏРіРѕРґС‹'},
        {name:'Р“РµСЂРєСѓР»РµСЃ СЃ РѕСЂРµС…Р°РјРё Рё РјС‘РґРѕРј',kcal:760,protein:26,fat:28,carbs:102,foods:'Р“РµСЂРєСѓР»РµСЃ 200Рі РЅР° РјРѕР»РѕРєРµ, РіСЂРµС†РєРёРµ РѕСЂРµС…Рё 30Рі, РјС‘Рґ 2 СЃС‚.Р».'},
        {name:'Р РёСЃРѕРІР°СЏ РєР°С€Р° СЃ РґРІСѓРјСЏ Р±Р°РЅР°РЅР°РјРё',kcal:700,protein:20,fat:12,carbs:128,foods:'Р РёСЃ 200Рі РЅР° РјРѕР»РѕРєРµ, Р±Р°РЅР°РЅ 2С€С‚, РјР°СЃР»Рѕ 10Рі'},
        {name:'РћРјР»РµС‚ СЃ СЃС‹СЂРѕРј Рё РІРµС‚С‡РёРЅРѕР№',kcal:650,protein:44,fat:30,carbs:52,foods:'РћРјР»РµС‚ 4 СЏР№С†Р°, СЃС‹СЂ 50Рі, РІРµС‚С‡РёРЅР° 80Рі, С…Р»РµР± 1 Р»РѕРјРѕС‚СЊ'},
        {name:'Р“СЂРµС‡РЅРµРІС‹Рµ РѕР»Р°РґСЊРё СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:680,protein:30,fat:18,carbs:95,foods:'РћР»Р°РґСЊРё РёР· РіСЂРµС‡РєРё 5С€С‚, С‚РІРѕСЂРѕРі 150Рі, СЃРјРµС‚Р°РЅР°'},
        {name:'РЇС‡РЅРµРІР°СЏ РєР°С€Р° СЃ СЏР№С†Р°РјРё',kcal:660,protein:36,fat:18,carbs:88,foods:'РЇС‡РєР° 180Рі РЅР° РјРѕР»РѕРєРµ, 3 СЏР№С†Р° РІР°СЂС‘РЅС‹С…, РјР°СЃР»Рѕ'},
        {name:'РЎРјСѓР·Рё СЃ СЃСЌРЅРґРІРёС‡РµРј',kcal:720,protein:38,fat:20,carbs:92,foods:'РЎРјСѓР·Рё РёР· Р±Р°РЅР°РЅР° Рё РјРѕР»РѕРєР° 300РјР», С…Р»РµР± СЃ СЏР№С†РѕРј Рё СЃС‹СЂРѕРј'},
        {name:'РўРІРѕСЂРѕР¶РЅР°СЏ Р·Р°РїРµРєР°РЅРєР°',kcal:750,protein:50,fat:20,carbs:88,foods:'Р—Р°РїРµРєР°РЅРєР° РёР· С‚РІРѕСЂРѕРіР° 300Рі, СЃРјРµС‚Р°РЅР° 50Рі, Р±Р°РЅР°РЅ'},
        {name:'Р‘СѓСЂС‹Р№ СЂРёСЃ СЃ СЏР№С†Р°РјРё',kcal:680,protein:36,fat:18,carbs:90,foods:'Р‘СѓСЂС‹Р№ СЂРёСЃ 180Рі, 3 СЏР№С†Р°, РјР°СЃР»Рѕ 10Рі'},
        {name:'РџРµСЂР»РѕРІР°СЏ РєР°С€Р° СЃ СЏР№С†РѕРј',kcal:620,protein:22,fat:15,carbs:98,foods:'РџРµСЂР»РѕРІРєР° 200Рі, РјР°СЃР»Рѕ 15Рі, СЏР№С†Рѕ РІР°СЂС‘РЅРѕРµ'},
        {name:'РЇР№С†Р° СЃ Р±РµРєРѕРЅРѕРј Рё С…Р»РµР±РѕРј',kcal:780,protein:44,fat:40,carbs:56,foods:'РЇРёС‡РЅРёС†Р° 3 СЏР№С†Р°, Р±РµРєРѕРЅ 80Рі, С†РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 2 Р»РѕРјС‚СЏ'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ СЃ РіСЂР°РЅРѕР»РѕР№ Рё РѕСЂРµС…Р°РјРё',kcal:710,protein:32,fat:22,carbs:96,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 5% 300Рі, РіСЂР°РЅРѕР»Р° 80Рі, РіСЂРµС†РєРёРµ РѕСЂРµС…Рё 25Рі, РјС‘Рґ'},
        {name:'РўРѕСЃС‚С‹ СЃ Р°СЂР°С…РёСЃРѕРІРѕР№ РїР°СЃС‚РѕР№ Рё Р±Р°РЅР°РЅРѕРј',kcal:720,protein:24,fat:28,carbs:95,foods:'Р‘РµР»С‹Р№ С…Р»РµР± 3 Р»РѕРјС‚СЏ, Р°СЂР°С…РёСЃРѕРІР°СЏ РїР°СЃС‚Р° 50Рі, Р±Р°РЅР°РЅ 2С€С‚'},
        {name:'РЇРёС‡РЅР°СЏ Р·Р°РїРµРєР°РЅРєР° СЃ СЃС‹СЂРѕРј',kcal:650,protein:40,fat:28,carbs:58,foods:'5 СЏРёС†, СЃС‹СЂ 60Рі, РїРѕРјРёРґРѕСЂ, Р·Р°РїРµС‡СЊ РІ РґСѓС…РѕРІРєРµ'},
        {name:'РџС€С‘РЅРЅР°СЏ РєР°С€Р° СЃ С‚С‹РєРІРѕР№',kcal:640,protein:18,fat:16,carbs:98,foods:'РџС€РµРЅРѕ 150Рі, С‚С‹РєРІР° 100Рі, РјРѕР»РѕРєРѕ, РјР°СЃР»Рѕ'},
        {name:'РҐР»РѕРїСЊСЏ СЃ РјРѕР»РѕРєРѕРј Рё РѕСЂРµС…Р°РјРё',kcal:680,protein:22,fat:24,carbs:90,foods:'РљСѓРєСѓСЂСѓР·РЅС‹Рµ С…Р»РѕРїСЊСЏ 100Рі, РјРѕР»РѕРєРѕ 3.2% 300РјР», РѕСЂРµС…Рё 30Рі, Р±Р°РЅР°РЅ'},
        {name:'Р¤СЂР°РЅС†СѓР·СЃРєРёРµ С‚РѕСЃС‚С‹ СЃ РјС‘РґРѕРј',kcal:750,protein:32,fat:26,carbs:98,foods:'РҐР»РµР± РІ СЏР№С†Рµ Р¶Р°СЂРµРЅС‹Р№ 3 Р»РѕРјС‚СЏ, РјС‘Рґ, Р±Р°РЅР°РЅ'},
        {name:'РћРјР»РµС‚ СЃ РєСѓСЂРёРЅРѕР№ РіСЂСѓРґРєРѕР№',kcal:680,protein:52,fat:24,carbs:52,foods:'РћРјР»РµС‚ 4 СЏР№С†Р°, РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 150Рі, РїРµСЂРµС†'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІС‹Рµ Р±Р»РёРЅС‡РёРєРё',kcal:680,protein:48,fat:16,carbs:80,foods:'Р‘Р»РёРЅС‡РёРєРё СЃ РїСЂРѕС‚РµРёРЅРѕРј 4С€С‚, С‚РІРѕСЂРѕРі, Р±Р°РЅР°РЅ'},
        {name:'РЎРјСѓР·Рё-Р±РѕСѓР»',kcal:720,protein:28,fat:20,carbs:100,foods:'РЎРјСѓР·Рё РёР· Р±Р°РЅР°РЅР° 200РјР», РіСЂР°РЅРѕР»Р° 80Рі, РѕСЂРµС…Рё 20Рі'},
        {name:'РўРѕСЃС‚ СЃ СЏР№С†РѕРј Рё Р°РІРѕРєР°РґРѕ',kcal:680,protein:30,fat:32,carbs:72,foods:'РҐР»РµР± 2 Р»РѕРјС‚СЏ, СЏР№С†Р° РїР°С€РѕС‚ 2С€С‚, Р°РІРѕРєР°РґРѕ'},
        {name:'Р‘СѓС‚РµСЂР±СЂРѕРґС‹ СЃ Р»РѕСЃРѕСЃРµРј',kcal:720,protein:38,fat:34,carbs:62,foods:'РҐР»РµР± 3 Р»РѕРјС‚СЏ, СЃР»Р°Р±РѕСЃРѕР»С‘РЅС‹Р№ Р»РѕСЃРѕСЃСЊ 120Рі, РѕРіСѓСЂРµС†'},
        {name:'РЇРёС‡РЅС‹Р№ СЂСѓР»РµС‚ СЃ СЃС‹СЂРѕРј',kcal:640,protein:42,fat:28,carbs:52,foods:'РЇРёС‡РЅС‹Р№ СЂСѓР»РµС‚ 5 СЏРёС†, СЃС‹СЂ 60Рі, Р·РµР»РµРЅСЊ'},
        {name:'РљР°С€Р° 4 Р·РµСЂРЅР° СЃ РѕСЂРµС…Р°РјРё',kcal:700,protein:24,fat:22,carbs:98,foods:'РњРЅРѕРіРѕР·РµСЂРЅРѕРІР°СЏ РєР°С€Р° 180Рі, РѕСЂРµС…Рё 30Рі, РјС‘Рґ, РјРѕР»РѕРєРѕ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РѕРІСЃСЏРЅРєР°',kcal:720,protein:26,fat:22,carbs:100,foods:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РѕРІСЃСЏРЅРєР° 200Рі, Р±Р°РЅР°РЅ, СЏР№С†Рѕ, РѕСЂРµС…Рё'},
        {name:'РўС‹РєРІРµРЅРЅР°СЏ РєР°С€Р° СЃ РјС‘РґРѕРј',kcal:650,protein:20,fat:16,carbs:98,foods:'РўС‹РєРІР° 200Рі СЃ РјРѕР»РѕРєРѕРј, СЂРёСЃ 80Рі, РјР°СЃР»Рѕ, РјС‘Рґ'},
        {name:'РўРІРѕСЂРѕР¶РЅС‹Р№ РїСѓРґРёРЅРі',kcal:680,protein:44,fat:16,carbs:84,foods:'РўРІРѕСЂРѕРі 9% 250Рі, РјР°РЅРєР° 50Рі, СЏР№С†Рѕ, СЏРіРѕРґС‹, Р·Р°РїРµС‡СЊ'},
        {name:'Р“СЂРµС‡РєР° СЃ РјРѕР»РѕРєРѕРј Рё Р±Р°РЅР°РЅРѕРј',kcal:660,protein:26,fat:12,carbs:108,foods:'Р“СЂРµС‡РєР° 150Рі РЅР° РјРѕР»РѕРєРµ, Р±Р°РЅР°РЅ, РјС‘Рґ'},
        {name:'РЇС‡РЅРµРІР°СЏ РєР°С€Р° СЃ РјС‘РґРѕРј',kcal:660,protein:24,fat:16,carbs:100,foods:'РЇС‡РєР° 180Рі РЅР° РјРѕР»РѕРєРµ, РјС‘Рґ 2 СЃС‚.Р»., РјР°СЃР»Рѕ'},
        {name:'РўРѕСЃС‚ СЃ РІРµС‚С‡РёРЅРѕР№ Рё СЏР№С†РѕРј',kcal:680,protein:40,fat:26,carbs:72,foods:'РҐР»РµР± 2 Р»РѕРјС‚СЏ, СЏРёС‡РЅРёС†Р° 3 СЏР№С†Р°, РІРµС‚С‡РёРЅР° 100Рі'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІС‹Р№ СЃРјСѓР·Рё СЃ РѕСЂРµС…Р°РјРё',kcal:720,protein:44,fat:22,carbs:80,foods:'РџСЂРѕС‚РµРёРЅ 2 РјРµСЂРЅС‹С…, РјРѕР»РѕРєРѕ 300РјР», Р°СЂР°С…РёСЃРѕРІР°СЏ РїР°СЃС‚Р°, Р±Р°РЅР°РЅ'},
        {name:'РЇР№С†Р° РІ РєРѕРєРѕС‚Рµ',kcal:620,protein:36,fat:30,carbs:52,foods:'РЇР№С†Р° Р·Р°РїРµС‡С‘РЅРЅС‹Рµ 4С€С‚, СЃР»РёРІРєРё, СЃС‹СЂ, Р·РµР»РµРЅСЊ'},
        {name:'РљРѕРєРѕСЃРѕРІС‹Рµ РѕР»Р°РґСЊРё',kcal:700,protein:24,fat:28,carbs:90,foods:'РћР»Р°РґСЊРё СЃ РєРѕРєРѕСЃРѕРІРѕР№ СЃС‚СЂСѓР¶РєРѕР№ 5С€С‚, РјС‘Рґ, Р±Р°РЅР°РЅ'},
        {name:'Р¤Р°СЂС€РёСЂРѕРІР°РЅРЅС‹Рµ Р±Р»РёРЅС‡РёРєРё СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:750,protein:38,fat:22,carbs:100,foods:'Р‘Р»РёРЅС‡РёРєРё 4С€С‚, С‚РІРѕСЂРѕРі 200Рі, РјС‘Рґ'},
        {name:'РЇРёС‡РЅРёС†Р° СЃ Р»РѕСЃРѕСЃРµРј',kcal:700,protein:48,fat:34,carbs:48,foods:'РЇРёС‡РЅРёС†Р° 4 СЏР№С†Р°, Р»РѕСЃРѕСЃСЊ 120Рі, С…Р»РµР± 1 Р»РѕРјРѕС‚СЊ'},
        {name:'РњРѕР»РѕС‡РЅС‹Р№ СЃСѓРї СЃ РІРµСЂРјРёС€РµР»СЊСЋ',kcal:620,protein:24,fat:14,carbs:95,foods:'РњРѕР»РѕРєРѕ 400РјР», РІРµСЂРјРёС€РµР»СЊ 100Рі, РјР°СЃР»Рѕ'},
        {name:'РњР°РЅРЅС‹Рµ РѕР»Р°РґСЊРё',kcal:680,protein:26,fat:18,carbs:98,foods:'РћР»Р°РґСЊРё РёР· РјР°РЅРєРё 6С€С‚ РЅР° РєРµС„РёСЂРµ, РјС‘Рґ, СЏРіРѕРґС‹'},
        {name:'РћРјР»РµС‚ СЃ РіСЂРёР±Р°РјРё',kcal:620,protein:36,fat:26,carbs:58,foods:'РћРјР»РµС‚ 4 СЏР№С†Р°, С€Р°РјРїРёРЅСЊРѕРЅС‹ 150Рі, СЃС‹СЂ 40Рі, С…Р»РµР±'},
        {name:'Р РёСЃРѕРІР°СЏ РєР°С€Р° СЃ РјР°СЃР»РѕРј',kcal:720,protein:22,fat:18,carbs:112,foods:'Р РёСЃ 200Рі РЅР° РјРѕР»РѕРєРµ, РјР°СЃР»Рѕ 15Рі, Р±Р°РЅР°РЅ'},
        {name:'РњРѕР»РѕС‡РЅР°СЏ РїС€С‘РЅРЅР°СЏ РєР°С€Р° СЃ СЏРіРѕРґР°РјРё',kcal:660,protein:20,fat:14,carbs:105,foods:'РџС€РµРЅРѕ 160Рі РЅР° РјРѕР»РѕРєРµ, СЏРіРѕРґС‹ 80Рі, РјС‘Рґ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Рµ СЏР±Р»РѕРєРё СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:640,protein:32,fat:14,carbs:88,foods:'РЇР±Р»РѕРєРё 2С€С‚ СЃ С‚РІРѕСЂРѕРіРѕРј 9% 200Рі, РјС‘Рґ, РѕСЂРµС…Рё'}
      ],
      'РћР±РµРґ': [
        {name:'Р РёСЃ СЃ РєСѓСЂРёРЅРѕР№ РіСЂСѓРґРєРѕР№',kcal:850,protein:65,fat:15,carbs:118,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 300Рі, СЂРёСЃ 250Рі, СЃРІРµР¶РёР№ РѕРіСѓСЂРµС†, РїРѕРјРёРґРѕСЂ'},
        {name:'Р“СЂРµС‡РєР° СЃ РіРѕРІСЏРґРёРЅРѕР№ С‚СѓС€С‘РЅРѕР№',kcal:900,protein:70,fat:28,carbs:92,foods:'Р“РѕРІСЏРґРёРЅР° С‚СѓС€С‘РЅР°СЏ 300Рі, РіСЂРµС‡РєР° 220Рі, С‚СѓС€С‘РЅС‹Рµ РѕРІРѕС‰Рё'},
        {name:'РџР°СЃС‚Р° СЃ РіРѕРІСЏР¶СЊРёРј С„Р°СЂС€РµРј',kcal:950,protein:60,fat:32,carbs:120,foods:'РџР°СЃС‚Р° 280Рі, РіРѕРІСЏР¶РёР№ С„Р°СЂС€ 250Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ, СЃС‹СЂ 30Рі'},
        {name:'Р‘РѕСЂС‰ СЃРѕ СЃРІРёРЅРёРЅРѕР№ Рё С…Р»РµР±РѕРј',kcal:880,protein:55,fat:28,carbs:105,foods:'Р‘РѕСЂС‰ 500РјР» СЃРѕ СЃРІРёРЅРёРЅРѕР№, С…Р»РµР± 2 Р»РѕРјС‚СЏ, СЃРјРµС‚Р°РЅР° 30Рі'},
        {name:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї СЃ РіСЂРµС‡РєРѕР№',kcal:820,protein:60,fat:20,carbs:98,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР», РіСЂРµС‡РєР° 200Рі, РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі'},
        {name:'РџР»РѕРІ СЃ Р±Р°СЂР°РЅРёРЅРѕР№',kcal:980,protein:58,fat:35,carbs:115,foods:'РџР»РѕРІ 400Рі СЃ Р±Р°СЂР°РЅРёРЅРѕР№ 200Рі'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ СЃ Р·Р°РїРµС‡С‘РЅРЅС‹Рј РєР°СЂС‚РѕС„РµР»РµРј',kcal:900,protein:58,fat:30,carbs:105,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ Р±РµР· РєРѕР¶Рё 300Рі, Р·Р°РїРµС‡С‘РЅРЅС‹Р№ РєР°СЂС‚РѕС„РµР»СЊ 300Рі, СЃР°Р»Р°С‚'},
        {name:'РЁР°С€Р»С‹Рє РёР· РєСѓСЂРёС†С‹ СЃ СЂРёСЃРѕРј',kcal:900,protein:68,fat:22,carbs:108,foods:'РљСѓСЂРёРЅС‹Рµ Р±С‘РґСЂР° РЅР° РіСЂРёР»Рµ 350Рі, СЂРёСЃ 200Рі, СЃРІРµР¶РёРµ РѕРІРѕС‰Рё'},
        {name:'РљРѕС‚Р»РµС‚С‹ СЃ РєР°СЂС‚РѕС„РµР»СЊРЅС‹Рј РїСЋСЂРµ',kcal:950,protein:62,fat:38,carbs:95,foods:'РљРѕС‚Р»РµС‚С‹ РёР· РіРѕРІСЏРґРёРЅС‹ 3С€С‚, РїСЋСЂРµ 250Рі, РѕРіСѓСЂРµС†'},
        {name:'РўСѓС€С‘РЅР°СЏ СЃРІРёРЅРёРЅР° СЃ РіСЂРµС‡РєРѕР№',kcal:980,protein:62,fat:42,carbs:88,foods:'РЎРІРёРЅРёРЅР° С‚СѓС€С‘РЅР°СЏ 280Рі, РіСЂРµС‡РєР° 220Рі, РєР°РїСѓСЃС‚РЅС‹Р№ СЃР°Р»Р°С‚'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Р№ Р»РѕСЃРѕСЃСЊ СЃ СЂРёСЃРѕРј',kcal:880,protein:72,fat:30,carbs:85,foods:'Р›РѕСЃРѕСЃСЊ 300Рі, СЂРёСЃ 200Рі, Р»РёРјРѕРЅ, СѓРєСЂРѕРї'},
        {name:'РџРµР»СЊРјРµРЅРё СЃРѕ СЃРјРµС‚Р°РЅРѕР№',kcal:900,protein:50,fat:32,carbs:108,foods:'РџРµР»СЊРјРµРЅРё 350Рі, СЃРјРµС‚Р°РЅР° 20% 60Рі'},
        {name:'Р“РѕРІСЏР¶РёР№ СЃС‚РµР№Рє СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:980,protein:75,fat:40,carbs:80,foods:'Р“РѕРІСЏР¶РёР№ СЃС‚РµР№Рє 350Рі, РєР°СЂС‚РѕС„РµР»СЊ Р·Р°РїРµС‡С‘РЅРЅС‹Р№ 300Рі, РїРѕРјРёРґРѕСЂ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РїР°СЃС‚РѕР№',kcal:880,protein:68,fat:16,carbs:118,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 280Рі, РїР°СЃС‚Р° 250Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ'},
        {name:'Р©Рё СЃРѕ СЃРІРёРЅРёРЅРѕР№ Рё С…Р»РµР±РѕРј',kcal:840,protein:52,fat:25,carbs:105,foods:'Р©Рё СЃРѕ СЃРІРёРЅРёРЅРѕР№ 500РјР», С…Р»РµР± 2 Р»РѕРјС‚СЏ, СЃРјРµС‚Р°РЅР°'},
        {name:'РўСѓРЅРµС† СЃ СЂРёСЃРѕРј',kcal:820,protein:68,fat:12,carbs:108,foods:'РўСѓРЅРµС† РІ РјР°СЃР»Рµ 280Рі, СЂРёСЃ 220Рі, РѕРіСѓСЂРµС†'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РєСѓСЂРёС†Р° СЃ РєР°СЂС‚РѕС€РєРѕР№',kcal:920,protein:62,fat:32,carbs:105,foods:'РљСѓСЂРёРЅС‹Рµ Р±С‘РґСЂР° 350Рі РІ РґСѓС…РѕРІРєРµ, РєР°СЂС‚РѕС„РµР»СЊ 300Рі, СЃРїРµС†РёРё'},
        {name:'Р“РѕР»СѓР±С†С‹ СЃРѕ СЃРјРµС‚Р°РЅРѕР№',kcal:850,protein:52,fat:30,carbs:98,foods:'Р“РѕР»СѓР±С†С‹ 5С€С‚ СЃ РіРѕРІСЏР¶СЊРёРј С„Р°СЂС€РµРј, СЃРјРµС‚Р°РЅР° 60Рі'},
        {name:'Р‘РёРіСѓСЃ СЃ РјСЏСЃРѕРј',kcal:870,protein:58,fat:32,carbs:95,foods:'РўСѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° 350Рі, СЃРІРёРЅРёРЅР° 250Рі, С…Р»РµР± 1 Р»РѕРјРѕС‚СЊ'},
        {name:'Р С‹Р±РЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ СЂРёСЃРѕРј',kcal:830,protein:65,fat:22,carbs:98,foods:'Р С‹Р±РЅС‹Рµ РєРѕС‚Р»РµС‚С‹ 4С€С‚, СЂРёСЃ 200Рі, РѕРіСѓСЂРµС†'},
        {name:'Р“СЂРµС‡РєР° СЃ РєСѓСЂРёРЅС‹РјРё Р±С‘РґСЂР°РјРё',kcal:870,protein:62,fat:28,carbs:92,foods:'РљСѓСЂРёРЅС‹Рµ Р±С‘РґСЂР° 300Рі, РіСЂРµС‡РєР° 220Рі, С‚СѓС€С‘РЅР°СЏ РјРѕСЂРєРѕРІСЊ'},
        {name:'Р“РѕРІСЏР¶РёР№ СЃСѓРї СЃ С…Р»РµР±РѕРј',kcal:820,protein:55,fat:25,carbs:98,foods:'Р“РѕРІСЏР¶РёР№ СЃСѓРї 500РјР», С…Р»РµР± 2 Р»РѕРјС‚СЏ'},
        {name:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:840,protein:62,fat:18,carbs:108,foods:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ 280Рі, РїРµСЂР»РѕРІРєР° 220Рі, С‚СѓС€С‘РЅС‹Рµ РѕРІРѕС‰Рё'},
        {name:'РњР°РєР°СЂРѕРЅС‹ РїРѕ-С„Р»РѕС‚СЃРєРё',kcal:920,protein:55,fat:30,carbs:118,foods:'РњР°РєР°СЂРѕРЅС‹ 280Рі, РіРѕРІСЏР¶РёР№ С„Р°СЂС€ 250Рі, Р»СѓРє'},
        {name:'Р–Р°СЂРєРѕРµ РёР· СЃРІРёРЅРёРЅС‹ РІ РіРѕСЂС€РѕС‡РєРµ',kcal:960,protein:60,fat:42,carbs:85,foods:'РЎРІРёРЅРёРЅР° СЃ РєР°СЂС‚РѕС„РµР»РµРј РІ РіРѕСЂС€РѕС‡РєРµ 450Рі'},
        {name:'РљСѓСЂРёРЅС‹Р№ С€Р°С€Р»С‹Рє СЃ РіСЂРµС‡РєРѕР№',kcal:880,protein:70,fat:20,carbs:98,foods:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ РЅР° РіСЂРёР»Рµ 320Рі, РіСЂРµС‡РєР° 200Рі, РїРѕРјРёРґРѕСЂ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ СЂС‹Р±Р° СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:840,protein:62,fat:20,carbs:108,foods:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ С‚СЂРµСЃРєР° 300Рі, РєР°СЂС‚РѕС„РµР»СЊ 300Рі, Р»РёРјРѕРЅ'},
        {name:'РЎСѓРї С…Р°СЂС‡Рѕ СЃ С…Р»РµР±РѕРј',kcal:860,protein:50,fat:28,carbs:105,foods:'РҐР°СЂС‡Рѕ СЃ РіРѕРІСЏРґРёРЅРѕР№ 500РјР», СЂРёСЃ 100Рі, С…Р»РµР± 1 Р»РѕРјРѕС‚СЊ'},
        {name:'Р“СѓР»СЏС€ СЃ РєР°СЂС‚РѕС„РµР»СЊРЅС‹Рј РїСЋСЂРµ',kcal:940,protein:62,fat:35,carbs:100,foods:'Р“СѓР»СЏС€ РёР· РіРѕРІСЏРґРёРЅС‹ 300Рі, РєР°СЂС‚РѕС„РµР»СЊРЅРѕРµ РїСЋСЂРµ 280Рі'},
        {name:'Р РёСЃРѕРІС‹Р№ СЃСѓРї СЃ РєСѓСЂРёС†РµР№',kcal:820,protein:55,fat:18,carbs:108,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї СЃ СЂРёСЃРѕРј 500РјР», РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, С…Р»РµР±'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅРѕРµ РјСЏСЃРѕ СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:950,protein:65,fat:40,carbs:85,foods:'РЎРІРёРЅРёРЅР° Р·Р°РїРµС‡С‘РЅРЅР°СЏ 300Рі, РєР°СЂС‚РѕС„РµР»СЊ 300Рі, С‡РµСЃРЅРѕРє'},
        {name:'РљСѓСЂРёРЅС‹Р№ РїР»РѕРІ',kcal:900,protein:62,fat:28,carbs:105,foods:'РџР»РѕРІ СЃ РєСѓСЂРёРЅРѕР№ РіСЂСѓРґРєРѕР№ 300Рі, СЂРёСЃ 250Рі, РјРѕСЂРєРѕРІСЊ'},
        {name:'РЎСѓРї СЃРѕР»СЏРЅРєР° СЃ С…Р»РµР±РѕРј',kcal:880,protein:52,fat:35,carbs:98,foods:'РЎРѕР»СЏРЅРєР° РјСЏСЃРЅР°СЏ 500РјР», С…Р»РµР± 2 Р»РѕРјС‚СЏ, СЃРјРµС‚Р°РЅР°'},
        {name:'РЎРІРёРЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ РіСЂРµС‡РєРѕР№',kcal:980,protein:62,fat:45,carbs:88,foods:'РљРѕС‚Р»РµС‚С‹ СЃРІРёРЅС‹Рµ 3С€С‚, РіСЂРµС‡РєР° 220Рі'},
        {name:'РљСѓСЂРёРЅС‹Рµ РЅРѕР¶РєРё СЃ СЂРёСЃРѕРј',kcal:920,protein:65,fat:30,carbs:105,foods:'РљСѓСЂРёРЅС‹Рµ РЅРѕР¶РєРё 400Рі, СЂРёСЃ 220Рі, РїРѕРјРёРґРѕСЂ'},
        {name:'Р›Р°РіРјР°РЅ СЃ РіРѕРІСЏРґРёРЅРѕР№',kcal:920,protein:55,fat:35,carbs:110,foods:'Р“РѕРІСЏРґРёРЅР° 250Рі, Р»Р°РїС€Р° 200Рі, РїРµСЂРµС†, РјРѕСЂРєРѕРІСЊ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РёРЅРґРµР№РєР° СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:880,protein:72,fat:22,carbs:100,foods:'РРЅРґРµР№РєР° 300Рі, РєР°СЂС‚РѕС„РµР»СЊ 300Рі'},
        {name:'Р Р°РіСѓ РёР· РіРѕРІСЏРґРёРЅС‹',kcal:900,protein:65,fat:32,carbs:98,foods:'Р“РѕРІСЏРґРёРЅР° С‚СѓС€С‘РЅР°СЏ 280Рі, РєР°СЂС‚РѕС„РµР»СЊ, РјРѕСЂРєРѕРІСЊ, Р»СѓРє'},
        {name:'Р–Р°СЂРєРѕРµ РёР· РєСѓСЂРёС†С‹',kcal:880,protein:65,fat:28,carbs:98,foods:'РљСѓСЂРёРЅС‹Рµ Р±С‘РґСЂР° 350Рі, РєР°СЂС‚РѕС„РµР»СЊ, РїРµСЂРµС† РІ С‚РѕРјР°С‚Рµ'},
        {name:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї-Р»Р°РїС€Р°',kcal:820,protein:58,fat:18,carbs:100,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 500РјР», Р»Р°РїС€Р° 80Рі, РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ Р±Р°СЂР°РЅРёРЅР° СЃ СЂРёСЃРѕРј',kcal:980,protein:65,fat:42,carbs:92,foods:'Р‘Р°СЂР°РЅРёРЅР° 280Рі, СЂРёСЃ 220Рі, СЃРїРµС†РёРё'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ СЃСѓРї СЃ РєСѓСЂРёС†РµР№',kcal:840,protein:62,fat:22,carbs:100,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї СЃ СЂРёСЃРѕРј 500РјР», РіСЂСѓРґРєР° 200Рі, Р»РёРјРѕРЅ'},
        {name:'Р‘РёС‚РѕС‡РєРё СЃ РєР°СЂС‚РѕС„РµР»СЊРЅС‹Рј РїСЋСЂРµ',kcal:920,protein:60,fat:38,carbs:98,foods:'Р“РѕРІСЏР¶СЊРё Р±РёС‚РѕС‡РєРё 3С€С‚, РєР°СЂС‚РѕС„РµР»СЊРЅРѕРµ РїСЋСЂРµ 280Рі'},
        {name:'РўРµС„С‚РµР»Рё РІ С‚РѕРјР°С‚Рµ СЃ СЂРёСЃРѕРј',kcal:880,protein:62,fat:28,carbs:105,foods:'Р“РѕРІСЏР¶СЊРё С‚РµС„С‚РµР»Рё 4С€С‚, СЂРёСЃ 220Рі'},
        {name:'РЎРІРёРЅРёРЅР° СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:960,protein:62,fat:42,carbs:92,foods:'РЎРІРёРЅРёРЅР° С‚СѓС€С‘РЅР°СЏ 280Рі, РїРµСЂР»РѕРІРєР° 220Рі'},
        {name:'Р С‹Р±Р° СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:840,protein:65,fat:20,carbs:100,foods:'Р›РѕСЃРѕСЃСЊ 280Рі, РїРµСЂР»РѕРІРєР° 220Рі, С‚СѓС€С‘РЅС‹Рµ РѕРІРѕС‰Рё'},
        {name:'Р‘Р°СЂР°РЅРёРЅР° СЃ РіСЂРµС‡РєРѕР№',kcal:960,protein:65,fat:42,carbs:88,foods:'Р‘Р°СЂР°РЅРёРЅР° С‚СѓС€С‘РЅР°СЏ 250Рі, РіСЂРµС‡РєР° 220Рі'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С„Р°СЃРѕР»СЊСЋ',kcal:900,protein:68,fat:28,carbs:92,foods:'Р“РѕРІСЏРґРёРЅР° 280Рі, С„Р°СЃРѕР»СЊ 150Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ'},
        {name:'РљСѓСЂРёРЅС‹Рµ РєСЂС‹Р»С‹С€РєРё СЃ СЂРёСЃРѕРј',kcal:900,protein:65,fat:32,carbs:98,foods:'РљСѓСЂРёРЅС‹Рµ РєСЂС‹Р»С‹С€РєРё Р·Р°РїРµС‡С‘РЅРЅС‹Рµ 400Рі, СЂРёСЃ 200Рі'},
        {name:'Р›РѕСЃРѕСЃСЊ РІ РґСѓС…РѕРІРєРµ СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:900,protein:72,fat:32,carbs:88,foods:'Р›РѕСЃРѕСЃСЊ 300Рі, РєР°СЂС‚РѕС„РµР»СЊ 280Рі, Р»РёРјРѕРЅ'},
        {name:'Р РѕСЃС‚Р±РёС„ СЃ РєР°СЂС‚РѕС„РµР»СЊРЅС‹Рј РїСЋСЂРµ',kcal:980,protein:72,fat:42,carbs:88,foods:'Р“РѕРІСЏР¶РёР№ СЂРѕСЃС‚Р±РёС„ 300Рі, РїСЋСЂРµ 280Рі'},
        {name:'РџР°СЃС‚Р° СЃ Р»РѕСЃРѕСЃРµРј РІ СЃР»РёРІРєР°С…',kcal:920,protein:65,fat:30,carbs:108,foods:'РџР°СЃС‚Р° 250Рі, Р»РѕСЃРѕСЃСЊ 200Рі, СЃР»РёРІРєРё 100РјР»'},
        {name:'РљСѓСЂРёС†Р° РІ СЃРјРµС‚Р°РЅРµ СЃ СЂРёСЃРѕРј',kcal:900,protein:65,fat:30,carbs:98,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 300Рі РІ СЃРјРµС‚Р°РЅРµ 80Рі, СЂРёСЃ 220Рі'},
        {name:'РЎРІРёРЅР°СЏ РіСЂСѓРґРёРЅРєР° СЃ С‚СѓС€С‘РЅРѕР№ РєР°РїСѓСЃС‚РѕР№',kcal:980,protein:58,fat:55,carbs:72,foods:'РЎРІРёРЅР°СЏ РіСЂСѓРґРёРЅРєР° 250Рі, РєР°РїСѓСЃС‚Р° 300Рі'},
        {name:'Р“РѕРІСЏР¶РёР№ СЃСѓРї СЃ РјР°РєР°СЂРѕРЅР°РјРё',kcal:860,protein:55,fat:26,carbs:102,foods:'Р“РѕРІСЏР¶РёР№ СЃСѓРї 500РјР», РјР°РєР°СЂРѕРЅС‹ 80Рі, РіРѕРІСЏРґРёРЅР° 180Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ С„РѕСЂРµР»СЊ СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:880,protein:70,fat:28,carbs:90,foods:'Р¤РѕСЂРµР»СЊ 300Рі, РєР°СЂС‚РѕС„РµР»СЊ 280Рі, Р»РёРјРѕРЅ, Р·РµР»РµРЅСЊ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° РІ РєР»СЏСЂРµ СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:920,protein:65,fat:35,carbs:100,foods:'Р“СЂСѓРґРєР° РІ РєР»СЏСЂРµ 300Рі, РєР°СЂС‚РѕС„РµР»СЊ 250Рі'},
        {name:'РЈС…Р° СЃ С…Р»РµР±РѕРј',kcal:820,protein:58,fat:18,carbs:100,foods:'РЈС…Р° РёР· Р»РѕСЃРѕСЃСЏ 500РјР», С…Р»РµР± 2 Р»РѕРјС‚СЏ'},
        {name:'РЎСѓРї-РїСЋСЂРµ РёР· С‚С‹РєРІС‹ СЃ РєСѓСЂРёС†РµР№',kcal:820,protein:48,fat:30,carbs:98,foods:'РўС‹РєРІРµРЅРЅС‹Р№ СЃСѓРї 500РјР», РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 150Рі, С…Р»РµР± 2 Р»РѕРјС‚СЏ'}
      ],
      'РЈР¶РёРЅ': [
        {name:'Р›РѕСЃРѕСЃСЊ СЃ СЂРёСЃРѕРј Рё Р±СЂРѕРєРєРѕР»Рё',kcal:720,protein:62,fat:22,carbs:72,foods:'Р›РѕСЃРѕСЃСЊ Р·Р°РїРµС‡С‘РЅРЅС‹Р№ 250Рі, СЂРёСЃ 180Рі, Р»РёРјРѕРЅ, Р±СЂРѕРєРєРѕР»Рё'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РіСЂРµС‡РєРѕР№',kcal:680,protein:58,fat:15,carbs:82,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 250Рі, РіСЂРµС‡РєР° 180Рі, С‚СѓС€С‘РЅР°СЏ РјРѕСЂРєРѕРІСЊ'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ РѕС‚РІР°СЂРЅС‹Рј РєР°СЂС‚РѕС„РµР»РµРј',kcal:780,protein:58,fat:28,carbs:78,foods:'Р“РѕРІСЏРґРёРЅР° Р·Р°РїРµС‡С‘РЅРЅР°СЏ 250Рі, РєР°СЂС‚РѕС„РµР»СЊ РѕС‚РІР°СЂРЅРѕР№ 250Рі, Р·РµР»РµРЅСЊ'},
        {name:'РЎРєСѓРјР±СЂРёСЏ СЃ СЂРёСЃРѕРј',kcal:700,protein:52,fat:28,carbs:70,foods:'РЎРєСѓРјР±СЂРёСЏ Р·Р°РїРµС‡С‘РЅРЅР°СЏ 250Рі, СЂРёСЃ 170Рі, РѕРІРѕС‰Рё РЅР° РїР°СЂСѓ'},
        {name:'РљСѓСЂРёРЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ РїСЋСЂРµ',kcal:720,protein:55,fat:22,carbs:78,foods:'РљСѓСЂРёРЅС‹Рµ РєРѕС‚Р»РµС‚С‹ 3С€С‚, РїСЋСЂРµ РєР°СЂС‚РѕС„РµР»СЊРЅРѕРµ 200Рі'},
        {name:'РўСѓРЅРµС† СЃ РіСЂРµС‡РєРѕР№',kcal:660,protein:60,fat:10,carbs:82,foods:'РўСѓРЅРµС† РІ СЃРѕР±СЃС‚РІРµРЅРЅРѕРј СЃРѕРєСѓ 250Рі, РіСЂРµС‡РєР° 180Рі, РѕРіСѓСЂРµС†'},
        {name:'Р С‹Р±Р° РЅР° РїР°СЂСѓ СЃ СЂРёСЃРѕРј',kcal:680,protein:58,fat:12,carbs:85,foods:'РўСЂРµСЃРєР° РЅР° РїР°СЂСѓ 280Рі, СЂРёСЃ 180Рі, Р±СЂРѕРєРєРѕР»Рё'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ СЃ РіСЂРµС‡РєРѕР№',kcal:750,protein:60,fat:24,carbs:78,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ Р±РµР· РєРѕР¶Рё 280Рі, РіСЂРµС‡РєР° 200Рі, СЃР°Р»Р°С‚'},
        {name:'Р“РѕРІСЏР¶СЊРё РєРѕС‚Р»РµС‚С‹ СЃ СЂРёСЃРѕРј',kcal:800,protein:60,fat:32,carbs:72,foods:'РљРѕС‚Р»РµС‚С‹ РіРѕРІСЏР¶СЊРё 3С€С‚, СЂРёСЃ 180Рі, РѕРіСѓСЂРµС†'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:760,protein:60,fat:28,carbs:68,foods:'Р›РѕСЃРѕСЃСЊ 250Рі, РєР°СЂС‚РѕС„РµР»СЊ РѕС‚РІР°СЂРЅРѕР№ 230Рі, Р±СЂРѕРєРєРѕР»Рё 100Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ СЂРёСЃРѕРј',kcal:660,protein:58,fat:10,carbs:88,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 250Рі, СЂРёСЃ 200Рі, РїРѕРјРёРґРѕСЂ'},
        {name:'Р¤РѕСЂРµР»СЊ СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:720,protein:58,fat:25,carbs:68,foods:'Р¤РѕСЂРµР»СЊ Р·Р°РїРµС‡С‘РЅРЅР°СЏ 280Рі, РєР°СЂС‚РѕС„РµР»СЊ 200Рі, Р»РёРјРѕРЅ, Р·РµР»РµРЅСЊ'},
        {name:'Р“РѕРІСЏР¶РёР№ СЃС‚РµР№Рє СЃ РіСЂРµС‡РєРѕР№',kcal:780,protein:62,fat:28,carbs:72,foods:'РЎС‚РµР№Рє РіРѕРІСЏР¶РёР№ 250Рі, РіСЂРµС‡РєР° 180Рі, С‚СѓС€С‘РЅС‹Рµ РѕРІРѕС‰Рё'},
        {name:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:680,protein:56,fat:12,carbs:88,foods:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ 250Рі, РїРµСЂР»РѕРІРєР° 200Рі, РјРѕСЂРєРѕРІСЊ'},
        {name:'Р С‹Р±РЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ РїСЋСЂРµ',kcal:700,protein:52,fat:20,carbs:80,foods:'Р С‹Р±РЅС‹Рµ РєРѕС‚Р»РµС‚С‹ 3С€С‚, РєР°СЂС‚РѕС„РµР»СЊРЅРѕРµ РїСЋСЂРµ 200Рі'},
        {name:'РўСѓС€С‘РЅР°СЏ РіРѕРІСЏРґРёРЅР° СЃ СЂРёСЃРѕРј',kcal:760,protein:60,fat:22,carbs:82,foods:'Р“РѕРІСЏРґРёРЅР° С‚СѓС€С‘РЅР°СЏ 250Рі, СЂРёСЃ 200Рі, С‚СѓС€С‘РЅС‹Рµ РѕРІРѕС‰Рё'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РєСѓСЂРёС†Р° СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:720,protein:58,fat:20,carbs:80,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 250Рі, РєР°СЂС‚РѕС„РµР»СЊ 230Рі, СЃРїРµС†РёРё'},
        {name:'РњРёРЅС‚Р°Р№ СЃ СЂРёСЃРѕРј',kcal:620,protein:55,fat:8,carbs:82,foods:'РњРёРЅС‚Р°Р№ РѕС‚РІР°СЂРЅРѕР№ 300Рі, СЂРёСЃ 180Рі, РјРѕСЂРєРѕРІСЊ С‚СѓС€С‘РЅР°СЏ'},
        {name:'РўСѓРЅРµС† СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:680,protein:58,fat:12,carbs:82,foods:'РўСѓРЅРµС† 250Рі, РѕС‚РІР°СЂРЅРѕР№ РєР°СЂС‚РѕС„РµР»СЊ 250Рі, РѕРіСѓСЂРµС†'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ СЃ СЂРёСЃРѕРј',kcal:720,protein:58,fat:20,carbs:82,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ 280Рі, СЂРёСЃ 180Рі, СЃРІРµР¶РёР№ СЃР°Р»Р°С‚'},
        {name:'РњРёРЅС‚Р°Р№ СЃ РіСЂРµС‡РєРѕР№',kcal:640,protein:55,fat:10,carbs:80,foods:'РњРёРЅС‚Р°Р№ Р·Р°РїРµС‡С‘РЅРЅС‹Р№ 300Рі, РіСЂРµС‡РєР° 180Рі, Р»РёРјРѕРЅ'},
        {name:'Р“РѕРІСЏРґРёРЅР° РЅР° РіСЂРёР»Рµ СЃ СЂРёСЃРѕРј',kcal:750,protein:60,fat:22,carbs:78,foods:'Р“РѕРІСЏР¶СЊСЏ РєРѕС‚Р»РµС‚Р° 250Рі РЅР° РіСЂРёР»Рµ, СЂРёСЃ 180Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:660,protein:56,fat:12,carbs:82,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 250Рі, РїРµСЂР»РѕРІРєР° 200Рі, Р±СЂРѕРєРєРѕР»Рё'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ СЂРёСЃРѕРј',kcal:680,protein:55,fat:15,carbs:82,foods:'Р“РѕСЂР±СѓС€Р° Р·Р°РїРµС‡С‘РЅРЅР°СЏ 250Рі, СЂРёСЃ 180Рі, Р»РёРјРѕРЅ, СѓРєСЂРѕРї'},
        {name:'РўСѓС€С‘РЅС‹Рµ РєСѓСЂРёРЅС‹Рµ Р±С‘РґСЂР° СЃ РіСЂРµС‡РєРѕР№',kcal:730,protein:60,fat:22,carbs:78,foods:'РљСѓСЂРёРЅС‹Рµ Р±С‘РґСЂР° 280Рі, РіСЂРµС‡РєР° 200Рі'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ РєР°СЂС‚РѕС„РµР»СЊРЅС‹Рј РїСЋСЂРµ',kcal:780,protein:60,fat:28,carbs:76,foods:'Р“РѕРІСЏРґРёРЅР° 250Рі, РїСЋСЂРµ 250Рі, СЃРІРµР¶РёР№ РѕРіСѓСЂРµС†'},
        {name:'РЎРєСѓРјР±СЂРёСЏ СЃ РіСЂРµС‡РєРѕР№',kcal:700,protein:52,fat:28,carbs:68,foods:'РЎРєСѓРјР±СЂРёСЏ 250Рі, РіСЂРµС‡РєР° 180Рі, С‚СѓС€С‘РЅС‹Рµ РѕРІРѕС‰Рё'},
        {name:'РљСѓСЂРёРЅС‹Рµ РѕС‚Р±РёРІРЅС‹Рµ СЃ СЂРёСЃРѕРј',kcal:700,protein:60,fat:18,carbs:80,foods:'РљСѓСЂРёРЅС‹Рµ РѕС‚Р±РёРІРЅС‹Рµ 280Рі, СЂРёСЃ 180Рі'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ РїСЋСЂРµ',kcal:680,protein:55,fat:18,carbs:80,foods:'Р“РѕСЂР±СѓС€Р° Р·Р°РїРµС‡С‘РЅРЅР°СЏ 250Рі, РїСЋСЂРµ 250Рі, Р»РёРјРѕРЅ'},
        {name:'РЎС‚РµР№Рє С‚СѓРЅС†Р° СЃ СЂРёСЃРѕРј',kcal:680,protein:60,fat:10,carbs:82,foods:'РЎС‚РµР№Рє С‚СѓРЅС†Р° 250Рі, СЂРёСЃ 180Рі, Р»РёРјРѕРЅ, Р·РµР»РµРЅСЊ'},
        {name:'РљСѓСЂРёРЅС‹Рµ Р±С‘РґСЂР° СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:730,protein:62,fat:22,carbs:78,foods:'РљСѓСЂРёРЅС‹Рµ Р±С‘РґСЂР° 280Рі, РїРµСЂР»РѕРІРєР° 200Рі'},
        {name:'Р“РѕРІСЏР¶СЊРё С‚РµС„С‚РµР»Рё СЃ СЂРёСЃРѕРј',kcal:760,protein:62,fat:26,carbs:80,foods:'Р“РѕРІСЏР¶СЊРё С‚РµС„С‚РµР»Рё 3С€С‚, СЂРёСЃ 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РєРѕС‚Р»РµС‚Р° СЃ РіСЂРµС‡РєРѕР№',kcal:700,protein:58,fat:20,carbs:78,foods:'РљСѓСЂРёРЅР°СЏ РєРѕС‚Р»РµС‚Р° 250Рі, РіСЂРµС‡РєР° 180Рі'},
        {name:'Р‘РёС‚РѕС‡РєРё РёР· РіРѕРІСЏРґРёРЅС‹ СЃ РїСЋСЂРµ',kcal:780,protein:60,fat:30,carbs:78,foods:'Р‘РёС‚РѕС‡РєРё 2С€С‚, РїСЋСЂРµ 250Рі'},
        {name:'РРЅРґРµР№РєР° СЃ СЂРёСЃРѕРј',kcal:700,protein:62,fat:12,carbs:84,foods:'РРЅРґРµР№РєР° 250Рі, СЂРёСЃ 180Рі, Р±СЂРѕРєРєРѕР»Рё'},
        {name:'РЎРІРёРЅС‹Рµ РјРµРґР°Р»СЊРѕРЅС‹ СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:800,protein:55,fat:38,carbs:72,foods:'РЎРІРёРЅС‹Рµ РјРµРґР°Р»СЊРѕРЅС‹ 2С€С‚ 200Рі, РєР°СЂС‚РѕС„РµР»СЊ 250Рі'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:740,protein:60,fat:24,carbs:72,foods:'Р›РѕСЃРѕСЃСЊ 250Рі, РїРµСЂР»РѕРІРєР° 200Рі, С‚СѓС€С‘РЅС‹Рµ РѕРІРѕС‰Рё'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С„Р°СЃРѕР»СЊСЋ',kcal:760,protein:62,fat:22,carbs:78,foods:'Р“РѕРІСЏРґРёРЅР° 240Рі, С„Р°СЃРѕР»СЊ 100Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ'},
        {name:'Р С‹Р±РЅС‹Р№ С€Р°С€Р»С‹Рє СЃ РіСЂРµС‡РєРѕР№',kcal:680,protein:58,fat:15,carbs:80,foods:'Р›РѕСЃРѕСЃСЊ РЅР° С€Р°РјРїСѓСЂР°С… 250Рі, РіСЂРµС‡РєР° 180Рі'},
        {name:'РЎС‘РјРіР° СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:760,protein:60,fat:28,carbs:70,foods:'РЎС‘РјРіР° 250Рі, РєР°СЂС‚РѕС„РµР»СЊ 230Рі, СѓРєСЂРѕРї'},
        {name:'РљСѓСЂРёС†Р° РІ С‚РѕРјР°С‚РЅРѕРј СЃРѕСѓСЃРµ СЃ СЂРёСЃРѕРј',kcal:720,protein:60,fat:16,carbs:84,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 260Рі РІ С‚РѕРјР°С‚Рµ, СЂРёСЃ 180Рі'},
        {name:'Р“РѕРІСЏР¶РёР№ СЂРѕСЃС‚Р±РёС„ СЃ РіСЂРµС‡РєРѕР№',kcal:780,protein:64,fat:28,carbs:72,foods:'Р“РѕРІСЏР¶РёР№ СЂРѕСЃС‚Р±РёС„ 250Рі, РіСЂРµС‡РєР° 180Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‡РµС‡РµРІРёС†РµР№',kcal:690,protein:58,fat:10,carbs:84,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 240Рі, С‡РµС‡РµРІРёС†Р° 180Рі'},
        {name:'Р С‹Р±РЅС‹Р№ С€РЅРёС†РµР»СЊ СЃ РїСЋСЂРµ',kcal:720,protein:55,fat:22,carbs:80,foods:'Р С‹Р±РЅС‹Р№ С€РЅРёС†РµР»СЊ 250Рі, РїСЋСЂРµ 200Рі'},
        {name:'РўСѓС€С‘РЅР°СЏ РіРѕРІСЏРґРёРЅР° СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:780,protein:60,fat:30,carbs:76,foods:'Р“РѕРІСЏРґРёРЅР° С‚СѓС€С‘РЅР°СЏ 240Рі, РєР°СЂС‚РѕС„РµР»СЊ 250Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Рµ РєСѓСЂРёРЅС‹Рµ РЅРѕР¶РєРё СЃ СЂРёСЃРѕРј',kcal:750,protein:60,fat:24,carbs:80,foods:'РљСѓСЂРёРЅС‹Рµ РЅРѕР¶РєРё 300Рі, СЂРёСЃ 180Рі'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ С‡РµС‡РµРІРёС†РµР№',kcal:720,protein:60,fat:22,carbs:72,foods:'Р›РѕСЃРѕСЃСЊ 240Рі, С‡РµС‡РµРІРёС†Р° 170Рі'},
        {name:'РЎРІРёРЅРёРЅР° СЃ С‚СѓС€С‘РЅРѕР№ РєР°РїСѓСЃС‚РѕР№',kcal:760,protein:55,fat:35,carbs:62,foods:'РЎРІРёРЅРёРЅР° 220Рі, С‚СѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° 250Рі'},
        {name:'Р“РѕРІСЏР¶СЊРё РєРѕС‚Р»РµС‚С‹ СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:770,protein:60,fat:30,carbs:76,foods:'Р“РѕРІСЏР¶СЊРё РєРѕС‚Р»РµС‚С‹ 2С€С‚, РїРµСЂР»РѕРІРєР° 200Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ СЂС‹Р±Р° СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:700,protein:58,fat:16,carbs:80,foods:'РўСЂРµСЃРєР° 280Рі, РїРµСЂР»РѕРІРєР° 190Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С„Р°СЃРѕР»СЊСЋ',kcal:700,protein:60,fat:10,carbs:84,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 250Рі, С„Р°СЃРѕР»СЊ 150Рі'},
        {name:'Р С‹Р±Р° РІ С‚РѕРјР°С‚Рµ СЃ СЂРёСЃРѕРј',kcal:700,protein:55,fat:14,carbs:86,foods:'РўСЂРµСЃРєР° РІ С‚РѕРјР°С‚РЅРѕРј СЃРѕСѓСЃРµ 250Рі, СЂРёСЃ 180Рі'},
        {name:'Р“РѕРІСЏР¶СЊРё Р±РёС‚РѕС‡РєРё СЃ РіСЂРµС‡РєРѕР№',kcal:760,protein:60,fat:28,carbs:76,foods:'Р‘РёС‚РѕС‡РєРё 3С€С‚, РіСЂРµС‡РєР° 180Рі, РѕРіСѓСЂРµС†'},
        {name:'РљСѓСЂРёРЅС‹Р№ СЂСѓР»РµС‚ СЃ СЂРёСЃРѕРј',kcal:700,protein:58,fat:18,carbs:82,foods:'РљСѓСЂРёРЅС‹Р№ СЂСѓР»РµС‚ 250Рі, СЂРёСЃ 180Рі'},
        {name:'РљР°СЂРї Р·Р°РїРµС‡С‘РЅРЅС‹Р№ СЃ РєР°СЂС‚РѕС„РµР»РµРј',kcal:700,protein:55,fat:20,carbs:80,foods:'РљР°СЂРї 250Рі, РєР°СЂС‚РѕС„РµР»СЊ 230Рі, Р»РёРјРѕРЅ'},
        {name:'РљСѓСЂРёРЅС‹Р№ С„Р°СЂС€ СЃ СЂРёСЃРѕРј',kcal:680,protein:52,fat:14,carbs:88,foods:'РљСѓСЂРёРЅС‹Р№ С„Р°СЂС€ 220Рі, СЂРёСЃ 200Рі'},
        {name:'РЈС‚РёРЅР°СЏ РіСЂСѓРґРєР° СЃ РіСЂРµС‡РєРѕР№',kcal:800,protein:58,fat:38,carbs:68,foods:'РЈС‚РёРЅР°СЏ РіСЂСѓРґРєР° 250Рі, РіСЂРµС‡РєР° 180Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Рµ РєСѓСЂРёРЅС‹Рµ РєСЂС‹Р»С‹С€РєРё СЃ СЂРёСЃРѕРј',kcal:750,protein:60,fat:28,carbs:74,foods:'РљСѓСЂРёРЅС‹Рµ РєСЂС‹Р»С‹С€РєРё 350Рі, СЂРёСЃ 180Рі'},
        {name:'РњРёРЅС‚Р°Р№ СЃ СЂРёСЃРѕРј Рё РјРѕСЂРєРѕРІСЊСЋ',kcal:640,protein:55,fat:8,carbs:84,foods:'РњРёРЅС‚Р°Р№ РѕС‚РІР°СЂРЅРѕР№ 300Рі, СЂРёСЃ 180Рі, РјРѕСЂРєРѕРІСЊ С‚СѓС€С‘РЅР°СЏ'}
      ],
      'РџРµСЂРµРєСѓСЃ': [
        {name:'РўРІРѕСЂРѕРі СЃ Р±Р°РЅР°РЅРѕРј Рё РјС‘РґРѕРј',kcal:380,protein:32,fat:5,carbs:55,foods:'РўРІРѕСЂРѕРі 5% 250Рі, Р±Р°РЅР°РЅ 1С€С‚, РјС‘Рґ 1 С‡.Р».'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІС‹Р№ РєРѕРєС‚РµР№Р»СЊ СЃ Р±Р°РЅР°РЅРѕРј',kcal:400,protein:40,fat:5,carbs:52,foods:'РџСЂРѕС‚РµРёРЅ 2 РјРµСЂРЅС‹С…, РјРѕР»РѕРєРѕ 300РјР», Р±Р°РЅР°РЅ'},
        {name:'РћСЂРµС…Рё СЃ СЃСѓС…РѕС„СЂСѓРєС‚Р°РјРё',kcal:420,protein:12,fat:28,carbs:38,foods:'Р“СЂРµС†РєРёРµ РѕСЂРµС…Рё 40Рі, РёР·СЋРј 40Рі, РєСѓСЂР°РіР° 30Рі'},
        {name:'Р“СЂРµС‡РєР° СЃ СЏР№С†Р°РјРё',kcal:360,protein:22,fat:12,carbs:44,foods:'Р“СЂРµС‡РєР° 120Рі, СЏР№С†Р° РІР°СЂС‘РЅС‹Рµ 2С€С‚'},
        {name:'РўРІРѕСЂРѕРі СЃ РіСЂРµС†РєРёРјРё РѕСЂРµС…Р°РјРё',kcal:380,protein:32,fat:18,carbs:22,foods:'РўРІРѕСЂРѕРі 5% 250Рі, РіСЂРµС†РєРёРµ РѕСЂРµС…Рё 25Рі'},
        {name:'Р РёСЃ СЃ РєСѓСЂРёРЅРѕР№ РіСЂСѓРґРєРѕР№',kcal:420,protein:35,fat:5,carbs:60,foods:'Р РёСЃ 120Рі, РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 120Рі'},
        {name:'Р‘Р°РЅР°РЅРѕРІС‹Р№ РјРѕР»РѕС‡РЅС‹Р№ СЃРјСѓР·Рё',kcal:400,protein:18,fat:5,carbs:72,foods:'Р‘Р°РЅР°РЅ 2С€С‚, РјРѕР»РѕРєРѕ 300РјР», РјС‘Рґ'},
        {name:'РҐР»РµР±С†С‹ СЃ Р°СЂР°С…РёСЃРѕРІРѕР№ РїР°СЃС‚РѕР№',kcal:420,protein:18,fat:20,carbs:50,foods:'РҐР»РµР±С†С‹ 6С€С‚, Р°СЂР°С…РёСЃРѕРІР°СЏ РїР°СЃС‚Р° 40Рі'},
        {name:'Р’Р°СЂС‘РЅС‹Рµ СЏР№С†Р° СЃ С…Р»РµР±РѕРј',kcal:340,protein:24,fat:18,carbs:24,foods:'РЇР№С†Р° РІР°СЂС‘РЅС‹Рµ 3С€С‚, С†РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 1 Р»РѕРјРѕС‚СЊ'},
        {name:'РљРµС„РёСЂ СЃ С…Р»РµР±С†Р°РјРё',kcal:300,protein:18,fat:5,carbs:46,foods:'РљРµС„РёСЂ 2.5% 400РјР», С…Р»РµР±С†С‹ 4С€С‚'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ СЃ РіСЂР°РЅРѕР»РѕР№',kcal:380,protein:22,fat:8,carbs:58,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 200Рі, РіСЂР°РЅРѕР»Р° 60Рі'},
        {name:'Р‘Р°РЅР°РЅС‹ СЃ РјРёРЅРґР°Р»С‘Рј',kcal:420,protein:10,fat:22,carbs:52,foods:'Р‘Р°РЅР°РЅ 2С€С‚, РјРёРЅРґР°Р»СЊ 30Рі'},
        {name:'РўРІРѕСЂРѕР¶РЅР°СЏ Р·Р°РїРµРєР°РЅРєР°',kcal:360,protein:28,fat:10,carbs:40,foods:'Р—Р°РїРµРєР°РЅРєР° РёР· С‚РІРѕСЂРѕРіР° 200Рі, СЃРјРµС‚Р°РЅР° 30Рі'},
        {name:'Р‘СѓС‚РµСЂР±СЂРѕРґС‹ СЃ СЏР№С†РѕРј',kcal:360,protein:24,fat:18,carbs:30,foods:'РЇР№С†Р° 2С€С‚, С†РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 2 Р»РѕРјС‚СЏ, РјР°СЃР»Рѕ'},
        {name:'РўРІРѕСЂРѕРі СЃ РјС‘РґРѕРј Рё РѕСЂРµС…Р°РјРё',kcal:400,protein:30,fat:15,carbs:38,foods:'РўРІРѕСЂРѕРі 9% 200Рі, РјС‘Рґ 2 С‡.Р»., РѕСЂРµС…Рё 20Рі'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІС‹Р№ Р±Р°С‚РѕРЅС‡РёРє СЃ Р±Р°РЅР°РЅРѕРј',kcal:380,protein:30,fat:8,carbs:50,foods:'РџСЂРѕС‚РµРёРЅРѕРІС‹Р№ Р±Р°С‚РѕРЅС‡РёРє 60Рі, Р±Р°РЅР°РЅ'},
        {name:'Р РёСЃРѕРІС‹Рµ РєРµРєСЃС‹ СЃ Р°СЂР°С…РёСЃРѕРІРѕР№ РїР°СЃС‚РѕР№',kcal:400,protein:16,fat:18,carbs:48,foods:'Р РёСЃРѕРІС‹Рµ РєРµРєСЃС‹ 6С€С‚, Р°СЂР°С…РёСЃРѕРІР°СЏ РїР°СЃС‚Р° 35Рі'},
        {name:'РњРѕР»РѕРєРѕ СЃ РѕРІСЃСЏРЅС‹РјРё С…Р»РѕРїСЊСЏРјРё',kcal:380,protein:18,fat:8,carbs:58,foods:'РњРѕР»РѕРєРѕ 3.2% 300РјР», РіРµСЂРєСѓР»РµСЃ 80Рі'},
        {name:'РЎС‹СЂ СЃ С…Р»РµР±РѕРј',kcal:400,protein:28,fat:24,carbs:22,foods:'РўРІС‘СЂРґС‹Р№ СЃС‹СЂ 80Рі, С†РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 2 Р»РѕРјС‚СЏ'},
        {name:'РђРІРѕРєР°РґРѕ СЃ РІР°СЂС‘РЅС‹РјРё СЏР№С†Р°РјРё',kcal:380,protein:20,fat:28,carbs:14,foods:'РђРІРѕРєР°РґРѕ 1С€С‚, СЏР№С†Р° РІР°СЂС‘РЅС‹Рµ 2С€С‚'},
        {name:'РњРѕР»РѕС‡РЅР°СЏ РјР°РЅРЅР°СЏ РєР°С€Р°',kcal:350,protein:15,fat:8,carbs:56,foods:'РњР°РЅРєР° 80Рі РЅР° РјРѕР»РѕРєРµ, РјР°СЃР»Рѕ, РјС‘Рґ'},
        {name:'РћСЂРµС…РѕРІР°СЏ СЃРјРµСЃСЊ СЃ Р№РѕРіСѓСЂС‚РѕРј',kcal:420,protein:20,fat:22,carbs:40,foods:'Р™РѕРіСѓСЂС‚ РЅР°С‚СѓСЂР°Р»СЊРЅС‹Р№ 200Рі, РѕСЂРµС…РѕРІР°СЏ СЃРјРµСЃСЊ 35Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С…Р»РµР±РѕРј',kcal:360,protein:40,fat:5,carbs:32,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° РѕС‚РІР°СЂРЅР°СЏ 150Рі, С…Р»РµР± 2 Р»РѕРјС‚СЏ'},
        {name:'РўРІРѕСЂРѕРі СЃ Р±Р°РЅР°РЅРѕРј Рё СЏРіРѕРґР°РјРё',kcal:380,protein:28,fat:8,carbs:52,foods:'РўРІРѕСЂРѕРі 200Рі, Р±Р°РЅР°РЅ, СЏРіРѕРґС‹'},
        {name:'РЎСѓС…РѕС„СЂСѓРєС‚С‹ СЃ РєРµС€СЊСЋ',kcal:440,protein:8,fat:20,carbs:58,foods:'РР·СЋРј 40Рі, РєСѓСЂР°РіР° 30Рі, РєРµС€СЊСЋ 30Рі'},
        {name:'Р‘СѓСЂС‹Р№ СЂРёСЃ СЃ СЏР№С†Р°РјРё',kcal:380,protein:20,fat:10,carbs:52,foods:'Р‘СѓСЂС‹Р№ СЂРёСЃ 120Рі, СЏР№С†Р° 2С€С‚'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Рµ СЏР№С†Р° СЃ СЃС‹СЂРѕРј',kcal:360,protein:28,fat:24,carbs:6,foods:'РЇР№С†Р° Р·Р°РїРµС‡С‘РЅРЅС‹Рµ 3С€С‚ СЃ С‚РІС‘СЂРґС‹Рј СЃС‹СЂРѕРј 40Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ СЏРіРѕРґР°РјРё',kcal:330,protein:28,fat:8,carbs:38,foods:'РўРІРѕСЂРѕРі 5% 200Рі, Р·Р°РјРѕСЂРѕР¶РµРЅРЅС‹Рµ СЏРіРѕРґС‹ 100Рі, РјС‘Рґ'},
        {name:'РљР»Р°СЃСЃРёС‡РµСЃРєРёР№ РѕРјР»РµС‚',kcal:380,protein:28,fat:26,carbs:6,foods:'РћРјР»РµС‚ РёР· 3 СЏРёС† СЃ РјРѕР»РѕРєРѕРј 100РјР», РјР°СЃР»Рѕ 5Рі'},
        {name:'Р‘Р°С‚РѕРЅС‡РёРє РјСЋСЃР»Рё СЃ РјРѕР»РѕРєРѕРј',kcal:400,protein:16,fat:10,carbs:62,foods:'Р‘Р°С‚РѕРЅС‡РёРє РјСЋСЃР»Рё 80Рі, РјРѕР»РѕРєРѕ 250РјР»'},
        {name:'РЎС‹СЂРЅРёРєРё РјР°Р»РµРЅСЊРєРёРµ',kcal:360,protein:28,fat:12,carbs:38,foods:'РЎС‹СЂРЅРёРєРё РёР· С‚РІРѕСЂРѕРіР° 3С€С‚, СЃРјРµС‚Р°РЅР°'},
        {name:'РЇР№С†Р° РїРµСЂРµРїРµР»РёРЅС‹Рµ СЃ С…Р»РµР±РѕРј',kcal:320,protein:22,fat:18,carbs:24,foods:'РџРµСЂРµРїРµР»РёРЅС‹Рµ СЏР№С†Р° 8С€С‚, С…Р»РµР± 1 Р»РѕРјРѕС‚СЊ'},
        {name:'РњРѕР»РѕС‡РЅС‹Р№ РєРѕРєС‚РµР№Р»СЊ СЃ Р±Р°РЅР°РЅРѕРј',kcal:420,protein:18,fat:8,carbs:70,foods:'РњРѕР»РѕРєРѕ 300РјР», Р±Р°РЅР°РЅ 2С€С‚, РјС‘Рґ'},
        {name:'РђСЂР°С…РёСЃРѕРІС‹Рµ С€Р°СЂРёРєРё',kcal:440,protein:16,fat:24,carbs:42,foods:'РђСЂР°С…РёСЃРѕРІР°СЏ РїР°СЃС‚Р° 50Рі, РіРµСЂРєСѓР»РµСЃ 50Рі, РјС‘Рґ'},
        {name:'РҐР»РµР± СЃ РјР°СЃР»РѕРј Рё СЃС‹СЂРѕРј',kcal:380,protein:20,fat:24,carbs:26,foods:'Р¦РµР»СЊРЅРѕР·РµСЂРЅРѕРІРѕР№ С…Р»РµР± 2 Р»РѕРјС‚СЏ, РјР°СЃР»Рѕ 10Рі, СЃС‹СЂ 60Рі'},
        {name:'Р РёСЃРѕРІР°СЏ РєР°С€Р° РјР°Р»РµРЅСЊРєР°СЏ',kcal:360,protein:14,fat:8,carbs:60,foods:'Р РёСЃ 100Рі РЅР° РјРѕР»РѕРєРµ, РјР°СЃР»Рѕ, РјС‘Рґ'},
        {name:'РЇР±Р»РѕС‡РЅС‹Р№ СЃРјСѓР·Рё СЃ РѕСЂРµС…Р°РјРё',kcal:380,protein:14,fat:18,carbs:48,foods:'РЇР±Р»РѕРєРѕ, РєРµС„РёСЂ 200РјР», РѕСЂРµС…Рё 25Рі'},
        {name:'РҐР»РµР±С†С‹ СЃ РјС‘РґРѕРј Рё РѕСЂРµС…Р°РјРё',kcal:380,protein:10,fat:18,carbs:50,foods:'РҐР»РµР±С†С‹ 4С€С‚, РјС‘Рґ 2 С‡.Р»., РѕСЂРµС…Рё 25Рі'},
        {name:'РљРµС„РёСЂ СЃ РіСЂР°РЅРѕР»РѕР№',kcal:380,protein:16,fat:8,carbs:60,foods:'РљРµС„РёСЂ 2.5% 300РјР», РіСЂР°РЅРѕР»Р° 60Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РёР·СЋРјРѕРј',kcal:360,protein:30,fat:8,carbs:42,foods:'РўРІРѕСЂРѕРі 5% 200Рі, РёР·СЋРј 40Рі'},
        {name:'РЇРёС‡РЅС‹Р№ СЂСѓР»РµС‚',kcal:360,protein:28,fat:20,carbs:20,foods:'РЇРёС‡РЅС‹Р№ СЂСѓР»РµС‚ 4 СЏР№С†Р°, Р·РµР»РµРЅСЊ, СЃС‹СЂ 30Рі'},
        {name:'РћСЂРµС…РѕРІР°СЏ РїР°СЃС‚Р° СЃ С…Р»РµР±С†Р°РјРё',kcal:420,protein:14,fat:26,carbs:36,foods:'РђСЂР°С…РёСЃРѕРІР°СЏ РїР°СЃС‚Р° 40Рі, С…Р»РµР±С†С‹ 5С€С‚'},
        {name:'РўС‘РїР»С‹Р№ РєРµС„РёСЂ СЃ РјС‘РґРѕРј',kcal:260,protein:12,fat:4,carbs:42,foods:'РљРµС„РёСЂ 2.5% 350РјР», РјС‘Рґ 2 С‡.Р».'},
        {name:'РЇР№С†Р° СЃ СЃС‹СЂРѕРј',kcal:360,protein:28,fat:24,carbs:6,foods:'Р’Р°СЂС‘РЅС‹Рµ СЏР№С†Р° 2С€С‚, С‚РІС‘СЂРґС‹Р№ СЃС‹СЂ 60Рі'},
        {name:'Р¤РёРЅРёРєРё СЃ РѕСЂРµС…Р°РјРё',kcal:420,protein:8,fat:18,carbs:58,foods:'Р¤РёРЅРёРєРё 6С€С‚, РјРёРЅРґР°Р»СЊ 30Рі'},
        {name:'РњРѕР»РѕС‡РЅС‹Р№ СЂРёСЃ',kcal:350,protein:12,fat:8,carbs:56,foods:'Р РёСЃ 80Рі РЅР° РјРѕР»РѕРєРµ, РјР°СЃР»Рѕ, РјС‘Рґ'},
        {name:'РҐР»РµР± СЃ Р°РІРѕРєР°РґРѕ Рё СЏР№С†РѕРј',kcal:400,protein:20,fat:26,carbs:26,foods:'РҐР»РµР± 1 Р»РѕРјРѕС‚СЊ, Р°РІРѕРєР°РґРѕ ВЅ, СЏР№С†Рѕ РІР°СЂС‘РЅРѕРµ'},
        {name:'РўРІРѕСЂРѕР¶РЅР°СЏ РјР°СЃСЃР° СЃ РёР·СЋРјРѕРј',kcal:380,protein:28,fat:12,carbs:44,foods:'РўРІРѕСЂРѕРі 9% 200Рі, РёР·СЋРј, РІР°РЅРёР»РёРЅ, РјС‘Рґ'},
        {name:'РЎРјСѓР·Рё СЃ РјРѕСЂРєРѕРІСЊСЋ Рё СЏР±Р»РѕРєРѕРј',kcal:320,protein:10,fat:4,carbs:58,foods:'РњРѕСЂРєРѕРІСЊ, СЏР±Р»РѕРєРѕ, РєРµС„РёСЂ 200РјР»'},
        {name:'РљРµРєСЃ РёР· РѕРІСЃСЏРЅРєРё СЃ Р±Р°РЅР°РЅРѕРј',kcal:400,protein:18,fat:14,carbs:56,foods:'РљРµРєСЃ РёР· РѕРІСЃСЏРЅС‹С… С…Р»РѕРїСЊРµРІ СЃ Р±Р°РЅР°РЅРѕРј'},
        {name:'Р—РµСЂРЅРѕРІРѕР№ Р±Р°С‚РѕРЅС‡РёРє СЃ РєРµС„РёСЂРѕРј',kcal:380,protein:12,fat:14,carbs:54,foods:'Р‘Р°С‚РѕРЅС‡РёРє РёР· Р·РµСЂРЅРѕРІС‹С… 80Рі, РєРµС„РёСЂ 200РјР»'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІРѕРµ РјРѕСЂРѕР¶РµРЅРѕРµ',kcal:300,protein:28,fat:4,carbs:36,foods:'Р—Р°РјРѕСЂРѕР¶РµРЅРЅС‹Р№ СЃРјСѓР·Рё РёР· Р±Р°РЅР°РЅР°, С‚РІРѕСЂРѕРіР° 0% Рё РїСЂРѕС‚РµРёРЅР°'},
        {name:'РљРѕРєРѕСЃРѕРІС‹Р№ Р№РѕРіСѓСЂС‚ СЃ РіСЂР°РЅРѕР»РѕР№',kcal:400,protein:10,fat:20,carbs:48,foods:'РљРѕРєРѕСЃРѕРІС‹Р№ Р№РѕРіСѓСЂС‚ 150Рі, РіСЂР°РЅРѕР»Р° 60Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅРѕРµ СЏР±Р»РѕРєРѕ СЃ РјС‘РґРѕРј',kcal:280,protein:4,fat:2,carbs:60,foods:'РЇР±Р»РѕРєРѕ 2С€С‚ Р·Р°РїРµС‡С‘РЅРЅС‹Рµ СЃ РјС‘РґРѕРј Рё РєРѕСЂРёС†РµР№'},
        {name:'Р›РµРЅРёРІС‹Рµ РІР°СЂРµРЅРёРєРё',kcal:400,protein:28,fat:12,carbs:52,foods:'Р’Р°СЂРµРЅРёРєРё РёР· С‚РІРѕСЂРѕРіР° 8С€С‚, СЃРјРµС‚Р°РЅР° 30Рі'},
        {name:'РћР»Р°РґСЊРё РёР· Р±Р°РЅР°РЅР°',kcal:380,protein:16,fat:8,carbs:60,foods:'Р‘Р°РЅР°РЅ, СЏР№С†Рѕ, РјСѓРєР° 30Рі вЂ” 4 РѕР»Р°РґСЊРё'},
        {name:'РўС‘РїР»РѕРµ РјРѕР»РѕРєРѕ СЃ РјС‘РґРѕРј',kcal:280,protein:10,fat:6,carbs:46,foods:'РњРѕР»РѕРєРѕ 400РјР», РјС‘Рґ 2 С‡.Р».'},
        {name:'РўРІРѕСЂРѕРі СЃ СЏРіРѕРґР°РјРё Рё РјС‘РґРѕРј',kcal:350,protein:30,fat:8,carbs:40,foods:'РўРІРѕСЂРѕРі 5% 200Рі, СЏРіРѕРґС‹ 80Рі, РјС‘Рґ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РѕРіСѓСЂС†РѕРј',kcal:340,protein:40,fat:5,carbs:22,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° РѕС‚РІР°СЂРЅР°СЏ 150Рі, РѕРіСѓСЂРµС† 2С€С‚'}
      ]
    }
  },
  cut: { label:'РџРѕС…СѓРґРµРЅРёРµ', icon:'рџ”Ґ', bg:'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
    meals: {
      'Р—Р°РІС‚СЂР°Рє': [
        {name:'РћРІСЃСЏРЅРєР° РЅР° РІРѕРґРµ СЃ СЏР№С†Р°РјРё',kcal:300,protein:20,fat:8,carbs:38,foods:'РћРІСЃСЏРЅРєР° РЅР° РІРѕРґРµ 80Рі, СЏР№С†Р° РІР°СЂС‘РЅС‹Рµ 2С€С‚, РѕРіСѓСЂРµС†'},
        {name:'РўРІРѕСЂРѕРі СЃ СЏР±Р»РѕРєРѕРј',kcal:220,protein:28,fat:2,carbs:24,foods:'РўРІРѕСЂРѕРі 0% 200Рі, СЏР±Р»РѕРєРѕ 1С€С‚'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ Р·РµР»РµРЅСЊСЋ',kcal:180,protein:24,fat:6,carbs:4,foods:'Р‘РµР»РєРё 5С€С‚, 1 Р¶РµР»С‚РѕРє, РїРѕРјРёРґРѕСЂ, Р·РµР»РµРЅСЊ'},
        {name:'Р“СЂРµС‡РєР° СЃ СЏР№С†РѕРј',kcal:280,protein:18,fat:8,carbs:36,foods:'Р“СЂРµС‡РєР° 80Рі, СЏР№С†Рѕ РІР°СЂС‘РЅРѕРµ 1С€С‚, РѕРіСѓСЂРµС†'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ СЃ СЏРіРѕРґР°РјРё',kcal:200,protein:18,fat:2,carbs:28,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 200Рі, СЏРіРѕРґС‹ 80Рі'},
        {name:'РЇР№С†Р° РїР°С€РѕС‚ СЃ РїРѕРјРёРґРѕСЂРѕРј',kcal:200,protein:18,fat:12,carbs:4,foods:'РЇР№С†Р° РїР°С€РѕС‚ 2С€С‚, РїРѕРјРёРґРѕСЂ, Р·РµР»РµРЅСЊ'},
        {name:'РћРІСЃСЏРЅРєР° СЃ СЏРіРѕРґР°РјРё',kcal:270,protein:10,fat:4,carbs:50,foods:'РћРІСЃСЏРЅРєР° РЅР° РІРѕРґРµ 80Рі, СЏРіРѕРґС‹ СЃРІРµР¶РёРµ 80Рі, РјС‘Рґ ВЅ С‡.Р».'},
        {name:'РўРІРѕСЂРѕРі СЃ РѕРіСѓСЂС†РѕРј Рё Р·РµР»РµРЅСЊСЋ',kcal:200,protein:26,fat:2,carbs:18,foods:'РўРІРѕСЂРѕРі 0% 200Рі, РѕРіСѓСЂРµС†, РїРѕРјРёРґРѕСЂ, Р·РµР»РµРЅСЊ'},
        {name:'РЇРёС‡РЅРёС†Р° СЃ РїРѕРјРёРґРѕСЂР°РјРё',kcal:210,protein:16,fat:14,carbs:4,foods:'РЇР№С†Р° 2С€С‚, РїРѕРјРёРґРѕСЂ, РјР°СЃР»Рѕ 5Рі'},
        {name:'РљРµС„РёСЂ СЃ РѕРІСЃСЏРЅС‹РјРё С…Р»РѕРїСЊСЏРјРё',kcal:250,protein:14,fat:3,carbs:42,foods:'РљРµС„РёСЂ 0% 250РјР», РіРµСЂРєСѓР»РµСЃ 50Рі'},
        {name:'РўРІРѕСЂРѕР¶РЅРѕРµ СЃСѓС„Р»Рµ',kcal:200,protein:24,fat:2,carbs:22,foods:'РўРІРѕСЂРѕРі 0% 200Рі, СЏР№С†Рѕ 1С€С‚, Р·Р°РїРµС‡СЊ'},
        {name:'РЎРјСѓР·Рё РёР· РєРµС„РёСЂР° СЃ СЏРіРѕРґР°РјРё',kcal:220,protein:14,fat:2,carbs:36,foods:'РљРµС„РёСЂ 1% 250РјР», Р·Р°РјРѕСЂРѕР¶РµРЅРЅС‹Рµ СЏРіРѕРґС‹ 100Рі'},
        {name:'Р РёСЃРѕРІР°СЏ РєР°С€Р° РЅР° РІРѕРґРµ',kcal:280,protein:14,fat:6,carbs:44,foods:'Р РёСЃ 70Рі РЅР° РІРѕРґРµ, СЏР№С†Рѕ РІР°СЂС‘РЅРѕРµ 1С€С‚'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:220,protein:26,fat:8,carbs:8,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, Р±СЂРѕРєРєРѕР»Рё 100Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РѕРіСѓСЂС†РѕРј',kcal:180,protein:24,fat:2,carbs:14,foods:'РўРІРѕСЂРѕРі 0% 180Рі, РѕРіСѓСЂРµС†, СѓРєСЂРѕРї'},
        {name:'РЇР№С†Р° РІР°СЂС‘РЅС‹Рµ СЃ РѕРІРѕС‰Р°РјРё',kcal:220,protein:18,fat:12,carbs:8,foods:'РЇР№С†Р° 2С€С‚, РѕРіСѓСЂРµС†, РїРѕРјРёРґРѕСЂ, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°'},
        {name:'Р“СЂРµС‡РЅРµРІР°СЏ РєР°С€Р° РЅР° РІРѕРґРµ',kcal:240,protein:12,fat:4,carbs:42,foods:'Р“СЂРµС‡РєР° 80Рі, РјР°СЃР»Рѕ 5Рі'},
        {name:'РћРІСЃСЏРЅРєР° СЃ СЏР±Р»РѕРєРѕРј Рё РєРѕСЂРёС†РµР№',kcal:270,protein:8,fat:4,carbs:52,foods:'РћРІСЃСЏРЅРєР° РЅР° РІРѕРґРµ 80Рі, СЏР±Р»РѕРєРѕ, РєРѕСЂРёС†Р°'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІС‹Р№ СЃРјСѓР·Рё',kcal:250,protein:30,fat:2,carbs:28,foods:'РџСЂРѕС‚РµРёРЅ 1 РјРµСЂРЅР°СЏ, РєРµС„РёСЂ 0% 250РјР», СЏРіРѕРґС‹'},
        {name:'РћРјР»РµС‚ СЃ Р·РµР»РµРЅСЊСЋ',kcal:220,protein:18,fat:14,carbs:4,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, РјРѕР»РѕРєРѕ 50РјР», Р·РµР»РµРЅСЊ, РјР°СЃР»Рѕ 5Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РєРѕСЂРёС†РµР№ Рё СЏР±Р»РѕРєРѕРј',kcal:190,protein:26,fat:2,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 200Рі, РєРѕСЂРёС†Р°, ВЅ СЏР±Р»РѕРєР°'},
        {name:'РЇР№С†Р° СЃ Р°РІРѕРєР°РґРѕ',kcal:280,protein:18,fat:20,carbs:6,foods:'РЇР№С†Р° РІР°СЂС‘РЅС‹Рµ 2С€С‚, Р°РІРѕРєР°РґРѕ ВЅС€С‚'},
        {name:'РћРІСЃСЏРЅС‹Рµ РџРџ-РѕР»Р°РґСЊРё',kcal:280,protein:18,fat:6,carbs:38,foods:'РћРІСЃСЏРЅРєР° 60Рі, СЏР№С†Рѕ 1С€С‚, РєРµС„РёСЂ 50РјР», Р·Р°РїРµС‡СЊ'},
        {name:'РўРІРѕСЂРѕРі СЃ РіСЂРµР№РїС„СЂСѓС‚РѕРј',kcal:200,protein:24,fat:2,carbs:22,foods:'РўРІРѕСЂРѕРі 0% 180Рі, РіСЂРµР№РїС„СЂСѓС‚ ВЅС€С‚'},
        {name:'РљРµС„РёСЂ СЃ РѕС‚СЂСѓР±СЏРјРё',kcal:200,protein:12,fat:2,carbs:32,foods:'РљРµС„РёСЂ 1% 300РјР», РїС€РµРЅРёС‡РЅС‹Рµ РѕС‚СЂСѓР±Рё 30Рі'},
        {name:'РЇРёС‡РЅС‹Рµ Р±РµР»РєРё СЃ СЂРёСЃРѕРј',kcal:250,protein:22,fat:2,carbs:36,foods:'Р‘РµР»РєРё 4С€С‚, СЂРёСЃ 70Рі'},
        {name:'РўРІРѕСЂРѕР¶РЅР°СЏ Р·Р°РїРµРєР°РЅРєР° Р±РµР· СЃР°С…Р°СЂР°',kcal:220,protein:28,fat:4,carbs:18,foods:'РўРІРѕСЂРѕРі 0% 200Рі, СЏР№С†Рѕ 1С€С‚, Р·Р°РїРµРєР°РµРј'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ С€РїРёРЅР°С‚РѕРј',kcal:200,protein:22,fat:8,carbs:6,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, С€РїРёРЅР°С‚ 80Рі'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІР°СЏ РєР°С€Р°',kcal:280,protein:28,fat:4,carbs:36,foods:'РћРІСЃСЏРЅРєР° 60Рі, РїСЂРѕС‚РµРёРЅ 1 РјРµСЂРЅР°СЏ, РІРѕРґР°'},
        {name:'Р—РµР»С‘РЅС‹Р№ СЃРјСѓР·Рё',kcal:180,protein:12,fat:2,carbs:28,foods:'РљРµС„РёСЂ 200РјР», РѕРіСѓСЂРµС†, С€РїРёРЅР°С‚, СЏР±Р»РѕРєРѕ'},
        {name:'Р РёСЃРѕРІР°СЏ РєР°С€Р° Р±РµР· РјР°СЃР»Р°',kcal:220,protein:8,fat:2,carbs:44,foods:'Р РёСЃ 60Рі РЅР° РІРѕРґРµ, РєРѕСЂРёС†Р°, СЏР±Р»РѕРєРѕ'},
        {name:'РўРІРѕСЂРѕРі СЃ СЃРµРјРµРЅР°РјРё Р»СЊРЅР°',kcal:200,protein:24,fat:4,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 180Рі, СЃРµРјРµРЅР° Р»СЊРЅР° 10Рі'},
        {name:'Р‘РµР»РѕРє СЃ СЂРёСЃРѕРІС‹РјРё С…Р»РµР±С†Р°РјРё',kcal:220,protein:20,fat:2,carbs:28,foods:'РЇРёС‡РЅС‹Рµ Р±РµР»РєРё 4С€С‚, С…Р»РµР±С†С‹ 3С€С‚'},
        {name:'РЎРјСѓР·Рё РєРµС„РёСЂ СЃ РѕРіСѓСЂС†РѕРј',kcal:130,protein:8,fat:0,carbs:20,foods:'РљРµС„РёСЂ 200РјР», РѕРіСѓСЂРµС†, С€РїРёРЅР°С‚, Р»С‘Рґ'},
        {name:'РўРІРѕСЂРѕРі СЃ Р»СЊРЅСЏРЅС‹Рј РјР°СЃР»РѕРј',kcal:200,protein:24,fat:6,carbs:10,foods:'РўРІРѕСЂРѕРі 0% 180Рі, Р»СЊРЅСЏРЅРѕРµ РјР°СЃР»Рѕ ВЅ С‡.Р».'},
        {name:'РЇР№С†Р° СЃ Р»РёСЃС‚СЊСЏРјРё СЃР°Р»Р°С‚Р°',kcal:180,protein:14,fat:10,carbs:6,foods:'РЇР№С†Р° РІР°СЂС‘РЅС‹Рµ 2С€С‚, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°, РѕРіСѓСЂРµС†'},
        {name:'РћРІСЃСЏРЅРєР° СЃ РїСЂРѕС‚РµРёРЅРѕРј',kcal:260,protein:26,fat:4,carbs:32,foods:'РћРІСЃСЏРЅРєР° 60Рі, РїСЂРѕС‚РµРёРЅ ВЅ РјРµСЂРЅРѕР№, РІРѕРґР°'},
        {name:'РўРІРѕСЂРѕР¶РЅР°СЏ РїР°СЃС‚Р° СЃ РѕРіСѓСЂС†РѕРј',kcal:180,protein:22,fat:1,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 170Рі, РѕРіСѓСЂРµС†, СѓРєСЂРѕРї, С‡РµСЃРЅРѕРє'},
        {name:'Р“СЂРµС‡РЅРµРІР°СЏ РєР°С€Р° СЃ СЏРёС‡РЅС‹Рј Р±РµР»РєРѕРј',kcal:230,protein:18,fat:2,carbs:36,foods:'Р“СЂРµС‡РєР° 70Рі, Р±РµР»РєРё 3С€С‚, Р·РµР»РµРЅСЊ'},
        {name:'РЎРјСѓР·Рё СЏРіРѕРґРЅС‹Р№ СЃ Р»СЊРЅРѕРј',kcal:200,protein:12,fat:3,carbs:30,foods:'РљРµС„РёСЂ 0% 200РјР», СЏРіРѕРґС‹ 80Рі, Р»СЊРЅСЏРЅС‹Рµ СЃРµРјРµРЅР° 10Рі'},
        {name:'РЇР№С†Р° РїР°С€РѕС‚ СЃ Р»РёСЃС‚СЊСЏРјРё С€РїРёРЅР°С‚Р°',kcal:190,protein:14,fat:10,carbs:8,foods:'РЇР№С†Р° РїР°С€РѕС‚ 2С€С‚, С€РїРёРЅР°С‚ 80Рі'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ СЃ РѕРіСѓСЂС†РѕРј',kcal:160,protein:16,fat:0,carbs:20,foods:'Р™РѕРіСѓСЂС‚ 0% 150Рі, РѕРіСѓСЂРµС† 1С€С‚, Р·РµР»РµРЅСЊ'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ РїРµСЂС†РµРј',kcal:190,protein:22,fat:6,carbs:10,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, РїРµСЂРµС† 80Рі'},
        {name:'РћРІСЃСЏРЅРєР° СЃ С‚С‹РєРІРµРЅРЅС‹РјРё СЃРµРјРµС‡РєР°РјРё',kcal:260,protein:10,fat:8,carbs:36,foods:'РћРІСЃСЏРЅРєР° 70Рі РЅР° РІРѕРґРµ, С‚С‹РєРІРµРЅРЅС‹Рµ СЃРµРјРµС‡РєРё 15Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РєР»СЋРєРІРѕР№',kcal:190,protein:24,fat:1,carbs:20,foods:'РўРІРѕСЂРѕРі 0% 180Рі, РєР»СЋРєРІР° 50Рі'},
        {name:'РљРµС„РёСЂ СЃ СЃРµРјРµРЅР°РјРё С‡РёР°',kcal:180,protein:10,fat:3,carbs:24,foods:'РљРµС„РёСЂ 0% 250РјР», СЃРµРјРµРЅР° С‡РёР° 15Рі'},
        {name:'РћРјР»РµС‚ Р±РµР· Р¶РµР»С‚РєРѕРІ СЃ РїРѕРјРёРґРѕСЂРѕРј',kcal:170,protein:22,fat:4,carbs:10,foods:'Р‘РµР»РєРё 5С€С‚, 1 Р¶РµР»С‚РѕРє, РїРѕРјРёРґРѕСЂ'},
        {name:'РћРІРѕС‰РЅРѕР№ РѕРјР»РµС‚ РёР· Р±РµР»РєРѕРІ',kcal:180,protein:22,fat:5,carbs:10,foods:'Р‘РµР»РєРё 4С€С‚, РєР°Р±Р°С‡РѕРє, РїРѕРјРёРґРѕСЂ, РїРµСЂРµС†'},
        {name:'РљРµС„РёСЂРЅС‹Р№ СЃСѓРї СЃ РѕРіСѓСЂС†РѕРј',kcal:130,protein:8,fat:1,carbs:18,foods:'РљРµС„РёСЂ 200РјР», РѕРіСѓСЂРµС† 200Рі, Р·РµР»РµРЅСЊ, С‡РµСЃРЅРѕРє'},
        {name:'Р‘РµР»РѕРє СЃ РіСЂРµС‡РєРѕР№',kcal:230,protein:20,fat:4,carbs:30,foods:'Р“СЂРµС‡РєР° 70Рі, СЏРёС‡РЅС‹Рµ Р±РµР»РєРё 3С€С‚ РІР°СЂС‘РЅС‹С…'},
        {name:'РўРІРѕСЂРѕР¶РЅС‹Р№ СЃРјСѓР·Рё СЃ С€РїРёРЅР°С‚РѕРј',kcal:190,protein:22,fat:1,carbs:22,foods:'РўРІРѕСЂРѕРі 0% 150Рі, С€РїРёРЅР°С‚ 50Рі, СЏР±Р»РѕРєРѕ, РІРѕРґР°'},
        {name:'РћРІСЃСЏРЅРєР° СЃ РєР°РєР°Рѕ',kcal:250,protein:10,fat:4,carbs:44,foods:'РћРІСЃСЏРЅРєР° 70Рі РЅР° РІРѕРґРµ, РєР°РєР°Рѕ 1 С‡.Р»., СЃС‚РµРІРёСЏ'},
        {name:'Р РёСЃРѕРІС‹Рµ С…Р»РµР±С†С‹ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:200,protein:16,fat:1,carbs:30,foods:'РҐР»РµР±С†С‹ 3С€С‚ СЂРёСЃРѕРІС‹Рµ, С‚РІРѕСЂРѕРі 0% 100Рі'},
        {name:'Р—РµР»С‘РЅС‹Р№ РєРѕРєС‚РµР№Р»СЊ',kcal:160,protein:8,fat:1,carbs:28,foods:'РЁРїРёРЅР°С‚, РѕРіСѓСЂРµС†, СЏР±Р»РѕРєРѕ, СЃРµР»СЊРґРµСЂРµР№, РІРѕРґР°'},
        {name:'РљРµС„РёСЂ СЃ РѕС‚СЂСѓР±СЏРјРё Рё СЏР±Р»РѕРєРѕРј',kcal:210,protein:10,fat:1,carbs:38,foods:'РљРµС„РёСЂ 0% 250РјР», РѕС‚СЂСѓР±Рё 25Рі, СЏР±Р»РѕРєРѕ'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:190,protein:24,fat:6,carbs:8,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, Р±СЂРѕРєРєРѕР»Рё 100Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РѕРіСѓСЂС†РѕРј Рё С‡РµСЃРЅРѕРєРѕРј',kcal:180,protein:24,fat:1,carbs:14,foods:'РўРІРѕСЂРѕРі 0% 180Рі, РѕРіСѓСЂРµС†, С‡РµСЃРЅРѕРє, Р·РµР»РµРЅСЊ'},
        {name:'РЎРјСѓР·Рё РєРµС„РёСЂ СЃ СЏРіРѕРґР°РјРё Рё Р»СЊРЅРѕРј',kcal:200,protein:10,fat:2,carbs:32,foods:'РљРµС„РёСЂ 0% 200РјР», СЏРіРѕРґС‹ 70Рі, Р»СЊРЅСЏРЅС‹Рµ СЃРµРјРµРЅР° 10Рі'},
        {name:'РЇР№С†Р° СЃ Р°РІРѕРєР°РґРѕ Рё Р·РµР»РµРЅСЊСЋ',kcal:240,protein:16,fat:18,carbs:6,foods:'РЇР№С†Р° РІР°СЂС‘РЅС‹Рµ 2С€С‚, Р°РІРѕРєР°РґРѕ Вј, Р·РµР»РµРЅСЊ'}
      ],
      'РћР±РµРґ': [
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РіСЂРµС‡РєРѕР№',kcal:400,protein:48,fat:6,carbs:40,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, РіСЂРµС‡РєР° 100Рі, РѕРіСѓСЂРµС†'},
        {name:'РўСѓРЅРµС† СЃ СЂРёСЃРѕРј',kcal:380,protein:42,fat:4,carbs:42,foods:'РўСѓРЅРµС† РІ СЃРѕР±СЃС‚РІРµРЅРЅРѕРј СЃРѕРєСѓ 200Рі, СЂРёСЃ 90Рі, РїРѕРјРёРґРѕСЂ'},
        {name:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї Р±РµР· РєР°СЂС‚РѕС„РµР»СЏ',kcal:300,protein:32,fat:8,carbs:24,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР» СЃ РіСЂСѓРґРєРѕР№ 150Рі, Р·РµР»РµРЅСЊ'},
        {name:'Р С‹Р±Р° РЅР° РїР°СЂСѓ СЃ РѕРІРѕС‰Р°РјРё',kcal:320,protein:40,fat:6,carbs:22,foods:'РўСЂРµСЃРєР° РЅР° РїР°СЂСѓ 250Рі, С‚СѓС€С‘РЅС‹Рµ РєР°Р±Р°С‡РєРё, РїРѕРјРёРґРѕСЂ'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ РіСЂРµС‡РєРѕР№',kcal:420,protein:48,fat:10,carbs:38,foods:'Р“РѕРІСЏРґРёРЅР° РІР°СЂС‘РЅР°СЏ 200Рі, РіСЂРµС‡РєР° 100Рі, СЃР°Р»Р°С‚ РёР· СЃРІРµР¶РёС… РѕРІРѕС‰РµР№'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ СЂРёСЃРѕРј',kcal:380,protein:46,fat:5,carbs:40,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, СЂРёСЃ 90Рі, РѕРіСѓСЂРµС†, РїРѕРјРёРґРѕСЂ'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:380,protein:42,fat:18,carbs:10,foods:'Р›РѕСЃРѕСЃСЊ 200Рі, Р±СЂРѕРєРєРѕР»Рё 200Рі РЅР° РїР°СЂСѓ'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ СЃР°Р»Р°С‚ СЃ РєСѓСЂРёС†РµР№',kcal:380,protein:40,fat:18,carbs:16,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, РїРѕРјРёРґРѕСЂ, РѕРіСѓСЂРµС†, РјР°СЃР»РёРЅС‹, СЃС‹СЂ С„РµС‚Р° 40Рі'},
        {name:'РўСѓРЅРµС† СЃ РѕРІРѕС‰РЅС‹Рј СЃР°Р»Р°С‚РѕРј',kcal:320,protein:40,fat:6,carbs:20,foods:'РўСѓРЅРµС† 200Рі, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°, РїРѕРјРёРґРѕСЂ, РѕРіСѓСЂРµС†, РѕР»РёРІРєРѕРІРѕРµ РјР°СЃР»Рѕ 5Рі'},
        {name:'Р“СЂРµС‡РєР° СЃ РєСѓСЂРёРЅС‹Рј С„Р°СЂС€РµРј',kcal:400,protein:42,fat:10,carbs:40,foods:'РљСѓСЂРёРЅС‹Р№ С„Р°СЂС€ 200Рі, РіСЂРµС‡РєР° 100Рі'},
        {name:'Р‘РѕСЂС‰ РЅР° РєСѓСЂРёРЅРѕРј Р±СѓР»СЊРѕРЅРµ',kcal:300,protein:28,fat:6,carbs:32,foods:'Р‘РѕСЂС‰ 400РјР», РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 100Рі'},
        {name:'РћРІРѕС‰РЅРѕР№ СЃСѓРї СЃ РєСѓСЂРёС†РµР№',kcal:280,protein:28,fat:5,carbs:30,foods:'РћРІРѕС‰РЅРѕР№ СЃСѓРї СЃ РєСѓСЂРёРЅРѕР№ РіСЂСѓРґРєРѕР№ 150Рі'},
        {name:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:380,protein:42,fat:6,carbs:40,foods:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ 200Рі, РїРµСЂР»РѕРІРєР° 100Рі'},
        {name:'Р С‹Р±РЅС‹Р№ СЃСѓРї',kcal:280,protein:32,fat:6,carbs:24,foods:'РЈС…Р° РёР· С‚СЂРµСЃРєРё 400РјР», С‚СЂРµСЃРєР° 150Рі'},
        {name:'Р“РѕРІСЏР¶РёР№ С„Р°СЂС€ СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:360,protein:38,fat:16,carbs:18,foods:'Р“РѕРІСЏР¶РёР№ С„Р°СЂС€ 200Рі, С‚СѓС€С‘РЅС‹Рµ РєР°Р±Р°С‡РєРё, РїРµСЂРµС†'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:320,protein:42,fat:6,carbs:22,foods:'Р“СЂСѓРґРєР° 220Рі, Р±СЂРѕРєРєРѕР»Рё, РјРѕСЂРєРѕРІСЊ, РєР°Р±Р°С‡РѕРє'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ СЂРёСЃРѕРј',kcal:400,protein:40,fat:14,carbs:30,foods:'Р›РѕСЃРѕСЃСЊ 180Рі, СЂРёСЃ 80Рі, Р»РёРјРѕРЅ'},
        {name:'РўСѓС€С‘РЅР°СЏ С‡РµС‡РµРІРёС†Р° СЃ РєСѓСЂРёС†РµР№',kcal:380,protein:40,fat:6,carbs:42,foods:'Р§РµС‡РµРІРёС†Р° 100Рі, РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 150Рі'},
        {name:'Р“РѕРІСЏР¶РёР№ СЃСѓРї СЃ РѕРІРѕС‰Р°РјРё',kcal:300,protein:30,fat:8,carbs:26,foods:'Р“РѕРІСЏР¶РёР№ СЃСѓРї 400РјР», РіРѕРІСЏРґРёРЅР° 100Рі'},
        {name:'РљСѓСЂРёРЅС‹Рµ С‚РµС„С‚РµР»Рё СЃ РіСЂРµС‡РєРѕР№',kcal:380,protein:44,fat:8,carbs:36,foods:'РўРµС„С‚РµР»Рё РєСѓСЂРёРЅС‹Рµ 3С€С‚, РіСЂРµС‡РєР° 100Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ С‚СЂРµСЃРєР° СЃ СЂРёСЃРѕРј',kcal:360,protein:38,fat:6,carbs:38,foods:'РўСЂРµСЃРєР° Р·Р°РїРµС‡С‘РЅРЅР°СЏ 220Рі, СЂРёСЃ 80Рі'},
        {name:'РўСѓРЅРµС† СЃ РіСЂРµС‡РєРѕР№',kcal:360,protein:42,fat:4,carbs:38,foods:'РўСѓРЅРµС† РІ СЃРѕР±СЃС‚РІРµРЅРЅРѕРј СЃРѕРєСѓ 200Рі, РіСЂРµС‡РєР° 100Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:370,protein:42,fat:5,carbs:40,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, РїРµСЂР»РѕРІРєР° 100Рі'},
        {name:'Р©Рё РЅР° РєСѓСЂРёРЅРѕРј Р±СѓР»СЊРѕРЅРµ',kcal:280,protein:26,fat:5,carbs:32,foods:'Р©Рё 400РјР», РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 100Рі'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:360,protein:40,fat:12,carbs:22,foods:'Р“РѕРІСЏРґРёРЅР° 200Рі, С‚СѓС€С‘РЅС‹Рµ РєР°Р±Р°С‡РєРё, РїРµСЂРµС†'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ Р±РµР· РєРѕР¶Рё СЃ РіСЂРµС‡РєРѕР№',kcal:400,protein:44,fat:12,carbs:30,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ 220Рі Р±РµР· РєРѕР¶Рё, РіСЂРµС‡РєР° 90Рі'},
        {name:'Р С‹Р±Р° СЃ РѕРІРѕС‰Р°РјРё РІ РґСѓС…РѕРІРєРµ',kcal:300,protein:38,fat:6,carbs:20,foods:'Р“РѕСЂР±СѓС€Р° 220Рі, РєР°Р±Р°С‡РѕРє, РїРѕРјРёРґРѕСЂ, РїРµСЂРµС†'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С„Р°СЃРѕР»СЊСЋ',kcal:380,protein:44,fat:5,carbs:36,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, РєРѕРЅСЃРµСЂРІРёСЂРѕРІР°РЅРЅР°СЏ С„Р°СЃРѕР»СЊ 100Рі'},
        {name:'РўСѓС€С‘РЅР°СЏ РіРѕРІСЏРґРёРЅР° СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:400,protein:42,fat:10,carbs:36,foods:'Р“РѕРІСЏРґРёРЅР° 200Рі, РїРµСЂР»РѕРІРєР° 100Рі'},
        {name:'РўСѓРЅРµС† СЃ Р±РµР»РѕР№ С„Р°СЃРѕР»СЊСЋ',kcal:360,protein:44,fat:4,carbs:34,foods:'РўСѓРЅРµС† 200Рі, Р±РµР»Р°СЏ С„Р°СЃРѕР»СЊ 100Рі, Р·РµР»РµРЅСЊ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ Р±СЂРѕРєРєРѕР»Рё Рё СЂРёСЃРѕРј',kcal:380,protein:42,fat:5,carbs:38,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, Р±СЂРѕРєРєРѕР»Рё 150Рі, СЂРёСЃ 80Рі'},
        {name:'РўСѓРЅРµС† СЃ РєСѓСЃ-РєСѓСЃРѕРј',kcal:360,protein:40,fat:4,carbs:38,foods:'РўСѓРЅРµС† 180Рі, РєСѓСЃ-РєСѓСЃ 80Рі, Р·РµР»РµРЅСЊ'},
        {name:'Р С‹Р±Р° РІ С‚РѕРјР°С‚РЅРѕРј СЃРѕСѓСЃРµ',kcal:320,protein:38,fat:6,carbs:26,foods:'РўСЂРµСЃРєР° 220Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ Р±РµР· РјР°СЃР»Р°, РѕРІРѕС‰Рё'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ СЃ С‚СѓС€С‘РЅС‹РјРё РєР°Р±Р°С‡РєР°РјРё',kcal:360,protein:40,fat:10,carbs:22,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ 200Рі Р±РµР· РєРѕР¶Рё, РєР°Р±Р°С‡РєРё 250Рі'},
        {name:'Р›С‘РіРєРёР№ РєСѓСЂРёРЅС‹Р№ СЃСѓРї СЃ РѕРІРѕС‰Р°РјРё',kcal:280,protein:28,fat:5,carbs:28,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР», РјРѕСЂРєРѕРІСЊ, РєР°Р±Р°С‡РѕРє, РіСЂСѓРґРєР° 120Рі'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ РіСЂРµС‡РєРѕР№ Рё Р±СЂРѕРєРєРѕР»Рё',kcal:400,protein:42,fat:10,carbs:36,foods:'Р“РѕРІСЏРґРёРЅР° 190Рі, РіСЂРµС‡РєР° 90Рі, Р±СЂРѕРєРєРѕР»Рё 100Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РєСѓСЂРёС†Р° СЃ РєР°Р±Р°С‡РєРѕРј',kcal:300,protein:40,fat:6,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, РєР°Р±Р°С‡РѕРє, РїРѕРјРёРґРѕСЂ'},
        {name:'РўСѓРЅРµС† СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:360,protein:40,fat:4,carbs:38,foods:'РўСѓРЅРµС† 190Рі, РїРµСЂР»РѕРІРєР° 90Рі'},
        {name:'Р С‹Р±Р° Р·Р°РїРµС‡С‘РЅРЅР°СЏ СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:300,protein:38,fat:5,carbs:20,foods:'РўСЂРµСЃРєР° 220Рі, Р±СЂРѕРєРєРѕР»Рё 200Рі'},
        {name:'РљСѓСЂРёРЅС‹Рµ С‚РµС„С‚РµР»Рё СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:370,protein:42,fat:7,carbs:34,foods:'РўРµС„С‚РµР»Рё РєСѓСЂРёРЅС‹Рµ 3С€С‚, РїРµСЂР»РѕРІРєР° 90Рі'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ Р·РµР»С‘РЅС‹Рј РіРѕСЂРѕС€РєРѕРј',kcal:360,protein:38,fat:14,carbs:20,foods:'Р›РѕСЃРѕСЃСЊ 170Рі, РіРѕСЂРѕС€РµРє 100Рі, Р»РёРјРѕРЅ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РєСѓСЂРёС†Р° СЃ С„Р°СЃРѕР»СЊСЋ',kcal:370,protein:42,fat:5,carbs:34,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 190Рі, С„Р°СЃРѕР»СЊ 100Рі'},
        {name:'РћРІРѕС‰РЅРѕР№ СЃСѓРї СЃ С‚СѓРЅС†РѕРј',kcal:280,protein:32,fat:4,carbs:26,foods:'РЎСѓРї РёР· РєР°Р±Р°С‡РєРѕРІ Рё РїРѕРјРёРґРѕСЂРѕРІ 400РјР», С‚СѓРЅРµС† 120Рі'},
        {name:'Р С‹Р±РЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ РіСЂРµС‡РєРѕР№',kcal:360,protein:38,fat:8,carbs:34,foods:'Р С‹Р±РЅС‹Рµ РєРѕС‚Р»РµС‚С‹ 3С€С‚, РіСЂРµС‡РєР° 90Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° РІ РіРѕСЂС‡РёС†Рµ',kcal:310,protein:42,fat:8,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 220Рі РІ РіРѕСЂС‡РёС†Рµ, С‚СѓС€С‘РЅС‹Рµ РѕРІРѕС‰Рё'},
        {name:'РўСѓС€С‘РЅР°СЏ РіРѕРІСЏРґРёРЅР° СЃ С‡РµС‡РµРІРёС†РµР№',kcal:400,protein:42,fat:10,carbs:36,foods:'Р“РѕРІСЏРґРёРЅР° 190Рі, С‡РµС‡РµРІРёС†Р° 90Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РіРѕСЂР±СѓС€Р° СЃ РіСЂРµС‡РєРѕР№',kcal:360,protein:40,fat:8,carbs:34,foods:'Р“РѕСЂР±СѓС€Р° 210Рі, РіСЂРµС‡РєР° 90Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С€Р°РјРїРёРЅСЊРѕРЅР°РјРё',kcal:310,protein:42,fat:7,carbs:16,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 220Рі, С€Р°РјРїРёРЅСЊРѕРЅС‹ 200Рі'},
        {name:'РўСѓРЅРµС† СЃ Р±СЂРѕРєРєРѕР»Рё Рё СЂРёСЃРѕРј',kcal:370,protein:40,fat:4,carbs:38,foods:'РўСѓРЅРµС† 180Рі, СЂРёСЃ 80Рі, Р±СЂРѕРєРєРѕР»Рё 120Рі'},
        {name:'Р“РѕРІСЏР¶СЊРё С‚РµС„С‚РµР»Рё СЃ РіСЂРµС‡РєРѕР№',kcal:390,protein:42,fat:12,carbs:32,foods:'Р“РѕРІСЏР¶СЊРё С‚РµС„С‚РµР»Рё 3С€С‚, РіСЂРµС‡РєР° 90Рі'},
        {name:'Р С‹Р±Р° СЃ Р·РµР»С‘РЅС‹Рј РіРѕСЂРѕС€РєРѕРј',kcal:310,protein:38,fat:5,carbs:24,foods:'РўСЂРµСЃРєР° 220Рі, РіРѕСЂРѕС€РµРє 100Рі, Р»РёРјРѕРЅ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РєСѓСЂРёС†Р° СЃ Р±Р°РєР»Р°Р¶Р°РЅРѕРј',kcal:300,protein:40,fat:6,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, Р±Р°РєР»Р°Р¶Р°РЅ 200Рі'},
        {name:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї СЃ С‡РµС‡РµРІРёС†РµР№',kcal:320,protein:34,fat:6,carbs:34,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР», С‡РµС‡РµРІРёС†Р° 60Рі, РіСЂСѓРґРєР° 120Рі'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ РєР°РїСѓСЃС‚РѕР№',kcal:330,protein:36,fat:14,carbs:14,foods:'Р›РѕСЃРѕСЃСЊ 170Рі, С‚СѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° 250Рі'},
        {name:'РўСѓРЅРµС† СЃ Р·РµР»С‘РЅРѕР№ С„Р°СЃРѕР»СЊСЋ',kcal:300,protein:38,fat:3,carbs:24,foods:'РўСѓРЅРµС† 190Рі, СЃС‚СЂСѓС‡РєРѕРІР°СЏ С„Р°СЃРѕР»СЊ 150Рі'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ С‚РѕРјР°С‚РЅС‹Рј СЃРѕСѓСЃРѕРј Рё СЂРёСЃРѕРј',kcal:350,protein:38,fat:5,carbs:36,foods:'Р“РѕСЂР±СѓС€Р° 200Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ, СЂРёСЃ 80Рі'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С‚СѓС€С‘РЅРѕР№ РјРѕСЂРєРѕРІСЊСЋ',kcal:360,protein:40,fat:10,carbs:24,foods:'Р“РѕРІСЏРґРёРЅР° 200Рі, РјРѕСЂРєРѕРІСЊ С‚СѓС€С‘РЅР°СЏ 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‚С‹РєРІРѕР№',kcal:310,protein:40,fat:5,carbs:24,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, С‚С‹РєРІР° С‚СѓС€С‘РЅР°СЏ 200Рі'},
        {name:'Р С‹Р±РЅС‹Р№ СЃР°Р»Р°С‚ СЃ СЂРёСЃРѕРј',kcal:340,protein:36,fat:4,carbs:38,foods:'РўСѓРЅРµС† 170Рі, СЂРёСЃ 80Рі, РѕРіСѓСЂРµС†, РїРѕРјРёРґРѕСЂ'}
      ],
      'РЈР¶РёРЅ': [
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:300,protein:42,fat:6,carbs:16,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, РєР°Р±Р°С‡РѕРє, РїРѕРјРёРґРѕСЂ, РїРµСЂРµС†'},
        {name:'Р С‹Р±Р° РЅР° РїР°СЂСѓ СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:260,protein:38,fat:5,carbs:12,foods:'РўСЂРµСЃРєР° РЅР° РїР°СЂСѓ 220Рі, Р±СЂРѕРєРєРѕР»Рё 200Рі'},
        {name:'РўСѓРЅРµС† СЃ РѕРіСѓСЂРµС‡РЅС‹Рј СЃР°Р»Р°С‚РѕРј',kcal:280,protein:38,fat:4,carbs:20,foods:'РўСѓРЅРµС† РІ СЃРѕР±СЃС‚РІРµРЅРЅРѕРј СЃРѕРєСѓ 200Рі, РѕРіСѓСЂС†С‹ 200Рі, Р·РµР»РµРЅСЊ'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С‚СѓС€С‘РЅС‹РјРё РєР°Р±Р°С‡РєР°РјРё',kcal:320,protein:38,fat:12,carbs:12,foods:'Р“РѕРІСЏРґРёРЅР° РѕС‚РІР°СЂРЅР°СЏ 200Рі, РєР°Р±Р°С‡РєРё С‚СѓС€С‘РЅС‹Рµ 200Рі'},
        {name:'РљСѓСЂРёРЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:280,protein:36,fat:8,carbs:14,foods:'РљРѕС‚Р»РµС‚С‹ РєСѓСЂРёРЅС‹Рµ 2С€С‚, С‚СѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р°, РјРѕСЂРєРѕРІСЊ'},
        {name:'Р›РѕСЃРѕСЃСЊ РЅР° РіСЂРёР»Рµ',kcal:300,protein:38,fat:14,carbs:4,foods:'Р›РѕСЃРѕСЃСЊ 200Рі, Р»РёРјРѕРЅ, Р·РµР»РµРЅСЊ'},
        {name:'РўСѓС€С‘РЅР°СЏ РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РїРµСЂС†РµРј',kcal:270,protein:40,fat:5,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 220Рі, РїРµСЂРµС†, РїРѕРјРёРґРѕСЂ, Р»СѓРє'},
        {name:'РўРІРѕСЂРѕРі СЃ РѕРіСѓСЂС†РѕРј',kcal:200,protein:26,fat:2,carbs:18,foods:'РўРІРѕСЂРѕРі 0% 200Рі, РѕРіСѓСЂРµС† 2С€С‚, Р·РµР»РµРЅСЊ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ СЂС‹Р±Р° СЃ РѕРІРѕС‰Р°РјРё',kcal:280,protein:38,fat:6,carbs:14,foods:'Р“РѕСЂР±СѓС€Р° 200Рі, РєР°Р±Р°С‡РѕРє, РїРѕРјРёРґРѕСЂ'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ РѕРІРѕС‰Р°РјРё',kcal:220,protein:24,fat:6,carbs:14,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, РїРѕРјРёРґРѕСЂ, РїРµСЂРµС†'},
        {name:'РўСѓРЅРµС† СЃ РїРѕРјРёРґРѕСЂР°РјРё',kcal:260,protein:36,fat:4,carbs:16,foods:'РўСѓРЅРµС† 200Рі, РїРѕРјРёРґРѕСЂС‹ 200Рі, Р·РµР»РµРЅСЊ, Р»РёРјРѕРЅ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° РЅР° РіСЂРёР»Рµ',kcal:250,protein:42,fat:5,carbs:4,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі РЅР° РіСЂРёР»Рµ, СЃРїРµС†РёРё'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ С‚СЂРµСЃРєР° СЃ Р»РёРјРѕРЅРѕРј',kcal:240,protein:40,fat:4,carbs:6,foods:'РўСЂРµСЃРєР° 220Рі, Р»РёРјРѕРЅ, Р·РµР»РµРЅСЊ, СЃРїРµС†РёРё'},
        {name:'Р“РѕРІСЏР¶РёР№ С„Р°СЂС€ СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:320,protein:36,fat:14,carbs:14,foods:'Р“РѕРІСЏР¶РёР№ С„Р°СЂС€ 180Рі, РєР°Р±Р°С‡РєРё, РїРµСЂРµС†'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ РЅР° РїР°СЂСѓ',kcal:280,protein:38,fat:12,carbs:4,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ 220Рі Р±РµР· РєРѕР¶Рё, СЃРїРµС†РёРё'},
        {name:'Р С‹Р±РЅС‹Рµ С‚РµС„С‚РµР»Рё СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:280,protein:34,fat:8,carbs:14,foods:'Р С‹Р±РЅС‹Рµ С‚РµС„С‚РµР»Рё 3С€С‚, Р±СЂРѕРєРєРѕР»Рё 200Рі'},
        {name:'РњРёРЅС‚Р°Р№ СЃ С‚СѓС€С‘РЅС‹РјРё РєР°Р±Р°С‡РєР°РјРё',kcal:240,protein:38,fat:3,carbs:14,foods:'РњРёРЅС‚Р°Р№ 250Рі, РєР°Р±Р°С‡РєРё 200Рі'},
        {name:'РљСѓСЂРёРЅС‹Р№ СЃР°Р»Р°С‚',kcal:280,protein:38,fat:8,carbs:12,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°, РѕРіСѓСЂРµС†, РїРѕРјРёРґРѕСЂ, РјР°СЃР»Рѕ 5Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РїРѕРјРёРґРѕСЂР°РјРё',kcal:200,protein:24,fat:2,carbs:18,foods:'РўРІРѕСЂРѕРі 0% 180Рі, РїРѕРјРёРґРѕСЂ, Р·РµР»РµРЅСЊ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ СЃРєСѓРјР±СЂРёСЏ',kcal:280,protein:30,fat:16,carbs:2,foods:'РЎРєСѓРјР±СЂРёСЏ 180Рі, Р»РёРјРѕРЅ, СЃРїРµС†РёРё'},
        {name:'РўСѓС€С‘РЅР°СЏ РєСѓСЂРёС†Р° СЃ РєР°РїСѓСЃС‚РѕР№',kcal:270,protein:38,fat:6,carbs:16,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, С‚СѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° 200Рі'},
        {name:'Р С‹Р±Р° СЃ С‚СѓС€С‘РЅРѕР№ РјРѕСЂРєРѕРІСЊСЋ',kcal:260,protein:36,fat:4,carbs:18,foods:'РўСЂРµСЃРєР° 200Рі, РјРѕСЂРєРѕРІСЊ 150Рі С‚СѓС€С‘РЅР°СЏ'},
        {name:'РћРјР»РµС‚ СЃРѕ С€РїРёРЅР°С‚РѕРј',kcal:230,protein:22,fat:12,carbs:8,foods:'РћРјР»РµС‚ 3 СЏР№С†Р°, С€РїРёРЅР°С‚ 80Рі, РјР°СЃР»Рѕ 5Рі'},
        {name:'РљСѓСЂРёРЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ РєР°Р±Р°С‡РєРѕРј',kcal:280,protein:36,fat:8,carbs:16,foods:'РљРѕС‚Р»РµС‚С‹ РєСѓСЂРёРЅС‹Рµ 2С€С‚, РєР°Р±Р°С‡РѕРє С‚СѓС€С‘РЅС‹Р№ 200Рі'},
        {name:'РўСѓРЅРµС† СЃ Р»РёСЃС‚СЊСЏРјРё СЃР°Р»Р°С‚Р°',kcal:240,protein:36,fat:4,carbs:14,foods:'РўСѓРЅРµС† 200Рі, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р° 100Рі, РѕРіСѓСЂРµС†, Р»РёРјРѕРЅ'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С‚СѓС€С‘РЅРѕР№ СЃРІС‘РєР»РѕР№',kcal:320,protein:36,fat:12,carbs:20,foods:'Р“РѕРІСЏРґРёРЅР° 180Рі, СЃРІС‘РєР»Р° С‚СѓС€С‘РЅР°СЏ 150Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅРѕРµ РєСѓСЂРёРЅРѕРµ С„РёР»Рµ',kcal:240,protein:42,fat:5,carbs:4,foods:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ 220Рі СЃ С‡РµСЃРЅРѕРєРѕРј Рё СЃРїРµС†РёСЏРјРё'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ РїРѕРјРёРґРѕСЂР°РјРё',kcal:260,protein:36,fat:5,carbs:16,foods:'Р“РѕСЂР±СѓС€Р° 200Рі, РїРѕРјРёРґРѕСЂС‹ 150Рі, Р·РµР»РµРЅСЊ'},
        {name:'РўРІРѕСЂРѕРі СЃ РїРµСЂС†РµРј Рё Р·РµР»РµРЅСЊСЋ',kcal:190,protein:24,fat:2,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 180Рі, Р±РѕР»РіР°СЂСЃРєРёР№ РїРµСЂРµС†, Р·РµР»РµРЅСЊ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РѕРіСѓСЂРµС‡РЅС‹Рј СЃР°Р»Р°С‚РѕРј',kcal:260,protein:40,fat:5,carbs:12,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 200Рі, РѕРіСѓСЂС†С‹ 200Рі, РєРµС„РёСЂ Р·Р°РїСЂР°РІРєР°'},
        {name:'РњРёРЅС‚Р°Р№ СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:220,protein:36,fat:2,carbs:14,foods:'РњРёРЅС‚Р°Р№ 220Рі, Р±СЂРѕРєРєРѕР»Рё 200Рі РЅР° РїР°СЂСѓ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ Р±Р°РєР»Р°Р¶Р°РЅРѕРј',kcal:250,protein:38,fat:5,carbs:16,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 190Рі, Р±Р°РєР»Р°Р¶Р°РЅ С‚СѓС€С‘РЅС‹Р№ 200Рі'},
        {name:'РўСѓРЅРµС† СЃ Р·РµР»С‘РЅРѕР№ С„Р°СЃРѕР»СЊСЋ',kcal:240,protein:36,fat:3,carbs:18,foods:'РўСѓРЅРµС† 190Рі, СЃС‚СЂСѓС‡РєРѕРІР°СЏ С„Р°СЃРѕР»СЊ 150Рі'},
        {name:'Р С‹Р±Р° СЃ С‚СѓС€С‘РЅРѕР№ С‚С‹РєРІРѕР№',kcal:240,protein:36,fat:4,carbs:18,foods:'РўСЂРµСЃРєР° 200Рі, С‚С‹РєРІР° 180Рі'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ РіСЂРёР±Р°РјРё',kcal:210,protein:22,fat:8,carbs:10,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, С€Р°РјРїРёРЅСЊРѕРЅС‹ 100Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С†РІРµС‚РЅРѕР№ РєР°РїСѓСЃС‚РѕР№',kcal:240,protein:38,fat:5,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 190Рі, С†РІРµС‚РЅР°СЏ РєР°РїСѓСЃС‚Р° 200Рі'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ С‚СѓС€С‘РЅС‹РјРё РєР°Р±Р°С‡РєР°РјРё',kcal:250,protein:34,fat:7,carbs:14,foods:'Р“РѕСЂР±СѓС€Р° 200Рі, РєР°Р±Р°С‡РєРё 200Рі'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С‚СѓС€С‘РЅС‹РјРё РїРµСЂС†Р°РјРё',kcal:300,protein:36,fat:12,carbs:16,foods:'Р“РѕРІСЏРґРёРЅР° 180Рі, Р±РѕР»РіР°СЂСЃРєРёР№ РїРµСЂРµС† 200Рі'},
        {name:'Р С‹Р±РЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ РєР°Р±Р°С‡РєРѕРј',kcal:260,protein:32,fat:8,carbs:16,foods:'Р С‹Р±РЅС‹Рµ РєРѕС‚Р»РµС‚С‹ 2С€С‚, РєР°Р±Р°С‡РѕРє С‚СѓС€С‘РЅС‹Р№ 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РјРѕСЂРєРѕРІСЊСЋ',kcal:240,protein:36,fat:4,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, РјРѕСЂРєРѕРІСЊ С‚СѓС€С‘РЅР°СЏ 200Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ СЂРµРґРёСЃРѕРј Рё Р·РµР»РµРЅСЊСЋ',kcal:180,protein:22,fat:1,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 170Рі, СЂРµРґРёСЃ, Р·РµР»РµРЅСЊ'},
        {name:'РљСѓСЂРёРЅС‹Р№ С„Р°СЂС€ СЃ РєР°Р±Р°С‡РєРѕРј',kcal:260,protein:34,fat:8,carbs:16,foods:'РљСѓСЂРёРЅС‹Р№ С„Р°СЂС€ 200Рі, РєР°Р±Р°С‡РѕРє 200Рі'},
        {name:'РўСЂРµСЃРєР° СЃ С‚СѓС€С‘РЅС‹РјРё РїРѕРјРёРґРѕСЂР°РјРё',kcal:230,protein:36,fat:3,carbs:16,foods:'РўСЂРµСЃРєР° 200Рі, РїРѕРјРёРґРѕСЂС‹ С‚СѓС€С‘РЅС‹Рµ 200Рі'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ С†РІРµС‚РЅРѕР№ РєР°РїСѓСЃС‚РѕР№',kcal:200,protein:22,fat:6,carbs:12,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, С†РІ. РєР°РїСѓСЃС‚Р° 100Рі'},
        {name:'РўСѓРЅРµС† СЃ С‚СѓС€С‘РЅРѕР№ СЃРІС‘РєР»РѕР№',kcal:250,protein:34,fat:3,carbs:22,foods:'РўСѓРЅРµС† 180Рі, СЃРІС‘РєР»Р° С‚СѓС€С‘РЅР°СЏ 150Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ СЂС‹Р±Р° СЃ РјРѕСЂРєРѕРІСЊСЋ',kcal:240,protein:36,fat:4,carbs:18,foods:'Р“РѕСЂР±СѓС€Р° 200Рі, РјРѕСЂРєРѕРІСЊ 150Рі, Р»РёРјРѕРЅ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‚СѓС€С‘РЅС‹РјРё РіСЂРёР±Р°РјРё',kcal:250,protein:38,fat:6,carbs:12,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 190Рі, С€Р°РјРїРёРЅСЊРѕРЅС‹ 150Рі'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С‚СѓС€С‘РЅС‹РјРё РєР°Р±Р°С‡РєР°РјРё',kcal:300,protein:36,fat:12,carbs:14,foods:'Р“РѕРІСЏРґРёРЅР° 180Рі, РєР°Р±Р°С‡РєРё 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃРѕ СЃРїР°СЂР¶РµР№',kcal:240,protein:38,fat:4,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 190Рі, СЃРїР°СЂР¶Р° 150Рі РЅР° РїР°СЂСѓ'},
        {name:'РћРјР»РµС‚ СЃ Р±Р°РєР»Р°Р¶Р°РЅРѕРј',kcal:220,protein:18,fat:12,carbs:12,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, Р±Р°РєР»Р°Р¶Р°РЅ Р¶Р°СЂРµРЅС‹Р№ 100Рі'},
        {name:'РўСѓРЅРµС† СЃ С‚СѓС€С‘РЅРѕР№ РєР°РїСѓСЃС‚РѕР№',kcal:230,protein:34,fat:3,carbs:18,foods:'РўСѓРЅРµС† 180Рі, С‚СѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С„Р°СЃРѕР»СЊСЋ СЃС‚СЂСѓС‡РєРѕРІРѕР№',kcal:250,protein:36,fat:5,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 190Рі, СЃС‚СЂСѓС‡РєРѕРІР°СЏ С„Р°СЃРѕР»СЊ 150Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Р№ Р»РѕСЃРѕСЃСЊ СЃ Р±Р°РєР»Р°Р¶Р°РЅРѕРј',kcal:280,protein:30,fat:14,carbs:12,foods:'Р›РѕСЃРѕСЃСЊ 160Рі, Р±Р°РєР»Р°Р¶Р°РЅ 200Рі'},
        {name:'Р“РѕРІСЏРґРёРЅР° СЃ С‚СѓС€С‘РЅРѕР№ РјРѕСЂРєРѕРІСЊСЋ',kcal:290,protein:34,fat:12,carbs:18,foods:'Р“РѕРІСЏРґРёРЅР° 175Рі, РјРѕСЂРєРѕРІСЊ 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С†СѓРєРёРЅРё',kcal:240,protein:38,fat:4,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 190Рі, С†СѓРєРёРЅРё 200Рі РЅР° РїР°СЂСѓ'},
        {name:'Р С‹Р±Р° РІ РїРµСЂРіР°РјРµРЅС‚Рµ СЃ РѕРІРѕС‰Р°РјРё',kcal:260,protein:36,fat:5,carbs:18,foods:'РўСЂРµСЃРєР° 200Рі, РјРѕСЂРєРѕРІСЊ, Р»СѓРє Р·Р°РїРµС‡СЊ РІ РїРµСЂРіР°РјРµРЅС‚Рµ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Р№ РјРёРЅС‚Р°Р№ СЃ РїРµСЂС†РµРј',kcal:220,protein:36,fat:2,carbs:14,foods:'РњРёРЅС‚Р°Р№ 220Рі, Р±РѕР»РіР°СЂСЃРєРёР№ РїРµСЂРµС†, СЃРїРµС†РёРё'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‚СѓС€С‘РЅС‹РјРё РіСЂРёР±Р°РјРё',kcal:248,protein:38,fat:6,carbs:12,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 190Рі, РІРµС€РµРЅРєРё 150Рі'},
        {name:'РњРёРЅС‚Р°Р№ СЃ С‚СѓС€С‘РЅРѕР№ РјРѕСЂРєРѕРІСЊСЋ',kcal:230,protein:36,fat:2,carbs:18,foods:'РњРёРЅС‚Р°Р№ 220Рі, РјРѕСЂРєРѕРІСЊ С‚СѓС€С‘РЅР°СЏ 150Рі'}
      ],
      'РџРµСЂРµРєСѓСЃ': [
        {name:'РўРІРѕСЂРѕРі 0%',kcal:120,protein:18,fat:0,carbs:12,foods:'РўРІРѕСЂРѕРі 0% 150Рі'},
        {name:'РћРіСѓСЂС†С‹ СЃ РєРµС„РёСЂРѕРј',kcal:100,protein:6,fat:1,carbs:14,foods:'РћРіСѓСЂС†С‹ 200Рі, РєРµС„РёСЂ 0% 100РјР»'},
        {name:'Р—РµР»С‘РЅРѕРµ СЏР±Р»РѕРєРѕ',kcal:80,protein:0,fat:0,carbs:20,foods:'РЇР±Р»РѕРєРѕ Р·РµР»С‘РЅРѕРµ 1С€С‚'},
        {name:'РљРµС„РёСЂ 0%',kcal:90,protein:9,fat:0,carbs:12,foods:'РљРµС„РёСЂ 0% 300РјР»'},
        {name:'Р’Р°СЂС‘РЅС‹Рµ СЏР№С†Р°',kcal:120,protein:10,fat:8,carbs:0,foods:'РЇР№С†Р° РІР°СЂС‘РЅС‹Рµ 1-2С€С‚'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0%',kcal:100,protein:12,fat:0,carbs:12,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 150Рі'},
        {name:'РњРѕСЂРєРѕРІРЅС‹Рµ РїР°Р»РѕС‡РєРё',kcal:50,protein:1,fat:0,carbs:12,foods:'РњРѕСЂРєРѕРІСЊ 200Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РѕРіСѓСЂС†РѕРј',kcal:130,protein:18,fat:1,carbs:10,foods:'РўРІРѕСЂРѕРі 0% 120Рі, РѕРіСѓСЂРµС† 1С€С‚'},
        {name:'РљРµС„РёСЂ СЃ СЏРіРѕРґР°РјРё',kcal:140,protein:8,fat:1,carbs:24,foods:'РљРµС„РёСЂ 0% 200РјР», СЏРіРѕРґС‹ 80Рі'},
        {name:'РЇРёС‡РЅС‹Рµ Р±РµР»РєРё РІР°СЂС‘РЅС‹Рµ',kcal:80,protein:18,fat:0,carbs:0,foods:'РЇРёС‡РЅС‹Рµ Р±РµР»РєРё 4С€С‚ РІР°СЂС‘РЅС‹С…'},
        {name:'РћРІРѕС‰РЅРѕР№ СЃРјСѓР·Рё',kcal:90,protein:4,fat:1,carbs:16,foods:'РљРµС„РёСЂ 150РјР», РѕРіСѓСЂРµС†, Р·РµР»РµРЅСЊ, Р»С‘Рґ'},
        {name:'РћРіСѓСЂС†С‹ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:130,protein:16,fat:1,carbs:12,foods:'РћРіСѓСЂС†С‹ 200Рі, С‚РІРѕСЂРѕРі 0% 100Рі'},
        {name:'Р“СЂРµР№РїС„СЂСѓС‚',kcal:60,protein:1,fat:0,carbs:14,foods:'Р“СЂРµР№РїС„СЂСѓС‚ ВЅС€С‚'},
        {name:'РЇРіРѕРґС‹',kcal:80,protein:1,fat:0,carbs:20,foods:'РљР»СѓР±РЅРёРєР° РёР»Рё С‡РµСЂРЅРёРєР° 150Рі'},
        {name:'РљРµС„РёСЂ СЃ РѕС‚СЂСѓР±СЏРјРё',kcal:150,protein:10,fat:1,carbs:24,foods:'РљРµС„РёСЂ 0% 200РјР», РѕС‚СЂСѓР±Рё 25Рі'},
        {name:'РћРіСѓСЂРµС† СЃ СЏР№С†РѕРј',kcal:130,protein:12,fat:8,carbs:4,foods:'РћРіСѓСЂРµС† 2С€С‚, СЏР№С†Рѕ РІР°СЂС‘РЅРѕРµ 1С€С‚'},
        {name:'РҐР»РµР±С†С‹ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:180,protein:16,fat:2,carbs:24,foods:'РҐР»РµР±С†С‹ 3С€С‚, С‚РІРѕСЂРѕРі 0% 80Рі'},
        {name:'РџРѕРјРёРґРѕСЂС‹ СЃ Р·РµР»РµРЅСЊСЋ',kcal:50,protein:2,fat:0,carbs:10,foods:'РџРѕРјРёРґРѕСЂС‹ 200Рі, СѓРєСЂРѕРї'},
        {name:'РўРІРѕСЂРѕР¶РЅС‹Р№ РјСѓСЃСЃ СЃ СЏРіРѕРґР°РјРё',kcal:140,protein:18,fat:0,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 150Рі РІР·Р±РёС‚С‹Р№ СЃ СЏРіРѕРґР°РјРё'},
        {name:'РљРµС„РёСЂ СЃ РєРѕСЂРёС†РµР№',kcal:100,protein:8,fat:0,carbs:14,foods:'РљРµС„РёСЂ 0% 250РјР», РєРѕСЂРёС†Р°'},
        {name:'РЇР№С†Р° СЃ РїРѕРјРёРґРѕСЂРѕРј',kcal:160,protein:12,fat:10,carbs:6,foods:'РЇР№С†Р° РІР°СЂС‘РЅС‹Рµ 2С€С‚, РїРѕРјРёРґРѕСЂ 1С€С‚'},
        {name:'Р—РµР»С‘РЅС‹Р№ СЃРјСѓР·Рё',kcal:120,protein:6,fat:1,carbs:22,foods:'РЁРїРёРЅР°С‚, РѕРіСѓСЂРµС†, СЏР±Р»РѕРєРѕ, РІРѕРґР°'},
        {name:'РҐР»РµР±С†С‹ СЃ РєРµС„РёСЂРѕРј',kcal:160,protein:8,fat:1,carbs:28,foods:'РҐР»РµР±С†С‹ 3С€С‚, РєРµС„РёСЂ 0% 200РјР»'},
        {name:'РўРІРѕСЂРѕРі СЃ Р·РµР»РµРЅСЊСЋ',kcal:130,protein:18,fat:1,carbs:12,foods:'РўРІРѕСЂРѕРі 0% 150Рі, Р·РµР»РµРЅСЊ, С‡РµСЃРЅРѕРє'},
        {name:'РЇРіРѕРґРЅС‹Р№ РєРµС„РёСЂ',kcal:140,protein:8,fat:1,carbs:24,foods:'РљРµС„РёСЂ 1% 200РјР», Р·Р°РјРѕСЂРѕР¶РµРЅРЅС‹Рµ СЏРіРѕРґС‹ 80Рі РІР·Р±РёС‚С‹Рµ'},
        {name:'РћРіСѓСЂС†С‹ СЃ РєРµС„РёСЂРѕРј Рё С‡РµСЃРЅРѕРєРѕРј',kcal:90,protein:5,fat:1,carbs:14,foods:'РћРіСѓСЂС†С‹ 200Рі, РєРµС„РёСЂ 0% 100РјР», С‡РµСЃРЅРѕРє'},
        {name:'РњРѕСЂРєРѕРІСЊ СЃ РєРµС„РёСЂРѕРј',kcal:110,protein:6,fat:1,carbs:18,foods:'РњРѕСЂРєРѕРІСЊ 150Рі, РєРµС„РёСЂ 0% 100РјР»'},
        {name:'РњР°РЅРґР°СЂРёРЅС‹',kcal:60,protein:1,fat:0,carbs:14,foods:'РњР°РЅРґР°СЂРёРЅС‹ 2С€С‚'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ СЃРјСѓР·Рё',kcal:160,protein:20,fat:1,carbs:18,foods:'РљРµС„РёСЂ 0% 200РјР», РїСЂРѕС‚РµРёРЅ ВЅ РјРµСЂРЅРѕР№, СЏРіРѕРґС‹'},
        {name:'РљР°РїСѓСЃС‚РЅС‹Р№ СЃР°Р»Р°С‚',kcal:80,protein:2,fat:0,carbs:16,foods:'РљР°РїСѓСЃС‚Р° 200Рі, РјРѕСЂРєРѕРІСЊ, Р»РёРјРѕРЅРЅС‹Р№ СЃРѕРє'},
        {name:'РЇР±Р»РѕРєРѕ Р·Р°РїРµС‡С‘РЅРЅРѕРµ',kcal:90,protein:0,fat:0,carbs:22,foods:'РЇР±Р»РѕРєРѕ Р·Р°РїРµС‡С‘РЅРЅРѕРµ СЃ РєРѕСЂРёС†РµР№'},
        {name:'Р РµРґРёСЃ СЃ РєРµС„РёСЂРѕРј',kcal:80,protein:4,fat:0,carbs:14,foods:'Р РµРґРёСЃ 150Рі, РєРµС„РёСЂ 0% 100РјР»'},
        {name:'Р—РµР»С‘РЅС‹Р№ РєРѕРєС‚РµР№Р»СЊ Р»С‘РіРєРёР№',kcal:90,protein:4,fat:0,carbs:18,foods:'РЁРїРёРЅР°С‚, РѕРіСѓСЂРµС†, СЃРµР»СЊРґРµСЂРµР№, РІРѕРґР°'},
        {name:'РљРµС„РёСЂ СЃ СЃРµРјРµРЅР°РјРё Р»СЊРЅР°',kcal:120,protein:8,fat:3,carbs:14,foods:'РљРµС„РёСЂ 0% 250РјР», Р»СЊРЅСЏРЅС‹Рµ СЃРµРјРµРЅР° 10Рі'},
        {name:'РЎРµР»СЊРґРµСЂРµР№ СЃ РєРµС„РёСЂРѕРј',kcal:70,protein:4,fat:0,carbs:12,foods:'РЎРµР»СЊРґРµСЂРµР№ 100Рі, РєРµС„РёСЂ 100РјР»'},
        {name:'РќРµР¶РёСЂРЅС‹Р№ С‚РІРѕСЂРѕРі СЃ Р·РµР»РµРЅСЊСЋ',kcal:110,protein:16,fat:0,carbs:10,foods:'РўРІРѕСЂРѕРі 0% 120Рі, Р·РµР»С‘РЅС‹Р№ Р»СѓРє, СѓРєСЂРѕРї'},
        {name:'Р™РѕРіСѓСЂС‚ СЃ РѕРіСѓСЂС†РѕРј',kcal:90,protein:10,fat:0,carbs:10,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 100Рі, РѕРіСѓСЂРµС† 1С€С‚'},
        {name:'РљР°РїСѓСЃС‚Р° СЃ РєРµС„РёСЂРѕРј',kcal:90,protein:4,fat:0,carbs:16,foods:'РљР°РїСѓСЃС‚Р° 150Рі, РєРµС„РёСЂ 0% 100РјР», Р·РµР»РµРЅСЊ'},
        {name:'РњРѕСЂРєРѕРІСЊ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:120,protein:12,fat:1,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 80Рі, РјРѕСЂРєРѕРІСЊ 150Рі'},
        {name:'РЁРїРёРЅР°С‚ СЃ СЏР№С†РѕРј',kcal:120,protein:12,fat:8,carbs:4,foods:'РЁРїРёРЅР°С‚ 80Рі, СЏР№С†Рѕ РІР°СЂС‘РЅРѕРµ 1С€С‚'},
        {name:'РЎРјСѓР·Рё РєРµС„РёСЂ СЃ Р·РµР»РµРЅСЊСЋ',kcal:100,protein:6,fat:0,carbs:18,foods:'РљРµС„РёСЂ 200РјР», С€РїРёРЅР°С‚, РѕРіСѓСЂРµС†'},
        {name:'РљР»СЋРєРІР° СЃ РєРµС„РёСЂРѕРј',kcal:110,protein:6,fat:0,carbs:22,foods:'РљРµС„РёСЂ 0% 150РјР», РєР»СЋРєРІР° СЃРІРµР¶Р°СЏ 50Рі'},
        {name:'Р‘СЂРѕРєРєРѕР»Рё СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:130,protein:16,fat:1,carbs:12,foods:'Р‘СЂРѕРєРєРѕР»Рё РЅР° РїР°СЂСѓ 100Рі, С‚РІРѕСЂРѕРі 0% 80Рі'},
        {name:'РўРѕРјР°С‚РЅС‹Р№ СЃРѕРє',kcal:60,protein:1,fat:0,carbs:12,foods:'РўРѕРјР°С‚РЅС‹Р№ СЃРѕРє Р±РµР· СЃРѕР»Рё 250РјР»'},
        {name:'РћРіСѓСЂС†С‹ СЃ Р№РѕРіСѓСЂС‚РѕРј',kcal:90,protein:6,fat:0,carbs:14,foods:'РћРіСѓСЂС†С‹ 200Рі, Р№РѕРіСѓСЂС‚ 0% 80Рі'},
        {name:'РљРµС„РёСЂРЅРѕ-С‚РІРѕСЂРѕР¶РЅС‹Р№ РєРѕРєС‚РµР№Р»СЊ',kcal:130,protein:16,fat:0,carbs:16,foods:'РљРµС„РёСЂ 0% 150РјР», С‚РІРѕСЂРѕРі 0% 80Рі РІР·Р±РёС‚СЊ'},
        {name:'РљР°РїСѓСЃС‚РЅС‹Р№ СЃРѕРє',kcal:50,protein:1,fat:0,carbs:10,foods:'РљР°РїСѓСЃС‚РЅС‹Р№ СЃРѕРє СЃРІРµР¶РµРІС‹Р¶Р°С‚С‹Р№ 200РјР»'},
        {name:'РћРіСѓСЂРµС† СЃ СѓРєСЂРѕРїРѕРј',kcal:30,protein:1,fat:0,carbs:6,foods:'РћРіСѓСЂС†С‹ 200Рі, СѓРєСЂРѕРї'},
        {name:'РљРµС„РёСЂ СЃ РїРµС‚СЂСѓС€РєРѕР№',kcal:80,protein:6,fat:0,carbs:10,foods:'РљРµС„РёСЂ 0% 200РјР», РїРµС‚СЂСѓС€РєР°'},
        {name:'РЎРїР°СЂР¶Р° СЃ Р»РёРјРѕРЅРѕРј',kcal:50,protein:3,fat:0,carbs:8,foods:'РЎРїР°СЂР¶Р° 100Рі РЅР° РїР°СЂСѓ, Р»РёРјРѕРЅРЅС‹Р№ СЃРѕРє'},
        {name:'РџРѕРјРёРґРѕСЂС‹ С‡РµСЂСЂРё',kcal:50,protein:2,fat:0,carbs:10,foods:'РџРѕРјРёРґРѕСЂС‹ С‡РµСЂСЂРё 150Рі'},
        {name:'РћС‚РІР°СЂРЅР°СЏ С†РІРµС‚РЅР°СЏ РєР°РїСѓСЃС‚Р°',kcal:60,protein:3,fat:0,carbs:12,foods:'Р¦РІРµС‚РЅР°СЏ РєР°РїСѓСЃС‚Р° 150Рі СЃ Р»РёРјРѕРЅРѕРј'},
        {name:'РљРµС„РёСЂ СЃ РёРјР±РёСЂС‘Рј',kcal:90,protein:6,fat:0,carbs:14,foods:'РљРµС„РёСЂ 0% 200РјР», РёРјР±РёСЂСЊ С‚С‘СЂС‚С‹Р№, Р»С‘Рґ'},
        {name:'Р‘Р°РєР»Р°Р¶Р°РЅ Р·Р°РїРµС‡С‘РЅРЅС‹Р№',kcal:80,protein:2,fat:0,carbs:16,foods:'Р‘Р°РєР»Р°Р¶Р°РЅ 200Рі Р·Р°РїРµС‡С‘РЅРЅС‹Р№ СЃ С‡РµСЃРЅРѕРєРѕРј'},
        {name:'РўРІРѕСЂРѕРі СЃ С‚РјРёРЅРѕРј',kcal:110,protein:16,fat:0,carbs:10,foods:'РўРІРѕСЂРѕРі 0% 120Рі, С‚РјРёРЅ, Р·РµР»РµРЅСЊ'},
        {name:'Р—РµР»С‘РЅС‹Р№ РіРѕСЂРѕС€РµРє СЃ РјСЏС‚РѕР№',kcal:90,protein:5,fat:0,carbs:16,foods:'Р“РѕСЂРѕС€РµРє 100Рі, РјСЏС‚Р°, Р»РёРјРѕРЅРЅС‹Р№ СЃРѕРє'},
        {name:'РЎРјСѓР·Рё РёР· С‚РѕРјР°С‚Р°',kcal:80,protein:2,fat:0,carbs:16,foods:'РўРѕРјР°С‚РЅС‹Р№ СЃРѕРє 200РјР», СЃРµР»СЊРґРµСЂРµР№, РїРµСЂРµС†'},
        {name:'РљРµС„РёСЂ СЃ РѕРіСѓСЂС†РѕРј Рё С‡РµСЃРЅРѕРєРѕРј',kcal:90,protein:5,fat:1,carbs:14,foods:'РљРµС„РёСЂ 0% 200РјР», РѕРіСѓСЂРµС†, С‡РµСЃРЅРѕРє'},
        {name:'РЎРїР°СЂР¶Р° СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:100,protein:12,fat:1,carbs:10,foods:'РЎРїР°СЂР¶Р° 100Рі РЅР° РїР°СЂСѓ, С‚РІРѕСЂРѕРі 0% 70Рі'}
      ]
    }
  },
  femcut: { label:'РџРѕС…СѓРґРµРЅРёРµ\nРґР»СЏ Р¶РµРЅС‰РёРЅ', icon:'рџЊё', bg:'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
    meals: {
      'Р—Р°РІС‚СЂР°Рє': [
        {name:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ СЃ РєР»СѓР±РЅРёРєРѕР№',kcal:180,protein:16,fat:1,carbs:26,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 150Рі, РєР»СѓР±РЅРёРєР° 80Рі, РјС‘Рґ ВЅ С‡.Р».'},
        {name:'РўРІРѕСЂРѕРі СЃ РіСЂРµР№РїС„СЂСѓС‚РѕРј',kcal:190,protein:22,fat:2,carbs:20,foods:'РўРІРѕСЂРѕРі 0% 180Рі, РіСЂРµР№РїС„СЂСѓС‚ ВЅС€С‚'},
        {name:'РћРІСЃСЏРЅРєР° СЃ СЏРіРѕРґР°РјРё',kcal:240,protein:8,fat:3,carbs:46,foods:'РћРІСЃСЏРЅРєР° РЅР° РІРѕРґРµ 70Рі, СЏРіРѕРґС‹ 60Рі, ВЅ С‡.Р». РјС‘РґР°'},
        {name:'РЇР№С†Р° РїР°С€РѕС‚ СЃ Р°РІРѕРєР°РґРѕ',kcal:260,protein:16,fat:16,carbs:8,foods:'РЇР№С†Р° РїР°С€РѕС‚ 2С€С‚, Р°РІРѕРєР°РґРѕ ВјС€С‚'},
        {name:'Р‘Р°РЅР°РЅРѕРІС‹Р№ СЃРјСѓР·Рё СЃ РєРµС„РёСЂРѕРј',kcal:220,protein:10,fat:1,carbs:44,foods:'Р‘Р°РЅР°РЅ 1С€С‚, РєРµС„РёСЂ 0% 200РјР»'},
        {name:'РўРІРѕСЂРѕР¶РЅРѕРµ СЃСѓС„Р»Рµ Р·Р°РїРµС‡С‘РЅРЅРѕРµ',kcal:190,protein:22,fat:2,carbs:20,foods:'РўРІРѕСЂРѕРі 0% 180Рі, СЏР№С†Рѕ 1С€С‚ Р·Р°РїРµС‡СЊ'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ РїРѕРјРёРґРѕСЂРѕРј',kcal:160,protein:22,fat:5,carbs:6,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, РїРѕРјРёРґРѕСЂ'},
        {name:'РљРµС„РёСЂ СЃ РјСЋСЃР»Рё',kcal:250,protein:10,fat:4,carbs:44,foods:'РљРµС„РёСЂ 1% 200РјР», РјСЋСЃР»Рё Р±РµР· СЃР°С…Р°СЂР° 50Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ СЏР±Р»РѕРєРѕРј Рё РєРѕСЂРёС†РµР№',kcal:200,protein:22,fat:2,carbs:24,foods:'РўРІРѕСЂРѕРі 0% 180Рі, СЏР±Р»РѕРєРѕ, РєРѕСЂРёС†Р°'},
        {name:'РЇРіРѕРґРЅС‹Р№ СЃРјСѓР·Рё',kcal:200,protein:12,fat:1,carbs:36,foods:'РљРµС„РёСЂ 0% 200РјР», РєР»СѓР±РЅРёРєР° 100Рі, Р±Р°РЅР°РЅ ВЅС€С‚'},
        {name:'РўРІРѕСЂРѕРі СЃ РІР°РЅРёР»СЊСЋ Рё СЏРіРѕРґР°РјРё',kcal:170,protein:22,fat:2,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 200Рі, РІР°РЅРёР»СЊ, СЏРіРѕРґС‹'},
        {name:'РћРјР»РµС‚ СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:200,protein:20,fat:10,carbs:8,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, Р±СЂРѕРєРєРѕР»Рё 80Рі, РјР°СЃР»Рѕ 5Рі'},
        {name:'Р“СЂРµС‡РЅРµРІР°СЏ РєР°С€Р° СЃ СЏРіРѕРґР°РјРё',kcal:230,protein:8,fat:3,carbs:44,foods:'Р“СЂРµС‡РєР° 70Рі РЅР° РІРѕРґРµ, СЏРіРѕРґС‹'},
        {name:'РЇР№С†Р° РІР°СЂС‘РЅС‹Рµ СЃ РѕРіСѓСЂС†РѕРј',kcal:180,protein:14,fat:10,carbs:6,foods:'РЇР№С†Р° 2С€С‚, РѕРіСѓСЂРµС† 1С€С‚'},
        {name:'РџСЂРѕС‚РµРёРЅРѕРІС‹Р№ Р№РѕРіСѓСЂС‚',kcal:200,protein:22,fat:1,carbs:24,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 150Рі, ВЅ РјРµСЂРЅРѕР№ РїСЂРѕС‚РµРёРЅР°, СЏРіРѕРґС‹'},
        {name:'РўРІРѕСЂРѕРі СЃ РїРѕРјРёРґРѕСЂРѕРј Рё Р·РµР»РµРЅСЊСЋ',kcal:170,protein:22,fat:1,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 180Рі, РїРѕРјРёРґРѕСЂ, Р·РµР»РµРЅСЊ'},
        {name:'РћРІСЃСЏРЅС‹Рµ РџРџ-РѕР»Р°РґСЊРё',kcal:250,protein:14,fat:5,carbs:38,foods:'РћРІСЃСЏРЅРєР° 60Рі, СЏР№С†Рѕ 1С€С‚, РєРµС„РёСЂ 50РјР»'},
        {name:'РљРµС„РёСЂ СЃ СЏРіРѕРґР°РјРё Рё РѕС‚СЂСѓР±СЏРјРё',kcal:200,protein:10,fat:1,carbs:34,foods:'РљРµС„РёСЂ 0% 200РјР», СЏРіРѕРґС‹ 60Рі, РѕС‚СЂСѓР±Рё 20Рі'},
        {name:'РЇРёС‡РЅРёС†Р° СЃ РїРµСЂС†РµРј',kcal:190,protein:14,fat:12,carbs:6,foods:'РЇРёС‡РЅРёС†Р° 2С€С‚, Р±РѕР»РіР°СЂСЃРєРёР№ РїРµСЂРµС†, Р·РµР»РµРЅСЊ'},
        {name:'Р—РµР»С‘РЅС‹Р№ СЃРјСѓР·Рё СЃ СЏР±Р»РѕРєРѕРј',kcal:170,protein:6,fat:1,carbs:34,foods:'РЁРїРёРЅР°С‚ 50Рі, СЏР±Р»РѕРєРѕ, РєРµС„РёСЂ 150РјР»'},
        {name:'РўРІРѕСЂРѕРі СЃ С‡РµСЂРЅРёРєРѕР№',kcal:190,protein:22,fat:1,carbs:22,foods:'РўРІРѕСЂРѕРі 0% 180Рі, С‡РµСЂРЅРёРєР° 60Рі'},
        {name:'Р РёСЃРѕРІР°СЏ РєР°С€Р° Р»С‘РіРєР°СЏ',kcal:220,protein:6,fat:2,carbs:44,foods:'Р РёСЃ 60Рі РЅР° РІРѕРґРµ, СЏР±Р»РѕРєРѕ'},
        {name:'РћРјР»РµС‚ СЃ С„РµС‚РѕР№ Рё Р·РµР»РµРЅСЊСЋ',kcal:220,protein:20,fat:12,carbs:6,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, Р·РµР»РµРЅСЊ, СЃС‹СЂ С„РµС‚Р° 20Рі'},
        {name:'РўРІРѕСЂРѕР¶РЅС‹Р№ РјСѓСЃСЃ СЃ СЏРіРѕРґР°РјРё',kcal:180,protein:22,fat:1,carbs:18,foods:'РўРІРѕСЂРѕРі 0% РІР·Р±РёС‚С‹Р№ 150Рі, СЏРіРѕРґС‹'},
        {name:'РЇР№С†Р° РїР°С€РѕС‚ СЃ РїРѕРјРёРґРѕСЂР°РјРё С‡РµСЂСЂРё',kcal:180,protein:12,fat:10,carbs:8,foods:'РЇР№С†Р° РїР°С€РѕС‚ 2С€С‚, РїРѕРјРёРґРѕСЂС‹ С‡РµСЂСЂРё'},
        {name:'РљРµС„РёСЂ СЃ РєРѕСЂРёС†РµР№ Рё СЏР±Р»РѕРєРѕРј',kcal:190,protein:8,fat:1,carbs:36,foods:'РљРµС„РёСЂ 0% 200РјР», СЏР±Р»РѕРєРѕ, РєРѕСЂРёС†Р°'},
        {name:'РЎРјСѓР·Рё РёР· С‚РІРѕСЂРѕРіР° СЃ РїРµСЂСЃРёРєРѕРј',kcal:200,protein:18,fat:1,carbs:28,foods:'РўРІРѕСЂРѕРі 0% 150Рі, РїРµСЂСЃРёРє 1С€С‚ РІР·Р±РёС‚СЊ'},
        {name:'Р—РµР»С‘РЅС‹Р№ СЃРјСѓР·Рё СЃ РїСЂРѕС‚РµРёРЅРѕРј',kcal:200,protein:22,fat:1,carbs:26,foods:'РљРµС„РёСЂ 150РјР», ВЅ РјРµСЂРЅРѕР№ РїСЂРѕС‚РµРёРЅР°, С€РїРёРЅР°С‚, СЏР±Р»РѕРєРѕ'},
        {name:'РЇР№С†Р° СЃ РєР°Р±Р°С‡РєРѕРј',kcal:200,protein:14,fat:12,carbs:8,foods:'РЇР№С†Р° 2С€С‚, РєР°Р±Р°С‡РѕРє Р¶Р°СЂРµРЅС‹Р№ 100Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РјР°РЅРґР°СЂРёРЅРѕРј',kcal:190,protein:22,fat:2,carbs:20,foods:'РўРІРѕСЂРѕРі 0% 180Рі, РјР°РЅРґР°СЂРёРЅ 1С€С‚'},
        {name:'РЎРјСѓР·Рё РёР· РєР»СѓР±РЅРёРєРё СЃ РјСЏС‚РѕР№',kcal:170,protein:8,fat:0,carbs:34,foods:'РљРµС„РёСЂ 0% 150РјР», РєР»СѓР±РЅРёРєР° 100Рі, РјСЏС‚Р°'},
        {name:'РўРІРѕСЂРѕРі СЃ РјР°Р»РёРЅРѕР№',kcal:180,protein:22,fat:1,carbs:18,foods:'РўРІРѕСЂРѕРі 0% 170Рі, РјР°Р»РёРЅР° 60Рі'},
        {name:'Р™РѕРіСѓСЂС‚ СЃ РїРµСЂСЃРёРєРѕРј',kcal:180,protein:12,fat:0,carbs:34,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 150Рі, РїРµСЂСЃРёРє 1С€С‚'},
        {name:'РћРІСЃСЏРЅРєР° СЃ С‡РµСЂРЅРёРєРѕР№',kcal:230,protein:8,fat:3,carbs:44,foods:'РћРІСЃСЏРЅРєР° РЅР° РІРѕРґРµ 65Рі, С‡РµСЂРЅРёРєР° 60Рі, РєРѕСЂРёС†Р°'},
        {name:'РћРјР»РµС‚ СЃ С‚РѕРјР°С‚РѕРј Рё Р±Р°Р·РёР»РёРєРѕРј',kcal:190,protein:18,fat:10,carbs:8,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, РїРѕРјРёРґРѕСЂ, Р±Р°Р·РёР»РёРє'},
        {name:'РўРІРѕСЂРѕРі СЃ РіСЂСѓС€РµР№',kcal:190,protein:22,fat:1,carbs:22,foods:'РўРІРѕСЂРѕРі 0% 170Рі, РіСЂСѓС€Р° 1С€С‚'},
        {name:'Р‘РµР»РѕРє СЃ СЂРёСЃРѕРІС‹РјРё С…Р»РµР±С†Р°РјРё',kcal:200,protein:20,fat:1,carbs:26,foods:'Р‘РµР»РєРё 4С€С‚, С…Р»РµР±С†С‹ 3С€С‚'},
        {name:'РћРјР»РµС‚ СЃ Р±СЂС‹РЅР·РѕР№',kcal:210,protein:20,fat:11,carbs:6,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, Р±СЂС‹РЅР·Р° 30Рі, Р·РµР»РµРЅСЊ'},
        {name:'РЎРјСѓР·Рё РјР°РЅРіРѕ-Р±Р°РЅР°РЅ',kcal:210,protein:6,fat:0,carbs:46,foods:'РљРµС„РёСЂ 0% 150РјР», РјР°РЅРіРѕ 60Рі, Р±Р°РЅР°РЅ ВЅС€С‚'},
        {name:'РўРІРѕСЂРѕРі СЃ РјР°РЅРґР°СЂРёРЅР°РјРё',kcal:190,protein:20,fat:1,carbs:24,foods:'РўРІРѕСЂРѕРі 0% 170Рі, РјР°РЅРґР°СЂРёРЅ 1С€С‚'},
        {name:'РЇР№С†Р° СЃ СЂСѓРєРєРѕР»РѕР№',kcal:190,protein:14,fat:10,carbs:8,foods:'РЇР№С†Р° 2С€С‚, СЂСѓРєРєРѕР»Р°, РїРѕРјРёРґРѕСЂС‹ С‡РµСЂСЂРё'},
        {name:'РџРёС‚СЊРµРІРѕР№ Р№РѕРіСѓСЂС‚ СЃ РѕС‚СЂСѓР±СЏРјРё',kcal:200,protein:10,fat:1,carbs:36,foods:'Р™РѕРіСѓСЂС‚ РїРёС‚СЊРµРІРѕР№ 0% 200РјР», РѕС‚СЂСѓР±Рё 25Рі'},
        {name:'РЎРјСѓР·Рё РєРµС„РёСЂ + РїРµСЂСЃРёРє + С€РїРёРЅР°С‚',kcal:190,protein:10,fat:0,carbs:36,foods:'РљРµС„РёСЂ 0% 200РјР», РїРµСЂСЃРёРє, С€РїРёРЅР°С‚'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ Р»СѓРєРѕРј',kcal:170,protein:20,fat:5,carbs:10,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, Р·РµР»С‘РЅС‹Р№ Р»СѓРє'},
        {name:'РўРІРѕСЂРѕРі СЃ Р°РїРµР»СЊСЃРёРЅРѕРј',kcal:190,protein:22,fat:1,carbs:22,foods:'РўРІРѕСЂРѕРі 0% 170Рі, Р°РїРµР»СЊСЃРёРЅ ВЅС€С‚'},
        {name:'РЇР№С†Р° РїР°С€РѕС‚ СЃ СЂСѓРєРєРѕР»РѕР№',kcal:190,protein:14,fat:10,carbs:10,foods:'РЇР№С†Р° РїР°С€РѕС‚ 2С€С‚, СЂСѓРєРєРѕР»Р°, РѕР»РёРІРєРѕРІРѕРµ РјР°СЃР»Рѕ 3Рі'},
        {name:'РЇРіРѕРґРЅС‹Р№ РєРѕРєС‚РµР№Р»СЊ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:200,protein:22,fat:1,carbs:24,foods:'РўРІРѕСЂРѕРі 0% 150Рі, СЃРјРµСЃСЊ СЏРіРѕРґ 60Рі РІР·Р±РёС‚СЊ'},
        {name:'РћРјР»РµС‚ СЃ СЂРµРґРёСЃРѕРј',kcal:180,protein:16,fat:10,carbs:6,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, СЂРµРґРёСЃ 60Рі, Р·РµР»РµРЅСЊ'},
        {name:'РўРІРѕСЂРѕРі СЃ Р°РЅР°РЅР°СЃРѕРј',kcal:190,protein:20,fat:1,carbs:24,foods:'РўРІРѕСЂРѕРі 0% 160Рі, Р°РЅР°РЅР°СЃ СЃРІРµР¶РёР№ 80Рі'},
        {name:'РЎРјСѓР·Рё РєРµС„РёСЂ СЃ Р°СЂР±СѓР·РѕРј',kcal:170,protein:6,fat:0,carbs:34,foods:'РљРµС„РёСЂ 0% 150РјР», Р°СЂР±СѓР· 150Рі'},
        {name:'Р‘РµР»РѕРє СЃ РѕРіСѓСЂС†РѕРј Рё РїРѕРјРёРґРѕСЂРѕРј',kcal:160,protein:20,fat:1,carbs:14,foods:'Р‘РµР»РєРё 4С€С‚ РІР°СЂС‘РЅС‹С…, РѕРіСѓСЂРµС†, РїРѕРјРёРґРѕСЂ'},
        {name:'Р™РѕРіСѓСЂС‚ СЃ Р°Р±СЂРёРєРѕСЃРѕРј',kcal:170,protein:12,fat:0,carbs:30,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 150Рі, Р°Р±СЂРёРєРѕСЃС‹ 2С€С‚'},
        {name:'РЎРјСѓР·Рё Р±Р°РЅР°РЅ СЃ РІР°РЅРёР»СЊСЋ',kcal:220,protein:10,fat:1,carbs:44,foods:'РљРµС„РёСЂ 0% 200РјР», Р±Р°РЅР°РЅ 1С€С‚, РІР°РЅРёР»СЊ'},
        {name:'РЇР№С†Р° СЃ РїРѕРјРёРґРѕСЂР°РјРё С‡РµСЂСЂРё',kcal:190,protein:14,fat:12,carbs:6,foods:'РЇР№С†Р° 2С€С‚, РїРѕРјРёРґРѕСЂС‹ С‡РµСЂСЂРё, Р±Р°Р·РёР»РёРє'},
        {name:'РўРІРѕСЂРѕРі СЃ РєСЂС‹Р¶РѕРІРЅРёРєРѕРј',kcal:180,protein:22,fat:1,carbs:18,foods:'РўРІРѕСЂРѕРі 0% 170Рі, РєСЂС‹Р¶РѕРІРЅРёРє 50Рі'},
        {name:'Р—РµР»С‘РЅС‹Р№ РѕРјР»РµС‚',kcal:190,protein:20,fat:10,carbs:6,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, С€РїРёРЅР°С‚ 60Рі, Р·РµР»РµРЅСЊ, Р±СЂС‹РЅР·Р° 20Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РёРЅР¶РёСЂРѕРј',kcal:200,protein:20,fat:1,carbs:26,foods:'РўРІРѕСЂРѕРі 0% 160Рі, РёРЅР¶РёСЂ СЃРІРµР¶РёР№ 1С€С‚'},
        {name:'РљРµС„РёСЂ СЃ РєРѕСЂРёС†РµР№ Рё СЏР±Р»РѕРєРѕРј',kcal:190,protein:8,fat:1,carbs:36,foods:'РљРµС„РёСЂ 0% 200РјР», СЏР±Р»РѕРєРѕ, РєРѕСЂРёС†Р°'},
        {name:'РЎРјСѓР·Рё РёР· С‚РІРѕСЂРѕРіР° СЃ РїРµСЂСЃРёРєРѕРј',kcal:200,protein:18,fat:1,carbs:28,foods:'РўРІРѕСЂРѕРі 0% 150Рі, РїРµСЂСЃРёРє 1С€С‚ РІР·Р±РёС‚СЊ'}
      ],
      'РћР±РµРґ': [
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:300,protein:40,fat:6,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, С‚СѓС€С‘РЅС‹Рµ РєР°Р±Р°С‡РєРё, РїРѕРјРёРґРѕСЂ'},
        {name:'РўСѓРЅРµС† СЃ РіСЂРµС‡РєРѕР№',kcal:330,protein:36,fat:4,carbs:36,foods:'РўСѓРЅРµС† РІ СЃРѕР±СЃС‚РІРµРЅРЅРѕРј СЃРѕРєСѓ 180Рі, РіСЂРµС‡РєР° 80Рі'},
        {name:'Р›С‘РіРєРёР№ РєСѓСЂРёРЅС‹Р№ СЃСѓРї',kcal:260,protein:26,fat:5,carbs:26,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР» СЃ РіСЂСѓРґРєРѕР№ 120Рі'},
        {name:'Р С‹Р±Р° РЅР° РїР°СЂСѓ СЃ СЂРёСЃРѕРј',kcal:320,protein:34,fat:4,carbs:36,foods:'РўСЂРµСЃРєР° 180Рі, СЂРёСЃ 80Рі, Р»РёРјРѕРЅ'},
        {name:'РЎР°Р»Р°С‚ СЃ РєСѓСЂРёС†РµР№ Рё Р°РІРѕРєР°РґРѕ',kcal:340,protein:34,fat:16,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 160Рі, Р°РІРѕРєР°РґРѕ Вј, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°, РѕРіСѓСЂРµС†'},
        {name:'РўСѓРЅРµС† СЃ РѕРІРѕС‰РЅС‹Рј СЃР°Р»Р°С‚РѕРј',kcal:280,protein:36,fat:4,carbs:18,foods:'РўСѓРЅРµС† 180Рі, РѕРіСѓСЂС†С‹, РїРѕРјРёРґРѕСЂС‹, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:320,protein:34,fat:14,carbs:10,foods:'Р›РѕСЃРѕСЃСЊ 160Рі, Р±СЂРѕРєРєРѕР»Рё 200Рі РЅР° РїР°СЂСѓ'},
        {name:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:320,protein:36,fat:5,carbs:34,foods:'РљСѓСЂРёРЅРѕРµ С„РёР»Рµ 170Рі, РїРµСЂР»РѕРІРєР° 80Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‡РµС‡РµРІРёС†РµР№',kcal:340,protein:40,fat:5,carbs:36,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, С‡РµС‡РµРІРёС†Р° 80Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Р№ Р»РѕСЃРѕСЃСЊ СЃ РѕРІРѕС‰Р°РјРё',kcal:330,protein:34,fat:14,carbs:14,foods:'Р›РѕСЃРѕСЃСЊ 160Рі, РєР°Р±Р°С‡РѕРє, РїРѕРјРёРґРѕСЂ'},
        {name:'РўСѓС€С‘РЅР°СЏ С‡РµС‡РµРІРёС†Р° СЃ РјРѕСЂРєРѕРІСЊСЋ',kcal:290,protein:20,fat:4,carbs:42,foods:'Р§РµС‡РµРІРёС†Р° 100Рі, РјРѕСЂРєРѕРІСЊ, Р»СѓРє, С‚РѕРјР°С‚С‹'},
        {name:'РљСѓСЂРёРЅС‹Рµ С‚РµС„С‚РµР»Рё СЃ РіСЂРµС‡РєРѕР№',kcal:320,protein:38,fat:6,carbs:30,foods:'РўРµС„С‚РµР»Рё РєСѓСЂРёРЅС‹Рµ 3С€С‚ РјР°Р»РµРЅСЊРєРёС…, РіСЂРµС‡РєР° 80Рі'},
        {name:'Р›С‘РіРєРёР№ СЂС‹Р±РЅС‹Р№ СЃСѓРї',kcal:240,protein:28,fat:4,carbs:22,foods:'РЈС…Р° 400РјР», С‚СЂРµСЃРєР° 120Рі'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ СЃР°Р»Р°С‚ СЃ С‚СѓРЅС†РѕРј',kcal:300,protein:34,fat:12,carbs:14,foods:'РўСѓРЅРµС† 160Рі, РїРѕРјРёРґРѕСЂ, РѕРіСѓСЂРµС†, РѕР»РёРІРєРё, С„РµС‚Р° 30Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ СЂРёСЃРѕРј',kcal:320,protein:38,fat:4,carbs:34,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, СЂРёСЃ 80Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ С‚СЂРµСЃРєР° СЃ РіСЂРµС‡РєРѕР№',kcal:300,protein:36,fat:4,carbs:30,foods:'РўСЂРµСЃРєР° 180Рі, РіСЂРµС‡РєР° 80Рі'},
        {name:'РћРІРѕС‰РЅРѕР№ СЃСѓРї СЃ РєСѓСЂРёС†РµР№',kcal:240,protein:24,fat:4,carbs:26,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР», РєР°Р±Р°С‡РєРё, РјРѕСЂРєРѕРІСЊ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С„Р°СЃРѕР»СЊСЋ',kcal:330,protein:38,fat:4,carbs:32,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, С„Р°СЃРѕР»СЊ 80Рі'},
        {name:'Р›С‘РіРєРёР№ Р±РѕСЂС‰ СЃ РєСѓСЂРёС†РµР№',kcal:260,protein:20,fat:5,carbs:32,foods:'Р‘РѕСЂС‰ 400РјР» Р±РµР· РјСЏСЃР° + РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 80Рі'},
        {name:'РўСѓРЅРµС† СЃ СЂРёСЃРѕРј',kcal:300,protein:34,fat:3,carbs:34,foods:'РўСѓРЅРµС† 180Рі, СЂРёСЃ 80Рі, РѕРіСѓСЂРµС†'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:280,protein:34,fat:5,carbs:22,foods:'Р“РѕСЂР±СѓС€Р° 180Рі, РєР°Р±Р°С‡РєРё, РїРµСЂРµС†'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ Р±РµР· РєРѕР¶Рё СЃ РіСЂРµС‡РєРѕР№',kcal:340,protein:38,fat:10,carbs:28,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ 180Рі, РіСЂРµС‡РєР° 80Рі'},
        {name:'РўСѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° СЃ РєСѓСЂРёС†РµР№',kcal:270,protein:30,fat:6,carbs:22,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 150Рі, С‚СѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° 200Рі'},
        {name:'Р›С‘РіРєРёР№ СЃР°Р»Р°С‚ РќРёСЃСѓР°Р·',kcal:310,protein:30,fat:12,carbs:18,foods:'РўСѓРЅРµС† 160Рі, СЏР№С†Рѕ 1С€С‚, РїРѕРјРёРґРѕСЂ, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°, СЃС‚СЂСѓС‡РєРё С„Р°СЃРѕР»Рё'},
        {name:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї СЃ Р»Р°РїС€РѕР№',kcal:280,protein:26,fat:5,carbs:30,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР», Р»Р°РїС€Р° 30Рі'},
        {name:'Р С‹Р±Р° СЃ Р±РµР»РѕР№ С„Р°СЃРѕР»СЊСЋ',kcal:300,protein:36,fat:4,carbs:26,foods:'РўСЂРµСЃРєР° 180Рі, С„Р°СЃРѕР»СЊ Р±РµР»Р°СЏ 80Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ Р·РµР»С‘РЅС‹Рј РіРѕСЂРѕС€РєРѕРј',kcal:310,protein:38,fat:4,carbs:28,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, Р·РµР»С‘РЅС‹Р№ РіРѕСЂРѕС€РµРє 100Рі'},
        {name:'РљСѓСЂРёС†Р° РІ С‚РѕРјР°С‚РЅРѕРј СЃРѕСѓСЃРµ',kcal:300,protein:38,fat:6,carbs:22,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ Р±РµР· РјР°СЃР»Р°'},
        {name:'РўСѓРЅРµС† СЃ С‡РµС‡РµРІРёС†РµР№',kcal:320,protein:40,fat:4,carbs:30,foods:'РўСѓРЅРµС† 180Рі, С‡РµС‡РµРІРёС†Р° 80Рі, Р·РµР»РµРЅСЊ'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ СЃСѓРї СЃ РєСѓСЂРёС†РµР№',kcal:280,protein:28,fat:6,carbs:26,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР», РїРѕРјРёРґРѕСЂС‹, СЂРёСЃ 40Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ Р±СЂРѕРєРєРѕР»Рё Рё РіСЂРµС‡РєРѕР№',kcal:300,protein:38,fat:5,carbs:28,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, Р±СЂРѕРєРєРѕР»Рё 150Рі, РіСЂРµС‡РєР° 70Рі'},
        {name:'Р С‹Р±Р° РЅР° РїР°СЂСѓ СЃ РіСЂРµС‡РєРѕР№',kcal:300,protein:34,fat:4,carbs:32,foods:'РўСЂРµСЃРєР° 170Рі, РіСЂРµС‡РєР° 80Рі'},
        {name:'РўСѓРЅРµС† СЃ РєСѓСЃ-РєСѓСЃРѕРј',kcal:310,protein:34,fat:3,carbs:36,foods:'РўСѓРЅРµС† 170Рі, РєСѓСЃ-РєСѓСЃ 80Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РєР°РїСѓСЃС‚РѕР№',kcal:260,protein:36,fat:5,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, С‚СѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° 200Рі'},
        {name:'Р›С‘РіРєРёР№ РєСѓСЂРёРЅС‹Р№ СЃСѓРї СЃ СЂРёСЃРѕРј',kcal:260,protein:24,fat:4,carbs:30,foods:'РљСѓСЂРёРЅС‹Р№ СЃСѓРї 400РјР», СЂРёСЃ 50Рі, РіСЂСѓРґРєР° 110Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ СЂС‹Р±Р° СЃ СЂРёСЃРѕРј',kcal:300,protein:32,fat:4,carbs:34,foods:'Р“РѕСЂР±СѓС€Р° 160Рі, СЂРёСЃ 80Рі, Р»РёРјРѕРЅ'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ СЃ РєР°Р±Р°С‡РєР°РјРё',kcal:300,protein:36,fat:10,carbs:20,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ 170Рі Р±РµР· РєРѕР¶Рё, РєР°Р±Р°С‡РєРё 200Рі'},
        {name:'РўСѓРЅРµС† СЃ РєСѓРєСѓСЂСѓР·РѕР№ Рё СЂРёСЃРѕРј',kcal:310,protein:32,fat:3,carbs:38,foods:'РўСѓРЅРµС† 160Рі, СЂРёСЃ 70Рі, РєСѓРєСѓСЂСѓР·Р° 50Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РєСѓСЂРёС†Р° СЃ РїРѕРјРёРґРѕСЂР°РјРё',kcal:290,protein:36,fat:5,carbs:22,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, РїРѕРјРёРґРѕСЂС‹, РїСЂРѕРІР°РЅСЃРєРёРµ С‚СЂР°РІС‹'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РіРѕСЂРѕС€РєРѕРј Рё СЂРёСЃРѕРј',kcal:300,protein:36,fat:4,carbs:32,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 160Рі, РіРѕСЂРѕС€РµРє 80Рі, СЂРёСЃ 70Рі'},
        {name:'РўСЂРµСЃРєР° СЃ РїРµСЂР»РѕРІРєРѕР№',kcal:290,protein:34,fat:4,carbs:30,foods:'РўСЂРµСЃРєР° 170Рі, РїРµСЂР»РѕРІРєР° 75Рі'},
        {name:'РљСѓСЂРёРЅС‹Рµ РєРѕС‚Р»РµС‚С‹ СЃ С‡РµС‡РµРІРёС†РµР№',kcal:320,protein:38,fat:6,carbs:28,foods:'РљСѓСЂРёРЅС‹Рµ РєРѕС‚Р»РµС‚С‹ 2С€С‚, С‡РµС‡РµРІРёС†Р° 75Рі'},
        {name:'РўСѓРЅРµС† СЃ С†РІРµС‚РЅРѕР№ РєР°РїСѓСЃС‚РѕР№',kcal:270,protein:34,fat:3,carbs:22,foods:'РўСѓРЅРµС† 170Рі, С†РІРµС‚РЅР°СЏ РєР°РїСѓСЃС‚Р° 200Рі'},
        {name:'РЎСѓРї РёР· РєСЂР°СЃРЅРѕР№ С‡РµС‡РµРІРёС†С‹',kcal:280,protein:18,fat:4,carbs:40,foods:'РЎСѓРї РёР· РєСЂР°СЃРЅРѕР№ С‡РµС‡РµРІРёС†С‹ 400РјР», С‚РѕРјР°С‚С‹, СЃРїРµС†РёРё'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃРѕ СЃРїР°СЂР¶РµР№',kcal:270,protein:34,fat:4,carbs:20,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 160Рі, СЃРїР°СЂР¶Р° 150Рі'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ РіСЂРµС‡РєРѕР№',kcal:320,protein:32,fat:12,carbs:26,foods:'Р›РѕСЃРѕСЃСЊ 150Рі, РіСЂРµС‡РєР° 75Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° РІ Р»РёРјРѕРЅРЅРѕРј СЃРѕСѓСЃРµ',kcal:280,protein:36,fat:4,carbs:22,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, Р»РёРјРѕРЅРЅС‹Р№ СЃРѕРє, Р·РµР»РµРЅСЊ'},
        {name:'РЎСѓРї-РїСЋСЂРµ РёР· Р±СЂРѕРєРєРѕР»Рё',kcal:240,protein:20,fat:4,carbs:26,foods:'РљСЂРµРј-СЃСѓРї РёР· Р±СЂРѕРєРєРѕР»Рё 400РјР», РєСѓСЂРёРЅС‹Р№ Р±СѓР»СЊРѕРЅ, С‚РІРѕСЂРѕРі 0% 50Рі'},
        {name:'РўСѓРЅРµС† СЃ С‚РѕРјР°С‚РЅС‹Рј СЃРѕСѓСЃРѕРј Рё СЂРёСЃРѕРј',kcal:310,protein:34,fat:3,carbs:36,foods:'РўСѓРЅРµС† 170Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ, СЂРёСЃ 80Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РєСѓСЂРёС†Р° СЃ С‚С‹РєРІРѕР№',kcal:290,protein:34,fat:5,carbs:24,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 160Рі, С‚С‹РєРІР° 200Рі'},
        {name:'Р С‹Р±Р° СЃ РєСѓСЃ-РєСѓСЃРѕРј',kcal:300,protein:32,fat:4,carbs:34,foods:'Р“РѕСЂР±СѓС€Р° 160Рі, РєСѓСЃ-РєСѓСЃ 80Рі'},
        {name:'РўСѓРЅРµС† СЃ СЂРёСЃРѕРј Рё РіРѕСЂРѕС€РєРѕРј',kcal:310,protein:34,fat:3,carbs:36,foods:'РўСѓРЅРµС† 165Рі, СЂРёСЃ 75Рі, РіРѕСЂРѕС€РµРє 50Рі'},
        {name:'РЎСѓРї РјРёРЅРµСЃС‚СЂРѕРЅРµ СЃ РєСѓСЂРёС†РµР№',kcal:270,protein:26,fat:4,carbs:30,foods:'РњРёРЅРµСЃС‚СЂРѕРЅРµ 400РјР», РєСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 100Рі'},
        {name:'РўСЂРµСЃРєР° СЃ С‚СѓС€С‘РЅС‹РјРё РїРµСЂС†Р°РјРё',kcal:270,protein:34,fat:3,carbs:20,foods:'РўСЂРµСЃРєР° 170Рі, Р±РѕР»РіР°СЂСЃРєРёР№ РїРµСЂРµС† С‚СѓС€С‘РЅС‹Р№ 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РєСѓСЃ-РєСѓСЃРѕРј',kcal:300,protein:36,fat:4,carbs:30,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 160Рі, РєСѓСЃ-РєСѓСЃ 80Рі'},
        {name:'Р С‹Р±Р° СЃ С„Р°СЃРѕР»СЊСЋ Рё Р·РµР»РµРЅСЊСЋ',kcal:290,protein:36,fat:3,carbs:24,foods:'РўСЂРµСЃРєР° 170Рі, Р±РµР»Р°СЏ С„Р°СЃРѕР»СЊ 80Рі'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ С‡РµС‡РµРІРёС†РµР№',kcal:310,protein:34,fat:7,carbs:28,foods:'Р“РѕСЂР±СѓС€Р° 160Рі, С‡РµС‡РµРІРёС†Р° 80Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ Р·РµР»С‘РЅС‹Рј РіРѕСЂРѕС€РєРѕРј',kcal:310,protein:38,fat:4,carbs:28,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, Р·РµР»С‘РЅС‹Р№ РіРѕСЂРѕС€РµРє 100Рі'},
        {name:'РљСѓСЂРёС†Р° РІ С‚РѕРјР°С‚РЅРѕРј СЃРѕСѓСЃРµ Р±РµР· РјР°СЃР»Р°',kcal:300,protein:38,fat:6,carbs:22,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, С‚РѕРјР°С‚РЅС‹Р№ СЃРѕСѓСЃ Р±РµР· РјР°СЃР»Р°'}
      ],
      'РЈР¶РёРЅ': [
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° РЅР° РїР°СЂСѓ',kcal:220,protein:36,fat:4,carbs:10,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, СЃРїРµС†РёРё, Р»РёРјРѕРЅ'},
        {name:'РўРІРѕСЂРѕРі СЃ РѕРіСѓСЂС†РѕРј Рё Р·РµР»РµРЅСЊСЋ',kcal:170,protein:22,fat:1,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 170Рі, РѕРіСѓСЂРµС†, СѓРєСЂРѕРї'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ Р»РёРјРѕРЅРѕРј Р·Р°РїРµС‡С‘РЅРЅР°СЏ',kcal:240,protein:34,fat:5,carbs:10,foods:'Р“РѕСЂР±СѓС€Р° 180Рі, Р»РёРјРѕРЅ, Р·РµР»РµРЅСЊ'},
        {name:'РўСѓРЅРµС† СЃ РїРѕРјРёРґРѕСЂР°РјРё',kcal:240,protein:32,fat:3,carbs:16,foods:'РўСѓРЅРµС† 180Рі, РїРѕРјРёРґРѕСЂС‹ 200Рі'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ РєР°Р±Р°С‡РєРѕРј',kcal:180,protein:22,fat:5,carbs:10,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, РєР°Р±Р°С‡РѕРє 100Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:240,protein:36,fat:4,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 180Рі, Р±СЂРѕРєРєРѕР»Рё 200Рі'},
        {name:'Р›РѕСЃРѕСЃСЊ РЅР° РіСЂРёР»Рµ СЃ РѕРіСѓСЂС†РѕРј',kcal:270,protein:32,fat:13,carbs:5,foods:'Р›РѕСЃРѕСЃСЊ 160Рі, РѕРіСѓСЂРµС† 2С€С‚'},
        {name:'РљСѓСЂРёРЅС‹Р№ Р»С‘РіРєРёР№ СЃР°Р»Р°С‚',kcal:240,protein:32,fat:6,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 160Рі, РѕРіСѓСЂРµС†, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°, РєРµС„РёСЂ Р·Р°РїСЂР°РІРєР°'},
        {name:'РўРІРѕСЂРѕРі СЃ РїРѕРјРёРґРѕСЂР°РјРё С‡РµСЂСЂРё',kcal:170,protein:22,fat:1,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 170Рі, РїРѕРјРёРґРѕСЂС‹ С‡РµСЂСЂРё'},
        {name:'РўСЂРµСЃРєР° СЃ С‚СѓС€С‘РЅС‹РјРё РѕРІРѕС‰Р°РјРё',kcal:230,protein:34,fat:3,carbs:14,foods:'РўСЂРµСЃРєР° 180Рі, РєР°Р±Р°С‡РѕРє, РјРѕСЂРєРѕРІСЊ'},
        {name:'РљРµС„РёСЂ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:160,protein:20,fat:1,carbs:18,foods:'РљРµС„РёСЂ 0% 150РјР», С‚РІРѕСЂРѕРі 0% 100Рі'},
        {name:'РљСѓСЂРёРЅС‹Рµ С‚РµС„С‚РµР»Рё СЃ РєР°Р±Р°С‡РєРѕРј',kcal:250,protein:32,fat:6,carbs:14,foods:'РўРµС„С‚РµР»Рё 2С€С‚, РєР°Р±Р°С‡РѕРє С‚СѓС€С‘РЅС‹Р№ 200Рі'},
        {name:'РўСѓРЅРµС† СЃ Р»РёСЃС‚СЊСЏРјРё СЃР°Р»Р°С‚Р°',kcal:220,protein:32,fat:3,carbs:14,foods:'РўСѓРЅРµС† 180Рі, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р° 100Рі, РїРѕРјРёРґРѕСЂ'},
        {name:'РћРјР»РµС‚ СЃ РїРѕРјРёРґРѕСЂРѕРј',kcal:200,protein:16,fat:12,carbs:6,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, РїРѕРјРёРґРѕСЂ, Р·РµР»РµРЅСЊ'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Р№ РјРёРЅС‚Р°Р№',kcal:200,protein:34,fat:2,carbs:8,foods:'РњРёРЅС‚Р°Р№ 200Рі, Р»РёРјРѕРЅ, СЃРїРµС†РёРё'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‚СѓС€С‘РЅРѕР№ СЃРІС‘РєР»РѕР№',kcal:250,protein:34,fat:4,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, СЃРІС‘РєР»Р° 150Рі'},
        {name:'Р С‹Р±РЅР°СЏ РєРѕС‚Р»РµС‚Р° СЃ СЃР°Р»Р°С‚РѕРј',kcal:260,protein:28,fat:8,carbs:16,foods:'Р С‹Р±РЅР°СЏ РєРѕС‚Р»РµС‚Р° 1С€С‚, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°, РѕРіСѓСЂРµС†'},
        {name:'РўРІРѕСЂРѕРі СЃ Р·Р°РїРµС‡С‘РЅРЅС‹Рј РєР°Р±Р°С‡РєРѕРј',kcal:200,protein:20,fat:2,carbs:18,foods:'РўРІРѕСЂРѕРі 0% 150Рі, Р·Р°РїРµС‡С‘РЅРЅС‹Р№ РєР°Р±Р°С‡РѕРє 150Рі'},
        {name:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ Р±РµР· РєРѕР¶Рё',kcal:240,protein:32,fat:10,carbs:6,foods:'РљСѓСЂРёРЅРѕРµ Р±РµРґСЂРѕ 180Рі Р±РµР· РєРѕР¶Рё Р·Р°РїРµС‡С‘РЅРЅРѕРµ'},
        {name:'РўСѓРЅРµС† СЃ РєР°Р±Р°С‡РєРѕРј',kcal:230,protein:32,fat:3,carbs:16,foods:'РўСѓРЅРµС† 170Рі, С‚СѓС€С‘РЅС‹Р№ РєР°Р±Р°С‡РѕРє 200Рі'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃРѕ С€РїРёРЅР°С‚РѕРј',kcal:190,protein:22,fat:8,carbs:6,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, С€РїРёРЅР°С‚ 80Рі'},
        {name:'Р С‹Р±Р° СЃ РїРѕРјРёРґРѕСЂР°РјРё Рё Р·РµР»РµРЅСЊСЋ',kcal:230,protein:32,fat:4,carbs:14,foods:'РўСЂРµСЃРєР° 180Рі, РїРѕРјРёРґРѕСЂС‹ 150Рі'},
        {name:'РћРјР»РµС‚ СЃ С€Р°РјРїРёРЅСЊРѕРЅР°РјРё',kcal:210,protein:18,fat:12,carbs:8,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, С€Р°РјРїРёРЅСЊРѕРЅС‹ 80Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ Р±РѕР»РіР°СЂСЃРєРёРј РїРµСЂС†РµРј',kcal:170,protein:22,fat:1,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 170Рі, Р±РѕР»РіР°СЂСЃРєРёР№ РїРµСЂРµС†, Р·РµР»РµРЅСЊ'},
        {name:'Р›РѕСЃРѕСЃСЊ СЃ РєР°Р±Р°С‡РєРѕРј',kcal:270,protein:30,fat:14,carbs:6,foods:'Р›РѕСЃРѕСЃСЊ 150Рі, РєР°Р±Р°С‡РѕРє 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ Р·РµР»С‘РЅС‹Рј РіРѕСЂРѕС€РєРѕРј',kcal:250,protein:34,fat:4,carbs:20,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, Р·РµР»С‘РЅС‹Р№ РіРѕСЂРѕС€РµРє 80Рі'},
        {name:'РўСЂРµСЃРєР° СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:220,protein:34,fat:3,carbs:12,foods:'РўСЂРµСЃРєР° 180Рі, Р±СЂРѕРєРєРѕР»Рё 180Рі'},
        {name:'РўСѓРЅРµС† СЃ СЏР№С†РѕРј Рё СЃР°Р»Р°С‚РѕРј',kcal:250,protein:32,fat:8,carbs:12,foods:'РўСѓРЅРµС† 150Рі, СЏР№С†Рѕ 1С€С‚, Р»РёСЃС‚СЊСЏ СЃР°Р»Р°С‚Р°'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ РіРѕСЂР±СѓС€Р° СЃ Р»РёРјРѕРЅРѕРј',kcal:220,protein:34,fat:4,carbs:10,foods:'Р“РѕСЂР±СѓС€Р° 180Рі, Р»РёРјРѕРЅ, СѓРєСЂРѕРї'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С‚СѓС€С‘РЅРѕР№ РјРѕСЂРєРѕРІСЊСЋ',kcal:240,protein:34,fat:4,carbs:18,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, РјРѕСЂРєРѕРІСЊ С‚СѓС€С‘РЅР°СЏ 150Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ С†РІРµС‚РЅРѕР№ РєР°РїСѓСЃС‚РѕР№',kcal:230,protein:34,fat:3,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, С†РІРµС‚РЅР°СЏ РєР°РїСѓСЃС‚Р° 200Рі РЅР° РїР°СЂСѓ'},
        {name:'РўСѓРЅРµС† СЃ Р±Р°РєР»Р°Р¶Р°РЅРѕРј',kcal:220,protein:30,fat:3,carbs:18,foods:'РўСѓРЅРµС† 170Рі, Р±Р°РєР»Р°Р¶Р°РЅ С‚СѓС€С‘РЅС‹Р№ 150Рі'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ РєР°Р±Р°С‡РєРѕРј',kcal:180,protein:22,fat:5,carbs:10,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, РєР°Р±Р°С‡РѕРє 100Рі'},
        {name:'РњРёРЅС‚Р°Р№ СЃ С‚СѓС€С‘РЅС‹Рј РїРµСЂС†РµРј',kcal:210,protein:32,fat:2,carbs:16,foods:'РњРёРЅС‚Р°Р№ 200Рі, Р±РѕР»РіР°СЂСЃРєРёР№ РїРµСЂРµС† 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ СЂСѓРєРєРѕР»РѕР№',kcal:230,protein:34,fat:5,carbs:12,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, СЂСѓРєРєРѕР»Р° 50Рі, РїРѕРјРёРґРѕСЂС‹ С‡РµСЂСЂРё'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ Р±СЂРѕРєРєРѕР»Рё',kcal:230,protein:30,fat:8,carbs:12,foods:'Р“РѕСЂР±СѓС€Р° 170Рі, Р±СЂРѕРєРєРѕР»Рё 200Рі РЅР° РїР°СЂСѓ'},
        {name:'РўСѓРЅРµС† СЃ РєР°РїСѓСЃС‚РѕР№',kcal:220,protein:30,fat:3,carbs:18,foods:'РўСѓРЅРµС† 170Рі, С‚СѓС€С‘РЅР°СЏ РєР°РїСѓСЃС‚Р° 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° РІ СЃРїРµС†РёСЏС…',kcal:220,protein:34,fat:3,carbs:12,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі СЃ РєР°СЂСЂРё Рё СЃРїРµС†РёСЏРјРё'},
        {name:'РћРјР»РµС‚ СЃ С‚РѕРјР°С‚Р°РјРё',kcal:200,protein:16,fat:12,carbs:6,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, РїРѕРјРёРґРѕСЂС‹, Р±Р°Р·РёР»РёРє'},
        {name:'Р С‹Р±Р° СЃ С‚СѓС€С‘РЅС‹РјРё РєР°Р±Р°С‡РєР°РјРё',kcal:220,protein:32,fat:3,carbs:16,foods:'РўСЂРµСЃРєР° 170Рі, РєР°Р±Р°С‡РєРё 200Рі'},
        {name:'РўРІРѕСЂРѕРі СЃРѕ СЃРІРµР¶РµР№ Р·РµР»РµРЅСЊСЋ',kcal:160,protein:20,fat:1,carbs:14,foods:'РўРІРѕСЂРѕРі 0% 160Рі, РїРµС‚СЂСѓС€РєР°, Р±Р°Р·РёР»РёРє, РѕРіСѓСЂРµС†'},
        {name:'РљСѓСЂРёРЅС‹Рµ С‚РµС„С‚РµР»Рё Р»С‘РіРєРёРµ',kcal:240,protein:30,fat:6,carbs:16,foods:'РўРµС„С‚РµР»Рё РєСѓСЂРёРЅС‹Рµ 2С€С‚, РєР°Р±Р°С‡РѕРє 200Рі'},
        {name:'РўСѓРЅРµС† СЃ РѕРіСѓСЂС†РѕРј',kcal:210,protein:30,fat:2,carbs:18,foods:'РўСѓРЅРµС† 170Рі, РѕРіСѓСЂС†С‹ 200Рі, Р·РµР»РµРЅСЊ'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ С‚РѕРјР°С‚РѕРј',kcal:180,protein:22,fat:5,carbs:8,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, РїРѕРјРёРґРѕСЂ'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃРѕ СЃРїР°СЂР¶РµР№',kcal:240,protein:34,fat:4,carbs:16,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, СЃРїР°СЂР¶Р° 150Рі'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ С‚СѓС€С‘РЅС‹РјРё РїРѕРјРёРґРѕСЂР°РјРё',kcal:240,protein:30,fat:8,carbs:14,foods:'Р“РѕСЂР±СѓС€Р° 170Рі, РїРѕРјРёРґРѕСЂС‹ 200Рі'},
        {name:'РћРјР»РµС‚ СЃ Р·РµР»С‘РЅС‹Рј Р»СѓРєРѕРј',kcal:190,protein:16,fat:12,carbs:6,foods:'РћРјР»РµС‚ 2 СЏР№С†Р°, Р·РµР»С‘РЅС‹Р№ Р»СѓРє, СѓРєСЂРѕРї'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РєР°Р±Р°С‡РєРѕРј',kcal:230,protein:34,fat:4,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, РєР°Р±Р°С‡РѕРє 200Рі РЅР° РїР°СЂСѓ'},
        {name:'РўСѓРЅРµС† СЃ С‚СѓС€С‘РЅС‹Рј Р»СѓРєРѕРј',kcal:220,protein:30,fat:3,carbs:18,foods:'РўСѓРЅРµС† 170Рі, Р»СѓРє С‚СѓС€С‘РЅС‹Р№ 150Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅС‹Р№ РјРёРЅС‚Р°Р№ СЃ Р»РёРјРѕРЅРѕРј',kcal:200,protein:32,fat:2,carbs:10,foods:'РњРёРЅС‚Р°Р№ 200Рі, Р»РёРјРѕРЅ, С‡РµСЃРЅРѕРє'},
        {name:'Р С‹Р±РЅС‹Р№ СЃСѓС„Р»Рµ',kcal:240,protein:30,fat:6,carbs:18,foods:'РЎСѓС„Р»Рµ РёР· С‚СЂРµСЃРєРё 200Рі СЃ СЏР№С†РѕРј'},
        {name:'РўСѓРЅРµС† СЃРѕ С€РїРёРЅР°С‚РѕРј',kcal:210,protein:30,fat:2,carbs:16,foods:'РўСѓРЅРµС† 170Рі, С€РїРёРЅР°С‚ С‚СѓС€С‘РЅС‹Р№ 100Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РїРѕРјРёРґРѕСЂР°РјРё Рё Р±Р°Р·РёР»РёРєРѕРј',kcal:220,protein:34,fat:3,carbs:12,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, РїРѕРјРёРґРѕСЂС‹, Р±Р°Р·РёР»РёРє'},
        {name:'Р“РѕСЂР±СѓС€Р° СЃ Р·РµР»С‘РЅРѕР№ С„Р°СЃРѕР»СЊСЋ',kcal:240,protein:30,fat:7,carbs:16,foods:'Р“РѕСЂР±СѓС€Р° 170Рі, СЃС‚СЂСѓС‡РєРѕРІР°СЏ С„Р°СЃРѕР»СЊ 150Рі'},
        {name:'РўСѓРЅРµС† СЃ Р»РёРјРѕРЅРѕРј Рё Р·РµР»РµРЅСЊСЋ',kcal:200,protein:30,fat:2,carbs:14,foods:'РўСѓРЅРµС† 170Рі, Р»РёРјРѕРЅРЅС‹Р№ СЃРѕРє, РїРµС‚СЂСѓС€РєР°'},
        {name:'Р‘РµР»РєРѕРІС‹Р№ РѕРјР»РµС‚ СЃ СЂСѓРєРєРѕР»РѕР№',kcal:180,protein:22,fat:5,carbs:8,foods:'Р‘РµР»РєРё 4С€С‚, 1 Р¶РµР»С‚РѕРє, СЂСѓРєРєРѕР»Р° 50Рі'},
        {name:'Р—Р°РїРµС‡С‘РЅРЅР°СЏ СЂС‹Р±Р° СЃ С†СѓРєРёРЅРё',kcal:220,protein:32,fat:3,carbs:16,foods:'РўСЂРµСЃРєР° 190Рі, С†СѓРєРёРЅРё 200Рі'},
        {name:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° СЃ РІРµС€РµРЅРєР°РјРё',kcal:240,protein:36,fat:5,carbs:14,foods:'РљСѓСЂРёРЅР°СЏ РіСЂСѓРґРєР° 170Рі, РІРµС€РµРЅРєРё 150Рі'},
        {name:'РњРёРЅС‚Р°Р№ СЃ С‚СѓС€С‘РЅС‹Рј РїРµСЂС†РµРј Рё Р·РµР»РµРЅСЊСЋ',kcal:215,protein:32,fat:2,carbs:16,foods:'РњРёРЅС‚Р°Р№ 200Рі, Р±РѕР»РіР°СЂСЃРєРёР№ РїРµСЂРµС† 150Рі, СѓРєСЂРѕРї'}
      ],
      'РџРµСЂРµРєСѓСЃ': [
        {name:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚',kcal:100,protein:12,fat:0,carbs:12,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 150Рі'},
        {name:'РљР»СѓР±РЅРёРєР°',kcal:50,protein:1,fat:0,carbs:12,foods:'РљР»СѓР±РЅРёРєР° 150Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ СЏРіРѕРґР°РјРё',kcal:130,protein:18,fat:1,carbs:14,foods:'РўРІРѕСЂРѕРі 0% 130Рі, СЏРіРѕРґС‹ 50Рі'},
        {name:'РљРµС„РёСЂ 0%',kcal:80,protein:8,fat:0,carbs:10,foods:'РљРµС„РёСЂ 0% 250РјР»'},
        {name:'РћРіСѓСЂС†С‹ СЃ С…СѓРјСѓСЃРѕРј',kcal:120,protein:4,fat:5,carbs:14,foods:'РћРіСѓСЂС†С‹ 150Рі, С…СѓРјСѓСЃ 30Рі'},
        {name:'РЇР±Р»РѕРєРѕ СЃ РєРѕСЂРёС†РµР№',kcal:80,protein:0,fat:0,carbs:20,foods:'РЇР±Р»РѕРєРѕ 1С€С‚, РєРѕСЂРёС†Р°'},
        {name:'Р™РѕРіСѓСЂС‚ СЃ СЏРіРѕРґР°РјРё',kcal:130,protein:10,fat:0,carbs:22,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 120Рі, СЏРіРѕРґС‹ 60Рі'},
        {name:'РћРіСѓСЂС†С‹ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:120,protein:14,fat:1,carbs:10,foods:'РћРіСѓСЂС†С‹ 2С€С‚, С‚РІРѕСЂРѕРі 0% 80Рі'},
        {name:'Р“СЂРµР№РїС„СЂСѓС‚',kcal:60,protein:1,fat:0,carbs:14,foods:'Р“СЂРµР№РїС„СЂСѓС‚ ВЅС€С‚'},
        {name:'РљРµС„РёСЂ СЃ РѕРіСѓСЂС†РѕРј',kcal:90,protein:6,fat:0,carbs:14,foods:'РљРµС„РёСЂ 0% 200РјР», РѕРіСѓСЂРµС† 1С€С‚'},
        {name:'Р§РµСЂРЅРёРєР°',kcal:70,protein:1,fat:0,carbs:17,foods:'Р§РµСЂРЅРёРєР° 100Рі'},
        {name:'РўРІРѕСЂРѕР¶РЅС‹Р№ РјСѓСЃСЃ',kcal:140,protein:18,fat:0,carbs:16,foods:'РўРІРѕСЂРѕРі 0% РІР·Р±РёС‚С‹Р№ 150Рі, РІР°РЅРёР»СЊ'},
        {name:'РњР°РЅРґР°СЂРёРЅС‹',kcal:60,protein:1,fat:0,carbs:14,foods:'РњР°РЅРґР°СЂРёРЅС‹ 2С€С‚'},
        {name:'РЇР№С†Рѕ РІР°СЂС‘РЅРѕРµ',kcal:80,protein:8,fat:5,carbs:0,foods:'РЇР№С†Рѕ 1С€С‚'},
        {name:'РњРѕСЂРєРѕРІРЅС‹Рµ РїР°Р»РѕС‡РєРё',kcal:50,protein:1,fat:0,carbs:12,foods:'РњРѕСЂРєРѕРІСЊ 150Рі РЅР°СЂРµР·Р°С‚СЊ'},
        {name:'РљРµС„РёСЂ СЃ РјСЏС‚РѕР№',kcal:80,protein:8,fat:0,carbs:10,foods:'РљРµС„РёСЂ 0% 250РјР», РјСЏС‚Р°, Р»С‘Рґ'},
        {name:'РЎРјСѓР·Рё РєРµС„РёСЂ СЃ РєР»СѓР±РЅРёРєРѕР№',kcal:130,protein:8,fat:0,carbs:24,foods:'РљРµС„РёСЂ 0% 150РјР», РєР»СѓР±РЅРёРєР° 80Рі'},
        {name:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ СЃ РѕРіСѓСЂС†РѕРј',kcal:110,protein:12,fat:0,carbs:12,foods:'Р™РѕРіСѓСЂС‚ 0% 120Рі, РѕРіСѓСЂРµС†, Р·РµР»РµРЅСЊ'},
        {name:'РЎРµР»СЊРґРµСЂРµР№ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:100,protein:12,fat:1,carbs:10,foods:'РЎРµР»СЊРґРµСЂРµР№ 100Рі, С‚РІРѕСЂРѕРі 0% 80Рі'},
        {name:'РђСЂР±СѓР·',kcal:80,protein:1,fat:0,carbs:20,foods:'РђСЂР±СѓР· 300Рі'},
        {name:'РҐР»РµР±С†С‹ СЃ С‚РІРѕСЂРѕРіРѕРј',kcal:160,protein:14,fat:1,carbs:22,foods:'РҐР»РµР±С†С‹ 3С€С‚, С‚РІРѕСЂРѕРі 0% 70Рі'},
        {name:'РџРёС‚СЊРµРІРѕР№ Р№РѕРіСѓСЂС‚ СЃ СЏРіРѕРґР°РјРё',kcal:120,protein:8,fat:0,carbs:22,foods:'Р™РѕРіСѓСЂС‚ РїРёС‚СЊРµРІРѕР№ 0% 150РјР», СЏРіРѕРґС‹ 50Рі'},
        {name:'РљРµС„РёСЂ СЃ РѕРіСѓСЂС†РѕРј Рё Р·РµР»РµРЅСЊСЋ',kcal:80,protein:4,fat:0,carbs:12,foods:'РљРµС„РёСЂ 0% 100РјР», РѕРіСѓСЂС†С‹ 150Рі, Р·РµР»РµРЅСЊ'},
        {name:'РЇРіРѕРґРЅС‹Р№ СЃРјСѓР·Рё',kcal:120,protein:6,fat:0,carbs:24,foods:'РљРµС„РёСЂ 0% 150РјР», РєР»СѓР±РЅРёРєР° + С‡РµСЂРЅРёРєР° 80Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ Р·РµР»РµРЅСЊСЋ',kcal:120,protein:16,fat:1,carbs:12,foods:'РўРІРѕСЂРѕРі 0% 130Рі, СѓРєСЂРѕРї, РѕРіСѓСЂРµС†'},
        {name:'РџРµСЂСЃРёРє',kcal:60,protein:1,fat:0,carbs:14,foods:'РџРµСЂСЃРёРє 1С€С‚'},
        {name:'РљРµС„РёСЂ СЃ РѕС‚СЂСѓР±СЏРјРё',kcal:130,protein:8,fat:0,carbs:22,foods:'РљРµС„РёСЂ 0% 200РјР», РѕС‚СЂСѓР±Рё 20Рі'},
        {name:'Р—РµР»С‘РЅС‹Р№ СЃРјСѓР·Рё',kcal:110,protein:4,fat:0,carbs:24,foods:'РЁРїРёРЅР°С‚, СЏР±Р»РѕРєРѕ, РѕРіСѓСЂРµС†, РІРѕРґР°'},
        {name:'РўРІРѕСЂРѕРі СЃ РѕРіСѓСЂС†РѕРј',kcal:120,protein:16,fat:1,carbs:12,foods:'РўРІРѕСЂРѕРі 0% 130Рі, РѕРіСѓСЂРµС† 1С€С‚'},
        {name:'Р—РµР»С‘РЅС‹Р№ С‡Р°Р№ СЃ РјС‘РґРѕРј',kcal:30,protein:0,fat:0,carbs:7,foods:'Р—РµР»С‘РЅС‹Р№ С‡Р°Р№ 300РјР», РјС‘Рґ ВЅ С‡.Р».'},
        {name:'РћРіСѓСЂС†С‹ СЃ Р№РѕРіСѓСЂС‚РѕРј Рё РјСЏС‚РѕР№',kcal:90,protein:6,fat:0,carbs:14,foods:'РћРіСѓСЂС†С‹ 200Рі, Р№РѕРіСѓСЂС‚ 0% 80РјР», РјСЏС‚Р°'},
        {name:'РђСЂР±СѓР· РєСѓР±РёРєР°РјРё',kcal:70,protein:1,fat:0,carbs:18,foods:'РђСЂР±СѓР· 250Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РєР»СЋРєРІРѕР№',kcal:130,protein:16,fat:0,carbs:16,foods:'РўРІРѕСЂРѕРі 0% 130Рі, РєР»СЋРєРІР° 40Рі'},
        {name:'РЎРјСѓР·Рё РёР· РјР°Р»РёРЅС‹',kcal:110,protein:6,fat:0,carbs:22,foods:'РљРµС„РёСЂ 0% 130РјР», РјР°Р»РёРЅР° 80Рі'},
        {name:'РљРµС„РёСЂ СЃРѕ С€РїРёРЅР°С‚РѕРј',kcal:90,protein:6,fat:0,carbs:14,foods:'РљРµС„РёСЂ 0% 200РјР», С€РїРёРЅР°С‚, Р»С‘Рґ РІР·Р±РёС‚СЊ'},
        {name:'Р“СЂРµР№РїС„СЂСѓС‚ СЃ РєРѕСЂРёС†РµР№',kcal:60,protein:1,fat:0,carbs:14,foods:'Р“СЂРµР№РїС„СЂСѓС‚ ВЅС€С‚, РєРѕСЂРёС†Р°'},
        {name:'РўРІРѕСЂРѕРі СЃ Р·РµР»С‘РЅС‹Рј Р»СѓРєРѕРј',kcal:120,protein:16,fat:0,carbs:12,foods:'РўРІРѕСЂРѕРі 0% 130Рі, Р·РµР»С‘РЅС‹Р№ Р»СѓРє, РѕРіСѓСЂРµС†'},
        {name:'РЇРіРѕРґРЅС‹Р№ СЃРјСѓР·Рё СЃ РјСЏС‚РѕР№',kcal:120,protein:6,fat:0,carbs:24,foods:'РљРµС„РёСЂ 0% 130РјР», СЏРіРѕРґС‹ 80Рі, РјСЏС‚Р°'},
        {name:'Р™РѕРіСѓСЂС‚ СЃ РјР°Р»РёРЅРѕР№',kcal:120,protein:10,fat:0,carbs:22,foods:'Р“СЂРµС‡РµСЃРєРёР№ Р№РѕРіСѓСЂС‚ 0% 120Рі, РјР°Р»РёРЅР° 60Рі'},
        {name:'РћРіСѓСЂС†С‹ СЃ Р±СЂС‹РЅР·РѕР№',kcal:100,protein:6,fat:4,carbs:8,foods:'РћРіСѓСЂС†С‹ 200Рі, Р±СЂС‹РЅР·Р° 30Рі'},
        {name:'РљРµС„РёСЂ СЃ Р»РёРјРѕРЅРѕРј',kcal:80,protein:8,fat:0,carbs:10,foods:'РљРµС„РёСЂ 0% 250РјР», Р»РёРјРѕРЅРЅС‹Р№ СЃРѕРє, СЃС‚РµРІРёСЏ'},
        {name:'РЎРјСѓР·Рё РєР»СѓР±РЅРёРєР° СЃ РѕРіСѓСЂС†РѕРј',kcal:100,protein:4,fat:0,carbs:22,foods:'РљР»СѓР±РЅРёРєР° 80Рі, РѕРіСѓСЂРµС†, РІРѕРґР°, Р»С‘Рґ'},
        {name:'РўРІРѕСЂРѕРі СЃ РєРёРІРё',kcal:150,protein:18,fat:0,carbs:20,foods:'РўРІРѕСЂРѕРі 0% 130Рі, РєРёРІРё 1С€С‚'},
        {name:'РЇР±Р»РѕРєРѕ СЃ РєРѕСЂРёС†РµР№ Рё СЃС‚РµРІРёРµР№',kcal:80,protein:0,fat:0,carbs:20,foods:'РЇР±Р»РѕРєРѕ 1С€С‚, РєРѕСЂРёС†Р°, СЃС‚РµРІРёСЏ'},
        {name:'РњРѕСЂРєРѕРІРЅС‹Рµ РїР°Р»РѕС‡РєРё СЃ С…СѓРјСѓСЃРѕРј',kcal:120,protein:4,fat:4,carbs:16,foods:'РњРѕСЂРєРѕРІСЊ 150Рі, С…СѓРјСѓСЃ 30Рі'},
        {name:'РўРІРѕСЂРѕРі СЃ РјР°РЅРіРѕ',kcal:160,protein:18,fat:0,carbs:22,foods:'РўРІРѕСЂРѕРі 0% 130Рі, РјР°РЅРіРѕ 60Рі'},
        {name:'РЎРјСѓР·Рё РёР· С‡РµСЂРЅРёРєРё',kcal:120,protein:6,fat:0,carbs:24,foods:'РљРµС„РёСЂ 0% 130РјР», С‡РµСЂРЅРёРєР° 80Рі'},
        {name:'РљРµС„РёСЂ СЃ РІР°РЅРёР»СЊСЋ',kcal:80,protein:8,fat:0,carbs:10,foods:'РљРµС„РёСЂ 0% 250РјР», РІР°РЅРёР»СЊ, СЃС‚РµРІРёСЏ'},
        {name:'Р’РёРЅРѕРіСЂР°Рґ Р·Р°РјРѕСЂРѕР¶РµРЅРЅС‹Р№',kcal:80,protein:1,fat:0,carbs:20,foods:'Р’РёРЅРѕРіСЂР°Рґ Р±РµР· РєРѕСЃС‚РѕС‡РµРє 80Рі Р·Р°РјРѕСЂРѕР¶РµРЅРЅС‹Р№'},
        {name:'РўРІРѕСЂРѕРі СЃ Р°РЅР°РЅР°СЃРѕРј',kcal:150,protein:18,fat:0,carbs:20,foods:'РўРІРѕСЂРѕРі 0% 130Рі, Р°РЅР°РЅР°СЃ 70Рі'},
        {name:'РЎРјСѓР·Рё РёР· РїРµСЂСЃРёРєР°',kcal:130,protein:6,fat:0,carbs:28,foods:'РљРµС„РёСЂ 0% 130РјР», РїРµСЂСЃРёРє 1С€С‚'},
        {name:'РўРІРѕСЂРѕРі СЃ Р°Р±СЂРёРєРѕСЃРѕРј',kcal:160,protein:18,fat:0,carbs:22,foods:'РўРІРѕСЂРѕРі 0% 130Рі, Р°Р±СЂРёРєРѕСЃС‹ 2С€С‚'},
        {name:'РљРµС„РёСЂ СЃ РєСѓСЂРєСѓРјРѕР№',kcal:90,protein:8,fat:0,carbs:12,foods:'РљРµС„РёСЂ 0% 250РјР», РєСѓСЂРєСѓРјР° ВЅ С‡.Р».'},
        {name:'РђСЂР±СѓР· СЃ РјСЏС‚РѕР№',kcal:70,protein:1,fat:0,carbs:18,foods:'РђСЂР±СѓР· 250Рі, РјСЏС‚Р°'},
        {name:'РўРІРѕСЂРѕРі СЃ РІРёС€РЅРµР№',kcal:150,protein:18,fat:0,carbs:20,foods:'РўРІРѕСЂРѕРі 0% 130Рі, РІРёС€РЅСЏ 60Рі'},
        {name:'РЎРјСѓР·Рё РєРµС„РёСЂ СЃ Р±Р°РЅР°РЅРѕРј',kcal:170,protein:8,fat:0,carbs:34,foods:'РљРµС„РёСЂ 0% 130РјР», Р±Р°РЅР°РЅ ВЅС€С‚, РІР°РЅРёР»СЊ'},
        {name:'РќР°С‚СѓСЂР°Р»СЊРЅС‹Р№ Р№РѕРіСѓСЂС‚ СЃ С‡РµСЂРЅРёРєРѕР№',kcal:130,protein:10,fat:0,carbs:22,foods:'Р™РѕРіСѓСЂС‚ 0% 120Рі, С‡РµСЂРЅРёРєР° 60Рі'},
        {name:'РљРµС„РёСЂ СЃ РёРјР±РёСЂС‘Рј Рё Р»РёРјРѕРЅРѕРј',kcal:90,protein:6,fat:0,carbs:16,foods:'РљРµС„РёСЂ 0% 200РјР», РёРјР±РёСЂСЊ, Р»РёРјРѕРЅРЅС‹Р№ СЃРѕРє'},
        {name:'РћРіСѓСЂРµС† СЃ СЂСѓРєРєРѕР»РѕР№',kcal:40,protein:2,fat:0,carbs:6,foods:'РћРіСѓСЂС†С‹ 200Рі, СЂСѓРєРєРѕР»Р°, Р»РёРјРѕРЅ'}
      ]
    }
  }
};

let _ntCurrentCat = null;
let _ntCurrentMealType = null;

function openNutTemplates(cat) {
  _ntCurrentCat = cat;
  const c = NUT_TEMPLATES[cat];
  document.getElementById('ntModalTitle').textContent = c.label.replace('\n',' ');
  document.getElementById('ntDetailView').classList.remove('show');
  document.getElementById('ntListView').style.display = 'none';
  document.getElementById('ntMealTypeView').style.display = 'block';
  document.getElementById('ntBackBtn').onclick = () => closeNutTemplates();
  const MEAL_TYPES = [
    {key:'Р—Р°РІС‚СЂР°Рє',icon:'рџЊ…'},
    {key:'РћР±РµРґ',icon:'вЂпёЏ'},
    {key:'РЈР¶РёРЅ',icon:'рџЊ™'},
    {key:'РџРµСЂРµРєСѓСЃ',icon:'рџЌЋ'}
  ];
  document.getElementById('ntMealTypes').innerHTML = MEAL_TYPES.map(m => `
    <div class="nt-meal-type-btn" onclick="openNutMealType('${m.key}')">
      <div class="nt-meal-type-icon">${m.icon}</div>
      <div class="nt-meal-type-name">${m.key}</div>
    </div>
  `).join('');
  document.getElementById('moNutTemplates').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function openNutMealType(mealType) {
  _ntCurrentMealType = mealType;
  const items = NUT_TEMPLATES[_ntCurrentCat].meals[mealType];
  document.getElementById('ntModalTitle').textContent = mealType;
  document.getElementById('ntMealTypeView').style.display = 'none';
  document.getElementById('ntListView').style.display = 'block';
  document.getElementById('ntBackBtn').onclick = () => {
    document.getElementById('ntListView').style.display = 'none';
    document.getElementById('ntMealTypeView').style.display = 'block';
    document.getElementById('ntModalTitle').textContent = NUT_TEMPLATES[_ntCurrentCat].label.replace('\n',' ');
    document.getElementById('ntBackBtn').onclick = () => closeNutTemplates();
  };
  document.getElementById('ntList').innerHTML = items.map((t,i) => `
    <div class="nt-item" onclick="openNutDetail(${i})">
      <div style="flex:1;min-width:0">
        <div class="nt-item-name">${t.name}</div>
        <div class="nt-item-macros">Р‘: ${t.protein}Рі &nbsp;Р–: ${t.fat}Рі &nbsp;РЈ: ${t.carbs}Рі</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        <div class="nt-item-kcal">${t.kcal} <span style="font-size:10px;color:var(--mu2)">РєРєР°Р»</span></div>
        <button class="nt-add-btn" onclick="addNutFromTemplate(${i},event)" title="Р”РѕР±Р°РІРёС‚СЊ РІ ${mealType}">+</button>
      </div>
    </div>
  `).join('');
}

function openNutDetail(idx) {
  const t = NUT_TEMPLATES[_ntCurrentCat].meals[_ntCurrentMealType][idx];
  document.getElementById('ntModalTitle').textContent = t.name;
  document.getElementById('ntBackBtn').onclick = () => {
    document.getElementById('ntDetailView').classList.remove('show');
    document.getElementById('ntListView').style.display = 'block';
    document.getElementById('ntModalTitle').textContent = _ntCurrentMealType;
    document.getElementById('ntBackBtn').onclick = () => {
      document.getElementById('ntListView').style.display = 'none';
      document.getElementById('ntMealTypeView').style.display = 'block';
      document.getElementById('ntModalTitle').textContent = NUT_TEMPLATES[_ntCurrentCat].label.replace('\n',' ');
      document.getElementById('ntBackBtn').onclick = () => closeNutTemplates();
    };
  };
  document.getElementById('ntDetailName').textContent = t.name;
  document.getElementById('ntDKcal').textContent = t.kcal;
  document.getElementById('ntDProt').textContent = t.protein;
  document.getElementById('ntDFat').textContent = t.fat;
  document.getElementById('ntDCarb').textContent = t.carbs;
  document.getElementById('ntDetailMeals').innerHTML = `
    <div class="nt-meal">
      <div class="nt-meal-time">РЎРѕСЃС‚Р°РІ</div>
      <div class="nt-meal-foods">${t.foods}</div>
    </div>
  `;
  document.getElementById('ntListView').style.display = 'none';
  document.getElementById('ntDetailView').classList.add('show');
}

async function addNutFromTemplate(idx, event) {
  event.stopPropagation();
  if (!ME) return toast('Р’РѕР№РґРёС‚Рµ РІ СЃРёСЃС‚РµРјСѓ', 'e');
  const t = NUT_TEMPLATES[_ntCurrentCat].meals[_ntCurrentMealType][idx];
  const typeMap = {'Р—Р°РІС‚СЂР°Рє':'breakfast','РћР±РµРґ':'lunch','РЈР¶РёРЅ':'dinner','РџРµСЂРµРєСѓСЃ':'snack'};
  const type = typeMap[_ntCurrentMealType] || 'breakfast';
  const btn = event.currentTarget;
  btn.disabled = true;
  try {
    const r = await authFetch(`/api/nutrition/${ME.id}`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({name:t.name, type, kcal:t.kcal, protein:t.protein, fat:t.fat, carbs:t.carbs, date:_nutDate})
    });
    if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'РћС€РёР±РєР°'); }
    toast('вњ… Р”РѕР±Р°РІР»РµРЅРѕ РІ ' + _ntCurrentMealType.toLowerCase(), 's');
    loadUserNutrition();
  } catch(e) { toast('РћС€РёР±РєР°: ' + e.message, 'e'); }
  btn.disabled = false;
}

function closeNutTemplates() {
  document.getElementById('moNutTemplates').classList.remove('show');
  document.body.style.overflow = '';
}


