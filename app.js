
// ═══════════════════════════════════════════════
//  CONSTANTS & DEFAULTS
// ═══════════════════════════════════════════════
const CAT_COLORS=['#185FA5','#1D9E75','#D85A30','#BA7517','#534AB7','#3B6D11','#993C1D','#D4537E','#0F6E56','#963C00','#2a7a8a','#7b3fa0'];
const CAT_EMOJI={
  'Entertainment':'🎬','Fast Food':'🍔','Grocery':'🛒','Home Improvement':'🏠',
  'Travel':'✈️','Fuel':'⛽','Dress':'👗','Rent / Bills':'🏢',
  'Salary':'💼','Freelance':'💻','Business':'📊','Investment':'📈',
  'Medical':'💊','Education':'📚','Gift':'🎁','Other':'📦'
};
// Expense Categories
const DEFAULT_EXPENSE_CATS=[
  'Entertainment',
  'Fast Food',
  'Grocery',
  'Home Improvement',
  'Travel',
  'Fuel',
  'Dress',
  'Rent / Bills',
  'Medical',
  'Education',
  'Gift',
  'Other'
];

// Income Categories
const DEFAULT_INCOME_CATS=[
  'Salary Income',
  'Business Income'
];
const BOOK_EMOJIS=['📒','📓','📔','📕','📗','📘','📙','💼','🏦','🏪','🏠','✈️'];

function catEmoji(n){return CAT_EMOJI[n]||n.charAt(0).toUpperCase();}
function fmt(n){return '₹'+Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});}
function fmtSgn(n){return (n>=0?'+':'-')+'₹'+Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function monthKey(d){return d.slice(0,7);}
function monthLabel(m){const[y,mo]=m.split('-');return new Date(+y,+mo-1,1).toLocaleString('default',{month:'short',year:'numeric'});}
function today(){return new Date().toISOString().slice(0,10);}

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let S={
  user:null,
  isGuest:false,

  books:[],
  currentBookId:null,

  transactions:[],

  categories:{},

  currentMonth:today().slice(0,7),
  currentPage:'dashboard'
};

// ═══════════════════════════════════════════════
//  PERSISTENCE (localStorage = device backup)
// ═══════════════════════════════════════════════
function save(){
  try{localStorage.setItem('fp_v2',JSON.stringify(S));}catch(e){}
}
function load(){
  try{
    const raw=localStorage.getItem('fp_v2');
    if(raw){const d=JSON.parse(raw);Object.assign(S,d);}
  }catch(e){}
}

// ═══════════════════════════════════════════════
//  AUTH (local accounts stored in localStorage)
//  In a real app, swap this for Firebase/Supabase
// ═══════════════════════════════════════════════
let authMode='login';
// Track whether user explicitly signed out (prevents ghost re-login)
let _userExplicitlySignedOut = localStorage.getItem('fp_signed_out') === '1';
function switchAuthTab(m){
  authMode=m;
  document.getElementById('tabLogin').classList.toggle('active',m==='login');
  document.getElementById('tabReg').classList.toggle('active',m==='register');
  document.getElementById('nameGroup').style.display=m==='register'?'block':'none';
  document.getElementById('authSubmitBtn').textContent=m==='login'?'Sign In':'Create Account';
  document.getElementById('authErr').style.display='none';
}

function getUsers(){
  try{return JSON.parse(localStorage.getItem('fp_users')||'[]');}catch{return [];}
}
function saveUsers(u){localStorage.setItem('fp_users',JSON.stringify(u));}

function hashPassword(v){ let h=0; for(let i=0;i<v.length;i++){ h=((h<<5)-h)+v.charCodeAt(i); h|=0;} return 'h'+Math.abs(h); }
function handleAuth(){
  const email=document.getElementById('fEmail').value.trim().toLowerCase();
  const pass=document.getElementById('fPassword').value;
  const name=document.getElementById('fName').value.trim();
  const err=document.getElementById('authErr');
  err.style.display='none';
  if(!email||!pass){err.textContent='Please fill in all fields.';err.style.display='block';return;}
  const users=getUsers();
  if(authMode==='register'){
    if(!name){err.textContent='Please enter your name.';err.style.display='block';return;}
    if(users.find(u=>u.email===email)){err.textContent='Email already registered.';err.style.display='block';return;}
    if(pass.length<6){err.textContent='Password must be at least 6 characters.';err.style.display='block';return;}
    const user={id:uid(),email,name,password:hashPassword(pass),initials:name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()};
    users.push(user);saveUsers(users);
    loginUser(user);
  } else {
    const user=users.find(u=>u.email===email&&u.password===hashPassword(pass));
    if(!user){err.textContent='Invalid email or password.';err.style.display='block';return;}
    loginUser(user);
  }
}

function handleGoogleAuth(){
  // Simulate Google OAuth — in prod, integrate Firebase Auth
  const email=prompt('Enter your Gmail address:','');
  if(!email||!email.includes('@'))return;
  const users=getUsers();
  let user=users.find(u=>u.email===email.toLowerCase());
  if(!user){
    const name=email.split('@')[0];
    user={id:uid(),email:email.toLowerCase(),name,password:'',initials:name.slice(0,2).toUpperCase(),google:true};
    users.push(user);saveUsers(users);
  }
  loginUser(user);
}

function loginUser(user){
  // Clear explicit sign-out flag — user is now intentionally logging in
  localStorage.removeItem('fp_signed_out');
  _userExplicitlySignedOut=false;
  // Write presence to Firebase so other devices can detect
  if(window.db && user.id){
    const sessionId=uid();
    localStorage.setItem('fp_session_'+user.id, sessionId);
    try{
      window.dbSet(window.dbRef(window.db,'presence/'+user.id),{
        sessionId,
        device:navigator.userAgent.slice(0,60),
        loginAt:new Date().toISOString()
      });
    }catch(e){}
  }
  // Load local cache — Firebase data (loaded by the caller before loginUser) takes priority,
  // so only use the local cache if S has no books yet (i.e. Firebase didn't load anything).
  if(!S.books || !S.books.length){
    const cacheKeys=['fp_cache_'+user.id, 'fp_data_'+user.id];
    for(const key of cacheKeys){
      try{
        const raw=localStorage.getItem(key);
        if(raw){const d=JSON.parse(raw); Object.assign(S,d); break;}
      }catch{}
    }
  }
  S.user={id:user.id,name:user.name,email:user.email,initials:user.initials||'U'};
  // Ensure default book exists
  if(!S.books||!S.books.length){
    const book={id:uid(),name:'My Book',emoji:'📒',ownerId:user.id,members:[{userId:user.id,email:user.email,name:user.name,role:'owner'}]};
    S.books=[book];
    S.currentBookId=book.id;
S.categories[book.id]={
  expense:[...DEFAULT_EXPENSE_CATS],
  income:[...DEFAULT_INCOME_CATS]
};
    S.transactions=S.transactions||[];
  }
  if(!S.currentBookId)S.currentBookId=S.books[0].id;
  save();
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('mainScreen').classList.add('active');
  document.getElementById('userAvatar').textContent=S.user.initials;
  document.getElementById('headerBookName').textContent=currentBook().name;
  document.getElementById('headerBookIcon').textContent=currentBook().emoji;
  // Load shared book data from Firebase, then attach realtime listener
  loadSharedBooksThenRender();
  toast('Welcome back, '+S.user.name.split(' ')[0]+'! 👋');
}

async function loadSharedBooksThenRender(){
  if(!window.db) { renderMonthTabs();showPage('dashboard'); return; }
  
  // BUG FIX #1: Load books where user is invited but not yet in S.books
  try{
    const snap=await window.dbGet(window.dbRef(window.db,'expenseData/'+S.user.id));
    if(snap.exists()){
      const booksFromDB=(snap.val().books||[]);
      for(const b of booksFromDB){
        if(!S.books.find(sb=>sb.id===b.id)){
          S.books.push(b);
          // Initialize categories if missing
          if(!S.categories[b.id]){
            S.categories[b.id]={
              expense:[...DEFAULT_EXPENSE_CATS],
              income:[...DEFAULT_INCOME_CATS]
            };
          }
        }
      }
    }
  }catch(e){console.log('Error loading invited books:',e);}
  
  // Load all shared books this user is a member of
  const sharedBooks=S.books.filter(b=>isSharedBook(b.id));
  for(const b of sharedBooks){
    try{
      const snap=await window.dbGet(window.dbRef(window.db,'sharedBooks/'+b.id));
      if(snap.exists()){
        const data=snap.val();
        if(data.transactions){
          S.transactions=S.transactions.filter(t=>t.bookId!==b.id);
          const remoteTxns=Array.isArray(data.transactions)?data.transactions:Object.values(data.transactions);
          S.transactions.push(...remoteTxns.filter(t=>t&&t.id));
        }
        if(data.categories) S.categories[b.id]=data.categories;
        if(data.meta) Object.assign(b, data.meta);
      }
    }catch(e){console.log('load shared book error:',e);}
  }
  renderMonthTabs();showPage('dashboard');
  // Attach live listener to current book if shared
  attachSharedBookListener(S.currentBookId);
  // Monitor for other device sessions
  watchPresence();
}

let _presenceListener=null;
function watchPresence(){
  if(!window.db||!S.user||!window.dbOnValue) return;
  const mySession=localStorage.getItem('fp_session_'+S.user.id)||'';
  const presRef=window.dbRef(window.db,'presence/'+S.user.id);
  _presenceListener=window.dbOnValue(presRef,snap=>{
    if(!snap.exists()) return;
    const data=snap.val();
    // If a different session is active and we are on main screen
    if(data.sessionId && data.sessionId!==mySession && document.getElementById('mainScreen').classList.contains('active')){
      // Show non-blocking notice (don't force logout — Firebase allows multi-device)
      if(!document.getElementById('multiDeviceBanner')){
        const banner=document.createElement('div');
        banner.id='multiDeviceBanner';
        banner.innerHTML=`<div style="position:fixed;top:0;left:0;right:0;background:#f59e0b;color:#000;font-size:12px;font-weight:600;padding:8px 16px;z-index:9999;display:flex;justify-content:space-between;align-items:center">
          <span>⚠️ This account signed in on another device</span>
          <button onclick="document.getElementById('multiDeviceBanner').remove()" style="background:none;border:none;cursor:pointer;font-size:16px;font-weight:700">×</button>
        </div>`;
        document.body.prepend(banner);
        setTimeout(()=>{const b=document.getElementById('multiDeviceBanner');if(b)b.remove();},5000);
      }
    }
  });
}


  
function continueAsGuest(){
  S.isGuest=true;
  if(!S.books || !S.books.length){
    const guestBook={id:'guest-book',name:'Demo Book',emoji:'📒',ownerId:'guest',members:[]};
    S.books=[guestBook];
    S.currentBookId=guestBook.id;
    S.categories[guestBook.id]={expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
    S.transactions=[];
  }
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('mainScreen').classList.add('active');
  document.getElementById('userAvatar').textContent='👁';
  document.getElementById('headerBookName').textContent='Guest Mode';
  document.getElementById('headerBookIcon').textContent='👀';
  renderMonthTabs();showPage('dashboard');
  toast('Guest Mode — View Only');
}
function requireLogin(){ if(S.isGuest){ toast('Please login to continue'); return false;} return true; }

function logout(){
  S.isGuest=false;
  detachSharedBookListener();
  saveUserData();
  // Mark explicit sign-out to prevent Firebase auth listener from re-logging in
  localStorage.setItem('fp_signed_out','1');
  _userExplicitlySignedOut=true;
  // Sign out from Firebase
  if(window.signOutFirebase && window.auth){
    window.signOutFirebase(window.auth).catch(e=>{});
  }
  S={
    user:null,
    isGuest:false,
    books:[],
    currentBookId:null,
    transactions:[],
    categories:{},
    currentMonth:today().slice(0,7),
    currentPage:'dashboard'
  };
  document.getElementById('mainScreen').classList.remove('active');
  document.getElementById('authScreen').classList.add('active');
  closeSheetNow();
}
function guestBlocked(){

  if(S.isGuest){
    toast('Please login to continue');
    return true;
  }

  return false;
}
// saveUserData is defined near the bottom of this file (Firebase version).
// Do NOT add a second definition here — it would shadow the Firebase one.

// ═══════════════════════════════════════════════
//  BOOKS
// ═══════════════════════════════════════════════
function currentBook(){return S.books.find(b=>b.id===S.currentBookId)||S.books[0];}

// ── SHARED BOOK SYNC ────────────────────────────────────────────────
// Shared books store transactions+categories at sharedBooks/{bookId}/
// Personal books stay at expenseData/{uid} as before.
// A book is "shared" if it has >1 member OR the current user is not the owner.

function isSharedBook(bookId){
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b) return false;
  return b.shared===true || (b.members && b.members.length > 1);
}

let _sharedBookListener=null;  // active Firebase onValue unsubscribe fn
let _listenedBookId=null;

function attachSharedBookListener(bookId){
  if(!window.db || !window.dbOnValue) return;
  // Detach previous listener
  detachSharedBookListener();
  if(!isSharedBook(bookId)) return;
  _listenedBookId=bookId;
  const path=window.dbRef(window.db,'sharedBooks/'+bookId);
  _sharedBookListener=window.dbOnValue(path, snap=>{
    if(!snap.exists()) return;
    const data=snap.val();
    // Check for deletion tombstone
    if(data.deleted===true){
      detachSharedBookListener();
      _removeBookLocally(bookId);
      toast('📕 A shared book was deleted by its owner');
      if(document.getElementById('mainScreen').classList.contains('active')){
        renderMonthTabs();renderPage();
      }
      return;
    }
    // Merge transactions for this book from remote
    if(data.transactions){
      // Remove local txns for this book, replace with remote
      S.transactions=S.transactions.filter(t=>t.bookId!==bookId);
      const remoteTxns=Array.isArray(data.transactions)
        ? data.transactions
        : Object.values(data.transactions);
      S.transactions.push(...remoteTxns.filter(t=>t && t.id));
    }
    // Merge categories
    if(data.categories){
      S.categories[bookId]=data.categories;
    }
    // Merge book metadata (name/emoji/members)
    if(data.meta){
      const bi=S.books.findIndex(bk=>bk.id===bookId);
      if(bi>=0) Object.assign(S.books[bi], data.meta);
    }
    // Re-render if this is the active book
    if(S.currentBookId===bookId){
      renderMonthTabs();renderPage();
    }
    // Persist locally (cache)
    if(S.user) localStorage.setItem('fp_cache_'+S.user.id, JSON.stringify({
      books:S.books,currentBookId:S.currentBookId,
      transactions:S.transactions,categories:S.categories,currentMonth:S.currentMonth
    }));
  });
}

function detachSharedBookListener(){
  if(_sharedBookListener){
    try{_sharedBookListener();}catch(e){}  // onValue returns unsubscribe fn
    _sharedBookListener=null;
    _listenedBookId=null;
  }
}

async function saveSharedBookData(bookId){
  if(!window.db) return;
  showSyncIndicator('syncing');
  const txns=S.transactions.filter(t=>t.bookId===bookId);
  const cats=S.categories[bookId]||{expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
  const b=S.books.find(bk=>bk.id===bookId);
  const meta=b?{name:b.name,emoji:b.emoji,members:b.members,ownerId:b.ownerId}:{};
  try{
    await window.dbSet(window.dbRef(window.db,'sharedBooks/'+bookId),{
      transactions:txns,
      categories:cats,
      meta
    });
    // Also write bookIndex for discoverability
    await window.dbSet(window.dbRef(window.db,'bookIndex/'+bookId),{ownerId:b?b.ownerId:''});
    showSyncIndicator('synced');
  }catch(e){
    console.log('sharedBook save error:',e);
    showSyncIndicator('error');
  }
}
function bookTxns(bookId,month){return S.transactions.filter(t=>t.bookId===bookId&&t.date.startsWith(month));}
function bookCats(bookId,type){

  if(!S.categories){
    S.categories={};
  }

  if(!S.categories[bookId]){

    S.categories[bookId]={
      expense:[
        ...DEFAULT_EXPENSE_CATS
      ],
      income:[
        ...DEFAULT_INCOME_CATS
      ]
    };
  }

  if(type){
    return (
      S.categories[bookId][type]
      || []
    );
  }

  return [
    ...S.categories[bookId]
      .expense,
    ...S.categories[bookId]
      .income
  ];
}

function openBooksSheet(){
  document.getElementById('sheetBg').classList.add('open');
  renderBooksSheet();
}

function renderBooksSheet(){
  const items=S.books.map(b=>{
    const isOwner=b.ownerId===S.user.id;
    const isShared=b.members.length>1;
    const isCurrent=b.id===S.currentBookId;
    return `<div class="book-item ${isCurrent?'current':''}">
      <div onclick="selectBook('${b.id}')" style="display:flex;align-items:center;flex:1;gap:10px;cursor:pointer">
        <div class="book-item-icon" style="background:${isCurrent?'#185FA520':'var(--surface)'};border:1.5px solid var(--border)">${b.emoji}</div>
        <div class="book-item-body">
          <div class="book-item-name">${b.name}</div>
          <div class="book-item-meta">${b.members.length} member${b.members.length>1?'s':''} · ${isOwner?'Owner':'Member'}</div>
        </div>
        ${isShared?`<span class="book-badge shared-badge">Shared</span>`:''}
        ${isCurrent?`<span class="book-badge">Active</span>`:''}
      </div>
      <div style="position:relative">
        <button class="book-menu-btn" onclick="toggleBookMenu('${b.id}')" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px;padding:6px;margin-left:4px" title="More options">⋮</button>
        <div class="book-menu-popup" id="menu-${b.id}" style="display:none;position:absolute;top:100%;right:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;min-width:140px;overflow:hidden">
          ${isOwner?`
            <button onclick="openRenameBookSheet('${b.id}')" style="display:block;width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:var(--text);cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">✏️ Rename</button>
            <button onclick="openBookSettingsSheet('${b.id}')" style="display:block;width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:var(--text);cursor:pointer;font-size:13px" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">⚙️ Settings</button>
          `:`
            <button onclick="openLeaveBookConfirm('${b.id}')" style="display:block;width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:var(--red);cursor:pointer;font-size:13px" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">🚪 Leave Book</button>
          `}
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Your Books
      <button class="close-btn" onclick="closeSheetNow()">×</button>
    </div>
    ${items}
    <div class="divider"></div>
    <button class="btn btn-primary" onclick="openAddBookSheet()" style="margin-bottom:8px">+ New Book</button>
    <button class="btn btn-outline" onclick="openJoinBookSheet()">Join Shared Book</button>
  `;
}

function toggleBookMenu(bookId){
  const menu=document.getElementById('menu-'+bookId);
  if(!menu) return;
  // Close other menus
  document.querySelectorAll('.book-menu-popup').forEach(m=>m.style.display='none');
  // Toggle this menu
  menu.style.display=menu.style.display==='none'?'block':'none';
}

// Close menu when clicking outside
document.addEventListener('click',function(e){
  if(!e.target.closest('.book-menu-btn')&&!e.target.closest('.book-menu-popup')){
    document.querySelectorAll('.book-menu-popup').forEach(m=>m.style.display='none');
  }
});

function openRenameBookSheet(bookId){
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b){toast('Book not found');return;}
  if(b.ownerId!==S.user.id){toast('Only the owner can rename this book');return;}
  
  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Rename Book
      <button class="close-btn" onclick="openBooksSheet()">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">Book Name</label>
      <input class="form-input" id="renameBookInput" placeholder="Book name..." value="${b.name}" autofocus />
    </div>
    <button class="btn btn-primary" onclick="saveRenameBook('${bookId}')">Save</button>
    <button class="btn btn-outline" onclick="openBooksSheet()" style="margin-top:8px">Cancel</button>
  `;
  document.getElementById('sheetBg').classList.add('open');
}

function saveRenameBook(bookId){
  const name=document.getElementById('renameBookInput').value.trim();
  if(!name){toast('Enter a book name');return;}
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b)return;
  b.name=name;
  if(S.currentBookId===bookId){
    document.getElementById('headerBookName').textContent=b.name;
  }
  saveUserData();
  toast('Book renamed ✓');
  openBooksSheet();
}

function openBookSettingsSheet(bookId){
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b){toast('Book not found');return;}
  if(b.ownerId!==S.user.id){toast('Only the owner can access settings');return;}
  
  const membersList=b.members.filter(m=>m.userId!==S.user.id).map(m=>`
    <div class="member-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--surface2);border-radius:6px;margin-bottom:8px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${m.name}</div>
        <div style="font-size:12px;color:var(--text2)">${m.email}</div>
      </div>
      <button onclick="deleteUserFromBook('${bookId}','${m.email}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:4px">✕ Delete</button>
    </div>
  `).join('');
  
  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Book Settings
      <button class="close-btn" onclick="openBooksSheet()">×</button>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px">Delete Members</div>
    ${membersList?membersList:'<div style="font-size:12px;color:var(--text3);padding:10px">No members to remove</div>'}
    <div class="divider"></div>
    <button class="btn btn-danger" onclick="confirmDeleteBook('${bookId}')" style="width:100%">🗑️ Delete Book</button>
    <button class="btn btn-outline" onclick="openBooksSheet()" style="margin-top:8px;width:100%">Close</button>
  `;
  document.getElementById('sheetBg').classList.add('open');
}

function deleteUserFromBook(bookId,userEmail){
  if(!confirm(`Delete ${userEmail} from this book? They will no longer see it.`))return;
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b)return;
  b.members=b.members.filter(m=>m.email!==userEmail);
  saveUserData();
  if(isSharedBook(b.id)) saveSharedBookData(b.id);
  toast('Member removed ✓');
  openBookSettingsSheet(bookId);
}

function openLeaveBookConfirm(bookId){
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b)return;
  confirmLeaveBook(bookId);
}

function selectBook(id){
  S.currentBookId=id;
  const b=currentBook();
  document.getElementById('headerBookName').textContent=b.name;
  document.getElementById('headerBookIcon').textContent=b.emoji;
  saveUserData();
  // Attach realtime listener if switching to a shared book
  attachSharedBookListener(id);
  closeSheetNow();
  renderMonthTabs();showPage('dashboard');
}

function openAddBookSheet(){
  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">New Book
      <button class="close-btn" onclick="openBooksSheet()">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">Book Name</label>
      <input class="form-input" id="newBookName" placeholder="e.g. Business, Family, Travel..." />
    </div>
    <div class="form-group">
      <label class="form-label">Icon</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px" id="emojiPicker">
        ${BOOK_EMOJIS.map((e,i)=>`<div class="cat-chip ${i===0?'selected':''}" style="font-size:20px;padding:8px;justify-content:center" onclick="pickEmoji(this,'${e}')">${e}</div>`).join('')}
      </div>
    </div>
    <button class="btn btn-primary" onclick="createBook()" style="margin-top:8px">Create Book</button>
  `;
  window._newBookEmoji=BOOK_EMOJIS[0];
}

function pickEmoji(el,e){
  document.querySelectorAll('#emojiPicker .cat-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');window._newBookEmoji=e;
}

function createBook(){
  if(guestBlocked()) return;
  const name=document.getElementById('newBookName').value.trim();
  if(!name){toast('Enter a book name');return;}
  const book={id:uid(),name,emoji:window._newBookEmoji||'📒',ownerId:S.user.id,members:[{userId:S.user.id,email:S.user.email,name:S.user.name,role:'owner'}]};
  S.books.push(book);
 S.categories[book.id]={
  expense:[...DEFAULT_EXPENSE_CATS],
  income:[...DEFAULT_INCOME_CATS]
};
  S.currentBookId=book.id;
  document.getElementById('headerBookName').textContent=book.name;
  document.getElementById('headerBookIcon').textContent=book.emoji;
  saveUserData();
  // Register bookIndex for easy lookup by other users
  if(window.db){
    window.dbSet(window.dbRef(window.db,'bookIndex/'+book.id),{ownerId:S.user.id}).catch(e=>{});
  }
  closeSheetNow();
  renderMonthTabs();showPage('dashboard');
  toast('Book "'+name+'" created ✓');
}

function openEditBookSheet(bookId){
  // Deprecated: Use openRenameBookSheet or openBookSettingsSheet instead
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b){toast('Book not found');return;}
  if(b.ownerId!==S.user.id){toast('Only the owner can edit this book');return;}
  openRenameBookSheet(bookId);
}

function pickEmojiEdit(el,e){
  document.querySelectorAll('#emojiPickerEdit .cat-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');window._editBookEmoji=e;
}

function saveEditBook(bookId){
  const name=document.getElementById('editBookName').value.trim();
  if(!name){toast('Enter a book name');return;}
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b)return;
  b.name=name;
  b.emoji=window._editBookEmoji||b.emoji;
  if(S.currentBookId===bookId){
    document.getElementById('headerBookName').textContent=b.name;
    document.getElementById('headerBookIcon').textContent=b.emoji;
  }
  saveUserData();
  toast('Book updated ✓');
  openBooksSheet();
}

async function confirmDeleteBook(bookId){
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b)return;
  const isOwner=b.ownerId===S.user.id;
  if(!isOwner){toast('Only the owner can delete this book');return;}
  if(S.books.length===1){toast('Cannot delete your only book');return;}
  if(!confirm('Delete "'+b.name+'"? All entries will be lost for all members.'))return;
  // Write tombstone to Firebase so all members get notified via listener
  if(window.db && b.shared){
    try{
      await window.dbSet(window.dbRef(window.db,'sharedBooks/'+bookId+'/deleted'),true);
      await window.dbSet(window.dbRef(window.db,'sharedBooks/'+bookId+'/meta'),{name:b.name,deleted:true});
    }catch(e){console.log('tombstone error:',e);}
  }
  _removeBookLocally(bookId);
  toast('Book deleted');
  openBooksSheet();
}

function _removeBookLocally(bookId){
  S.transactions=S.transactions.filter(t=>t.bookId!==bookId);
  S.books=S.books.filter(bk=>bk.id!==bookId);
  delete S.categories[bookId];
  if(S.currentBookId===bookId){
    S.currentBookId=S.books[0]?S.books[0].id:null;
    if(S.books[0]){
      document.getElementById('headerBookName').textContent=S.books[0].name;
      document.getElementById('headerBookIcon').textContent=S.books[0].emoji;
    }
  }
  saveUserData();
}

function confirmLeaveBook(bookId){
  const b=S.books.find(bk=>bk.id===bookId);
  if(!b)return;
  if(!confirm('Leave "'+b.name+'"? You can rejoin with the Book ID later.'))return;
  // Remove self from members in sharedBooks meta
  if(window.db){
    window.dbGet(window.dbRef(window.db,'sharedBooks/'+bookId)).then(snap=>{
      if(snap.exists()){
        const data=snap.val();
        const meta=data.meta||{};
        meta.members=(meta.members||[]).filter(m=>m.userId!==S.user.id);
        window.dbSet(window.dbRef(window.db,'sharedBooks/'+bookId+'/meta'),meta).catch(e=>{});
      }
    }).catch(e=>{});
  }
  detachSharedBookListener();
  _removeBookLocally(bookId);
  toast('Left book');
  openBooksSheet();
}

function openJoinBookSheet(){
  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Join a Shared Book
      <button class="close-btn" onclick="openBooksSheet()">×</button>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">Ask the book owner to share their Book ID with you, then enter it below.</p>
    <div class="form-group">
      <label class="form-label">Book ID</label>
      <input class="form-input" id="joinBookId" placeholder="Paste book ID here..." />
    </div>
    <button class="btn btn-primary" onclick="joinBook()">Join Book</button>
  `;
}

async function joinBook(){
  if(guestBlocked()) return;
  const id=document.getElementById('joinBookId').value.trim();
  if(!id){toast('Please enter a book ID');return;}
  
  // Show loading
  const joinBtn=document.querySelector('#sheetInner .btn-primary');
  if(joinBtn){joinBtn.textContent='Searching...';joinBtn.disabled=true;}
  
  let found=null;let foundOwnerId=null;let foundOwnerKey=null;
  
  // Search Firebase expenseData index node (fast lookup)
  if(window.db){
    try{
      const idxSnap=await window.dbGet(window.dbRef(window.db,'bookIndex/'+id));
      if(idxSnap.exists()){
        const ownerId=idxSnap.val().ownerId;
        const ownerSnap=await window.dbGet(window.dbRef(window.db,'expenseData/'+ownerId));
        if(ownerSnap.exists()){
          const d=ownerSnap.val();
          const b=(d.books||[]).find(b=>b.id===id);
          if(b){found=b;foundOwnerId=ownerId;}
        }
      }
    }catch(e){console.log('Firebase index search error:',e);}
  }
  
  // Fallback: scan all Firebase users' expenseData
  if(!found && window.db){
    try{
      const allSnap=await window.dbGet(window.dbRef(window.db,'expenseData'));
      if(allSnap.exists()){
        const allData=allSnap.val();
        for(const [uid,udata] of Object.entries(allData)){
          const b=(udata.books||[]).find(b=>b.id===id);
          if(b){found=b;foundOwnerId=uid;break;}
        }
      }
    }catch(e){console.log('Firebase full scan error:',e);}
  }
  
  // Fallback: scan localStorage cached users
  if(!found){
    const users=getUsers();
    for(const u of users){
      try{
        const cacheKeys=['fp_data_'+u.id,'fp_cache_'+u.id];
        for(const k of cacheKeys){
          const d=JSON.parse(localStorage.getItem(k)||'{}');
          const b=(d.books||[]).find(b=>b.id===id);
          if(b){found=b;foundOwnerId=u.id;foundOwnerKey=k;break;}
        }
        if(found)break;
      }catch{}
    }
  }
  
  if(joinBtn){joinBtn.textContent='Join Book';joinBtn.disabled=false;}
  if(!found){toast('Book not found. Check the ID.');return;}
  if(found.members.find(m=>m.userId===S.user.id)){toast('You are already a member!');return;}
  
  // Add self to members
  found.members.push({userId:S.user.id,email:S.user.email,name:S.user.name,role:'member'});
  
  // Update owner's data (both localStorage and Firebase)
  if(foundOwnerKey){
    try{
      const d=JSON.parse(localStorage.getItem(foundOwnerKey)||'{}');
      const bi=d.books.findIndex(b=>b.id===id);
      if(bi>=0)d.books[bi]=found;
      localStorage.setItem(foundOwnerKey,JSON.stringify(d));
    }catch{}
  }
  
  // Update owner's Firebase data
  if(foundOwnerId && window.db){
    try{
      const ownerSnap=await window.dbGet(window.dbRef(window.db,'expenseData/'+foundOwnerId));
      if(ownerSnap.exists()){
        const d=ownerSnap.val();
        const bi=d.books.findIndex(b=>b.id===id);
        if(bi>=0)d.books[bi]=found;
        await window.dbSet(window.dbRef(window.db,'expenseData/'+foundOwnerId),d);
      }
    }catch(e){console.log('Firebase update error:',e);}
  }
  
  // Ensure bookIndex exists for future joins
  if(foundOwnerId && window.db){
    try{await window.dbSet(window.dbRef(window.db,'bookIndex/'+found.id),{ownerId:foundOwnerId});}catch(e){}
  }
  
  found.shared=true;  // mark as shared
  // Add to own books
  S.books.push(found);
  if(!S.categories[found.id]){
    S.categories[found.id]={
      expense:[...DEFAULT_EXPENSE_CATS],
      income:[...DEFAULT_INCOME_CATS]
    };
  }
  
  S.currentBookId=found.id;
  document.getElementById('headerBookName').textContent=found.name;
  document.getElementById('headerBookIcon').textContent=found.emoji;
  saveUserData();
  // Sync shared book data immediately and attach listener
  await saveSharedBookData(found.id);
  attachSharedBookListener(found.id);
  closeSheetNow();
  renderMonthTabs();showPage('dashboard');
  toast('Joined "'+found.name+'" ✓');
}

// ═══════════════════════════════════════════════
//  SHARE / INVITE MEMBERS
// ═══════════════════════════════════════════════
function openShareSheet(){
  if(guestBlocked()) return;
  const book=currentBook();
  const isOwner=book.ownerId===S.user.id;
  const members=book.members.map(m=>{
    const roleLabel=m.role==='owner'?'👑 Owner':m.role==='editor'?'✏️ Editor':'👁 Viewer';
    const roleBtnHtml=isOwner&&m.role!=='owner'?`
      <select onchange="changeMemberRole('${m.userId}',this.value)" style="font-size:11px;padding:3px 5px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);margin-left:4px">
        <option value="editor" ${m.role==='editor'?'selected':''}>✏️ Editor</option>
        <option value="viewer" ${m.role==='viewer'?'selected':''}>👁 Viewer</option>
      </select>`:'<span class="member-role role-owner">'+roleLabel+'</span>';
    const removeBtn=isOwner&&m.userId!==S.user.id?`<button style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;margin-left:4px;flex-shrink:0" onclick="removeMember('${m.userId}')">×</button>`:'';
    return`<div class="member-row" style="align-items:center">
      <div class="member-avatar">${(m.name||m.email).slice(0,2).toUpperCase()}</div>
      <div class="member-info" style="flex:1;min-width:0">
        <div class="member-name">${m.name||'Unknown'}</div>
        <div class="member-email" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.email}</div>
      </div>
      ${roleBtnHtml}${removeBtn}
    </div>`;
  }).join('');

  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Share Book
      <button class="close-btn" onclick="closeSheetNow()">×</button>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--text2);margin-bottom:4px;font-weight:600">BOOK ID (share this)</div>
      <div style="font-size:13px;font-weight:700;color:var(--blue);letter-spacing:1px;word-break:break-all">${book.id}</div>
      <button class="btn btn-outline" style="margin-top:8px;padding:7px" onclick="copyBookId('${book.id}')">Copy ID</button>
    </div>
    <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px">Members (${book.members.length})</div>
    ${members}
    ${isOwner?`
    <div class="divider"></div>
    <div class="form-group">
      <label class="form-label">Invite by Email</label>
      <div class="add-row">
        <input class="form-input" id="inviteEmail" type="email" placeholder="friend@gmail.com"/>
        <button class="btn-sq" onclick="inviteByEmail()">+</button>
      </div>
    </div>`:''}
  `;
  document.getElementById('sheetBg').classList.add('open');
}

function copyBookId(id){
  try{navigator.clipboard.writeText(id);toast('Book ID copied!');}
  catch{prompt('Copy this Book ID:',id);}
}

async function inviteByEmail(){
  const email=document.getElementById('inviteEmail').value.trim().toLowerCase();
  if(!email)return;
  
  // Search localStorage users first
  let invitedUser=getUsers().find(u=>u.email.toLowerCase()===email)||null;
  
  // Search Firebase users node if not found locally
  if(!invitedUser && window.db){
    try{
      const snap=await window.dbGet(window.dbRef(window.db,'users'));
      if(snap.exists()){
        for(const [uid,udata] of Object.entries(snap.val())){
          const userEmail=(udata.email||'').toLowerCase().trim();
          if(userEmail===email){
            invitedUser={id:uid,email:udata.email,name:udata.name||email.split('@')[0],initials:(udata.name||email).slice(0,2).toUpperCase()};
            break;
          }
        }
      }
    }catch(e){console.log('Firebase users node search:',e);}
  }
  
  // BUG FIX #2: Fallback - scan expenseData for user (catches users who created books but aren't in users node yet)
  if(!invitedUser && window.db){
    try{
      const expSnap=await window.dbGet(window.dbRef(window.db,'expenseData'));
      if(expSnap.exists()){
        const allUserData=expSnap.val();
        for(const [uid,udata] of Object.entries(allUserData)){
          if(!udata || !udata.books) continue;
          // Check this user's profile or extract from their books' members
          for(const book of udata.books){
            if(!book.members) continue;
            for(const member of book.members){
              if((member.email||'').toLowerCase().trim()===email){
                invitedUser={id:uid,email:member.email,name:member.name,initials:(member.name||email).slice(0,2).toUpperCase()};
                break;
              }
            }
            if(invitedUser) break;
          }
          if(invitedUser) break;
        }
      }
    }catch(e){console.log('Firebase expenseData fallback search:',e);}
  }
  
  if(!invitedUser){toast('User not found. They must register first.');return;}
  const book=currentBook();
  if(book.members.find(m=>m.userId===invitedUser.id)){toast('Already a member!');return;}
  book.shared=true;  // mark as shared book
  book.members.push({userId:invitedUser.id,email:invitedUser.email,name:invitedUser.name,role:'editor'});
  
  // Save to current user's Firebase and localStorage
  saveUserData();
  
  // Also add book to invited user's data (localStorage)
  try{
    const key='fp_data_'+invitedUser.id;
    const d=JSON.parse(localStorage.getItem(key)||'{}');
    if(!d.books)d.books=[];
    if(!d.books.find(b=>b.id===book.id)){
      d.books.push(book);
      if(!d.categories)d.categories={};
      d.categories[book.id]={expense:bookCats(book.id,'expense'),income:bookCats(book.id,'income')};
    }
    localStorage.setItem(key,JSON.stringify(d));
  }catch{}
  
  // Also add to invited user's Firebase data
  if(window.db){
    try{
      const snap=await window.dbGet(window.dbRef(window.db,'expenseData/'+invitedUser.id));
      let d=snap.exists()?snap.val():{books:[],categories:{}};
      if(!d.books)d.books=[];
      if(!d.books.find(b=>b.id===book.id)){
        d.books.push(book);
        if(!d.categories)d.categories={};
        d.categories[book.id]={expense:bookCats(book.id,'expense'),income:bookCats(book.id,'income')};
      }
      await window.dbSet(window.dbRef(window.db,'expenseData/'+invitedUser.id),d);
    }catch(e){console.log('Firebase invite error:',e);}
  }
  
  // Update sharedBooks metadata with new member list
  if(isSharedBook(book.id)){
    saveSharedBookData(book.id);
  }
  toast(invitedUser.name+' added ✓');
  openShareSheet();
}

function removeMember(userId){
  if(!S.user) return;
  const book=currentBook();
  if(book.ownerId!==S.user.id){toast('Only owner can remove members');return;}
  book.members=book.members.filter(m=>m.userId!==userId);
  saveUserData();
  if(isSharedBook(book.id)) saveSharedBookData(book.id);
  toast('Member removed');
  openShareSheet();
}

function changeMemberRole(userId,newRole){
  if(!S.user) return;
  const book=currentBook();
  if(book.ownerId!==S.user.id){toast('Only owner can change roles');return;}
  const mem=book.members.find(m=>m.userId===userId);
  if(mem){
    mem.role=newRole;
    saveUserData();
    if(isSharedBook(book.id)) saveSharedBookData(book.id);
    toast('Role updated to '+newRole);
  }
}

// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
function showPage(page){
  S.currentPage=page;
  ['dashboard','transactions','categories','profile'].forEach(p=>{
    document.getElementById('nav'+p.charAt(0).toUpperCase()+p.slice(1)).classList.toggle('active',p===page);
  });
  document.getElementById('fabBtn').style.display=page==='categories'||page==='profile'?'none':'flex';
  renderMonthTabs();renderPage();
}

// ── YEAR / MONTH TABS ──────────────────────────────────────
// _selYear: null = show all years' months, or '2026' = filter to that year
// S.currentMonth: selected month key e.g. '2026-01', or 'all' for whole-year view

let _selYear=null; // null = current year on load

function getBookYears(bookId){
  const years=new Set();
  (S.transactions||[]).filter(t=>t.bookId===bookId).forEach(t=>years.add(t.date.slice(0,4)));
  years.add(today().slice(0,4));
  return [...years].sort().reverse();
}

function getBookMonths(bookId,year){
  const months=new Set();
  (S.transactions||[]).filter(t=>t.bookId===bookId&&t.date.startsWith(year)).forEach(t=>months.add(monthKey(t.date)));
  // always include current month if in this year
  if(today().startsWith(year)) months.add(today().slice(0,7));
  return [...months].sort().reverse();
}

function bookTxnsForView(bookId){
  const all=S.transactions.filter(t=>t.bookId===bookId);
  if(S.currentMonth==='all'&&_selYear) return all.filter(t=>t.date.startsWith(_selYear));
  if(S.currentMonth==='all') return all;
  return all.filter(t=>t.date.startsWith(S.currentMonth));
}

function renderMonthTabs(){
  const el=document.getElementById('monthScroll');
  if(!el) return;
  if(S.currentPage==='categories'||S.currentPage==='profile'){el.innerHTML='';return;}

  const years=getBookYears(S.currentBookId);
  if(!_selYear||!years.includes(_selYear)) _selYear=years[0]||today().slice(0,4);

  const months=getBookMonths(S.currentBookId,_selYear);
  
  // Build dropdown options: "Jan 2026", "Feb 2026", etc. + "All Year"
  const allMonths=[];
  for(const y of years){
    const yMonths=getBookMonths(S.currentBookId,y);
    for(const m of yMonths){
      const label=monthLabel(m);
      allMonths.push({key:m,label});
    }
  }
  // Add "All Year" option for each year
  for(const y of years){
    allMonths.push({key:'all-'+y,label:`All ${y}`});
  }
  
  // Current selection display value
  let displayValue='All Year';
  if(S.currentMonth!=='all'){
    const ml=monthLabel(S.currentMonth);
    displayValue=ml;
  }else if(_selYear){
    displayValue=`All ${_selYear}`;
  }
  
  const optionsHtml=allMonths.map(opt=>{
    const isSelected=(opt.key===S.currentMonth)||(S.currentMonth==='all'&&opt.key===`all-${_selYear}`);
    return `<option value="${opt.key}" ${isSelected?'selected':''}>${opt.label}</option>`;
  }).join('');
  
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border)">
      <span style="font-size:12px;color:var(--text2);font-weight:500">Month:</span>
      <select id="monthDropdown" onchange="selectMonthFromDropdown(this.value)" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;font-weight:500;cursor:pointer">
        ${optionsHtml}
      </select>
    </div>
  `;
}

function selectMonthFromDropdown(val){
  if(val.startsWith('all-')){
    _selYear=val.slice(4);
    S.currentMonth='all';
  }else{
    S.currentMonth=val;
    _selYear=val.slice(0,4);
  }
  renderMonthTabs();renderPage();
}

// ═══════════════════════════════════════════════
//  RENDER PAGES
// ═══════════════════════════════════════════════
function renderPage(){
  // Safety guard: never render if not authenticated + not on main screen
  if(!S.user && !S.isGuest) return;
  if(!document.getElementById('mainScreen').classList.contains('active')) return;
  const el=document.getElementById('pageContent');
  if(S.currentPage==='dashboard')el.innerHTML=renderDashboard();
  else if(S.currentPage==='transactions')el.innerHTML=renderTransactions();
  else if(S.currentPage==='categories')el.innerHTML=renderCategoriesPage();
  else el.innerHTML=renderProfilePage();
}

function renderDashboard(){
  const txns=bookTxnsForView(S.currentBookId);

  const totalIncome=txns
    .filter(t=>t.type==='income')
    .reduce((s,t)=>s+t.amount,0);

  const totalExpense=txns
    .filter(t=>t.type==='expense')
    .reduce((s,t)=>s+t.amount,0);

  const balance=totalIncome-totalExpense;

  const cats=bookCats(S.currentBookId);
  const catMap={};

  txns
    .filter(t=>t.type==='expense')
    .forEach(t=>{
      catMap[t.category]=(catMap[t.category]||0)+t.amount;
    });

  const sorted=Object.entries(catMap)
    .sort((a,b)=>b[1]-a[1]);

  const recent=[...txns]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,6);

  const recentRows=recent.length
  ? recent.map(t=>{
      const idx=cats.indexOf(t.category);
      const col=CAT_COLORS[idx>=0?idx%CAT_COLORS.length:0];

      const _dIsShared=isSharedBook(t.bookId);
      const _dBy=_dIsShared&&t.createdByName?`<span style="font-size:10px;color:var(--text3)"> · ${t.createdByName}</span>`:'';
      return `
      <div class="txn-item" onclick="openTxnSheet('${t.id}')">
        <div class="txn-icon" style="background:${col}22">
          ${catEmoji(t.category)}
        </div>
        <div class="txn-body">
          <div class="txn-cat">${t.category}${_dBy}</div>
          <div class="txn-meta">${t.remark||t.date}</div>
        </div>
        <div class="txn-right">
          <div class="txn-amt ${t.type}">
            ${t.type==='income'?'+':'-'}${fmt(t.amount)}
          </div>
          <div class="txn-date">${t.date}</div>
        </div>
      </div>`;
    }).join('')
  : `
  <div class="empty-state">
    <div class="empty-icon">📋</div>
    <div class="empty-text">
      No transactions yet
      <br>
      <small>Tap + to add your first entry</small>
    </div>
  </div>`;

  requestAnimationFrame(()=>renderExpenseChart(catMap,totalExpense));

  return `
    <div class="summary-wrap">
      <div class="s-card">
        <div class="s-label">Income</div>
        <div class="s-val income">${fmt(totalIncome)}</div>
      </div>

      <div class="s-card">
        <div class="s-label">Expense</div>
        <div class="s-val expense">${fmt(totalExpense)}</div>
      </div>

      <div class="s-card balance-card">
        <div class="s-label">
          Balance — ${S.currentMonth==='all'?(_selYear||''):monthLabel(S.currentMonth)}
        </div>

        <div class="s-val ${balance>=0?'':'negative'}">
          ${fmtSgn(balance)}
        </div>
      </div>
    </div>

    ${sorted.length ? `
    <div class="section">
      <div class="section-hdr">
        <div class="section-title">
          Expense Breakdown
        </div>
      </div>

      <div style="
        position:relative;
        height:280px;
        display:flex;
        justify-content:center;
        align-items:center;
      ">
        <canvas id="expenseChart"></canvas>

        <div id="chartCenterText"
          style="
            position:absolute;
            text-align:center;
            pointer-events:none;
          ">
          <div style="
            font-size:12px;
            color:var(--text2)">
            Total Expense
          </div>

          <div style="
            font-size:20px;
            font-weight:700">
            ${fmt(totalExpense)}
          </div>
        </div>
      </div>
    </div>`:''}

    <div class="section">
      <div class="section-hdr">
        <div class="section-title">
          Recent entries
        </div>

        <span class="see-all"
          onclick="showPage('transactions')">
          See all
        </span>
      </div>

      ${recentRows}
    </div>
  `;
}
let expenseChart=null;

function renderExpenseChart(catMap,totalExpense){

  const canvas=document.getElementById('expenseChart');
  if(!canvas) return;

  if(expenseChart){
    expenseChart.destroy();
  }

  const labels=Object.keys(catMap);
  const data=Object.values(catMap);

  expenseChart=new Chart(canvas,{
    type:'doughnut',

    data:{
      labels,
      datasets:[{
        data,
        backgroundColor:CAT_COLORS,
        borderWidth:0
      }]
    },

    options:{
      responsive:true,
      maintainAspectRatio:false,

      cutout:'72%',

      plugins:{
        legend:{
          position:'bottom'
        }
      }
    }
  });
}

let _txnCatFilter='all';
let _txnSubTab='entries'; // 'entries' | 'compare'
function setTxnCatFilter(cat){
  _txnCatFilter=cat;
  renderPage();
}
function setTxnSubTab(tab){
  _txnSubTab=tab;
  renderPage();
}
function prevMonthKey(m){
  let[y,mo]=m.split('-').map(Number);
  mo--;if(mo===0){mo=12;y--;}
  return y+'-'+String(mo).padStart(2,'0');
}
function compareMonthKey(){
  if(S.currentMonth!=='all')return S.currentMonth;
  const months=getBookMonths(S.currentBookId,_selYear||today().slice(0,4));
  return months[0]||today().slice(0,7);
}
function renderTransactions(){
  const tabsHtml=`<div class="auth-tabs" style="margin-bottom:12px">
    <div class="auth-tab${_txnSubTab==='entries'?' active':''}" onclick="setTxnSubTab('entries')">Entries</div>
    <div class="auth-tab${_txnSubTab==='compare'?' active':''}" onclick="setTxnSubTab('compare')">Compare</div>
  </div>`;
  if(_txnSubTab==='compare')return tabsHtml+renderCompareTab();
  const allTxns=bookTxnsForView(S.currentBookId).sort((a,b)=>b.date.localeCompare(a.date));
  const cats=bookCats(S.currentBookId);
  const presentCats=cats.filter(c=>allTxns.some(t=>t.category===c));
  if(_txnCatFilter!=='all'&&!presentCats.includes(_txnCatFilter))_txnCatFilter='all';
  const filterHtml=allTxns.length?`<div style="display:flex;gap:6px;overflow-x:auto;padding:2px 2px 10px;margin:-2px -2px 0">
    <div class="cat-chip${_txnCatFilter==='all'?' selected':''}" style="flex-shrink:0" onclick="setTxnCatFilter('all')">All</div>
    ${presentCats.map(c=>`<div class="cat-chip${_txnCatFilter===c?' selected':''}" style="flex-shrink:0" onclick="setTxnCatFilter('${c.replace(/'/g,"\\'")}')">${catEmoji(c)} ${c}</div>`).join('')}
  </div>`:'';
  const txns=_txnCatFilter==='all'?allTxns:allTxns.filter(t=>t.category===_txnCatFilter);
  if(!txns.length)return`${tabsHtml}${filterHtml}<div class="empty-state" style="margin-top:40px"><div class="empty-icon">📭</div><div class="empty-text">No entries for ${S.currentMonth==='all'?(_selYear||'this period'):monthLabel(S.currentMonth)}</div></div>`;
  const totalIncome=txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExpense=txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const netAmt=totalIncome-totalExpense;
  const totalLabel=_txnCatFilter==='all'?'Total':_txnCatFilter;
  const summaryParts=[];
  if(totalExpense>0)summaryParts.push(`<span style="color:var(--red,#e5484d)">-${fmt(totalExpense)}</span>`);
  if(totalIncome>0)summaryParts.push(`<span style="color:var(--green,#2f9e44)">+${fmt(totalIncome)}</span>`);
  const summaryHtml=`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--surface2);border-radius:var(--radius);margin-bottom:10px">
    <span style="font-size:12px;font-weight:600;color:var(--text2)">${totalLabel} (${txns.length})</span>
    <span style="font-size:14px;font-weight:700">${summaryParts.join(' &nbsp;/&nbsp; ')||fmt(netAmt)}</span>
  </div>`;
  const rows=txns.map(t=>{
    const idx=cats.indexOf(t.category);
    const col=CAT_COLORS[idx>=0?idx%CAT_COLORS.length:0];
    const _isShared=isSharedBook(t.bookId);
    const _byLine=_isShared&&t.createdByName?`<span style="font-size:10px;color:var(--text3);margin-left:4px">· ${t.createdByName}</span>`:'';
    const _timeStr=t.createdAt?new Date(t.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
    const _metaExtra=_isShared&&_timeStr?` · ${_timeStr}`:'';
    return`<div class="txn-item" onclick="openTxnSheet('${t.id}')">
      <div class="txn-icon" style="background:${col}22">${catEmoji(t.category)}</div>
      <div class="txn-body">
        <div class="txn-cat">${t.category} <span class="badge badge-${t.type}">${t.type}</span>${_byLine}</div>
        <div class="txn-meta">${t.remark?'💬 '+t.remark:t.date}${_metaExtra}</div>
      </div>
      <div class="txn-right">
        <div class="txn-amt ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
        <div class="txn-date">${t.date}</div>
      </div>
    </div>`;
  }).join('');
  return`${tabsHtml}${filterHtml}${summaryHtml}<div class="section">${rows}</div>`;
}
function renderCompareTab(){
  const curM=compareMonthKey();
  const prevM=prevMonthKey(curM);
  const curTxns=S.transactions.filter(t=>t.bookId===S.currentBookId&&t.date.startsWith(curM));
  const prevTxns=S.transactions.filter(t=>t.bookId===S.currentBookId&&t.date.startsWith(prevM));
  function groupByCat(txns,type){
    const m={};
    txns.filter(t=>t.type===type).forEach(t=>{m[t.category]=(m[t.category]||0)+t.amount;});
    return m;
  }
  function buildRows(curMap,prevMap,isExpense){
    const catList=[...new Set([...Object.keys(curMap),...Object.keys(prevMap)])].sort((a,b)=>(curMap[b]||0)-(curMap[a]||0));
    if(!catList.length)return`<div class="empty-state" style="padding:20px 0"><div class="empty-text">No data</div></div>`;
    return catList.map(c=>{
      const cur=curMap[c]||0,prev=prevMap[c]||0;
      const diff=cur-prev;
      const pct=prev>0?Math.round((diff/prev)*100):(cur>0?100:0);
      const flat=diff===0;
      const up=diff>0;
      const bad=flat?null:(isExpense?up:!up);
      const arrow=flat?'→':(up?'▲':'▼');
      const color=flat?'var(--text2)':(bad?'#e5484d':'#2f9e44');
      return`<div class="txn-item" style="cursor:default">
        <div class="txn-icon" style="background:var(--surface2)">${catEmoji(c)}</div>
        <div class="txn-body">
          <div class="txn-cat">${c}</div>
          <div class="txn-meta">Prev: ${fmt(prev)}</div>
        </div>
        <div class="txn-right">
          <div class="txn-amt">${fmt(cur)}</div>
          <div class="txn-date" style="color:${color};font-weight:600">${arrow} ${Math.abs(pct)}%</div>
        </div>
      </div>`;
    }).join('');
  }
  const curExp=groupByCat(curTxns,'expense'),prevExp=groupByCat(prevTxns,'expense');
  const curInc=groupByCat(curTxns,'income'),prevInc=groupByCat(prevTxns,'income');
  return`<div style="text-align:center;margin-bottom:14px;font-size:13px;color:var(--text2);font-weight:500">${monthLabel(curM)} vs ${monthLabel(prevM)}</div>
  <div style="font-size:12px;font-weight:700;color:var(--text2);margin:4px 4px 6px;letter-spacing:.5px">EXPENSES</div>
  <div class="section">${buildRows(curExp,prevExp,true)}</div>
  <div style="font-size:12px;font-weight:700;color:var(--text2);margin:16px 4px 6px;letter-spacing:.5px">INCOME</div>
  <div class="section">${buildRows(curInc,prevInc,false)}</div>`;
}
function renderCategoriesPage(){

  const expenseCats=
    bookCats(
      S.currentBookId,
      'expense'
    );

  const incomeCats=
    bookCats(
      S.currentBookId,
      'income'
    );

  const expenseRows=
    expenseCats.map((c,i)=>`
    <div class="manage-cat-item">

      <div class="cat-dot"
      style="
      background:${CAT_COLORS[i%CAT_COLORS.length]};
      width:10px;
      height:10px">
      </div>

      <span class="cat-name">
        ${catEmoji(c)} ${c}
      </span>

      <div class="cat-menu-wrap">

        <button
          class="cat-menu-btn"
          onclick="toggleCatMenu(event,'${c}','expense')">
          ⋮
        </button>

      </div>
    </div>
  `).join('');

  const incomeRows=
    incomeCats.map((c,i)=>`
    <div class="manage-cat-item">

      <div class="cat-dot"
      style="
      background:${CAT_COLORS[i%CAT_COLORS.length]};
      width:10px;
      height:10px">
      </div>

      <span class="cat-name">
        ${catEmoji(c)} ${c}
      </span>

      <div class="cat-menu-wrap">

        <button
          class="cat-menu-btn"
          onclick="toggleCatMenu(event,'${c}','income')">
          ⋮
        </button>

      </div>
    </div>
  `).join('');

  return `
  <div class="section">

    <div class="section-title">
      Expense Categories
    </div>

    ${expenseRows}

    <div class="add-row" style="margin-top:12px">
      <input
        class="form-input"
        id="newExpenseCat"
        placeholder="Add expense category"
      />

      <button
        class="btn-sq"
        onclick="addCat('expense')">
        +
      </button>
    </div>

    <hr style="margin:22px 0">

    <div class="section-title">
      Income Categories
    </div>

    ${incomeRows}

    <div class="add-row" style="margin-top:12px">
      <input
        class="form-input"
        id="newIncomeCat"
        placeholder="Add income category"
      />

      <button
        class="btn-sq"
        onclick="addCat('income')">
        +
      </button>
    </div>

  </div>`;
}
function deleteCat(c,type){

  if(guestBlocked()) return;

  const id=S.currentBookId;

  S.categories[id][type] =
    S.categories[id][type]
      .filter(x=>x!==c);

  saveUserData();
  renderPage();

  toast('Category removed');
}
function addCat(type){

  if(guestBlocked()) return;

  const inp=document.getElementById(
    type==='income'
    ? 'newIncomeCat'
    : 'newExpenseCat'
  );

  const n=inp.value.trim();

  if(!n){
    toast('Enter category name');
    return;
  }

  const id=S.currentBookId;

  if(!S.categories[id]){
    S.categories[id]={
      expense:[...DEFAULT_EXPENSE_CATS],
      income:[...DEFAULT_INCOME_CATS]
    };
  }

  if(S.categories[id][type].includes(n)){
    toast('Category already exists');
    return;
  }

  S.categories[id][type].push(n);

  inp.value='';

  saveUserData();
  renderPage();

  toast(n+' added ✓');
}
function toggleCatMenu(e,c,type){

  e.stopPropagation();

  closeAllCatMenus();

  const btn=e.currentTarget;
  const rect=btn.getBoundingClientRect();

  const menu=document.createElement('div');
  menu.className='cat-popup-menu';
  menu.id='activeCatMenu';

  const renameBtn=document.createElement('button');
  renameBtn.className='cat-popup-item';
  renameBtn.innerHTML='✏️ Rename Category';

  renameBtn.addEventListener('click',function(ev){
    ev.stopPropagation();
    renameCategory(c,type);
  });

  const deleteBtn=document.createElement('button');
  deleteBtn.className='cat-popup-item delete';
  deleteBtn.innerHTML='🗑 Delete Category';

  deleteBtn.addEventListener('click',function(ev){
    ev.stopPropagation();
    confirmDeleteCategory(c,type);
  });

  menu.appendChild(renameBtn);
  menu.appendChild(deleteBtn);

  document.body.appendChild(menu);

  menu.style.top=
    (rect.bottom+6)+'px';

  const left=Math.min(
    rect.left,
    window.innerWidth-180
  );

  menu.style.left=
    left+'px';

  setTimeout(()=>{
    document.addEventListener(
      'click',
      closeAllCatMenus,
      {once:true}
    );
  },50);
}
function closeAllCatMenus(){

  const old=
    document.getElementById(
      'activeCatMenu'
    );

  if(old) old.remove();
}

function confirmDeleteCategory(c,type){

  closeAllCatMenus();

  const hasTransactions=
    S.transactions.some(t=>
      t.bookId===
      S.currentBookId &&
      t.category===c
    );

  let msg=
`Type "${c}" to confirm deletion`;

  if(hasTransactions){

    msg=
`⚠ Category contains transactions.

Type "${c}" to delete permanently`;
  }

  const entered=
    prompt(msg);

  if(
    entered===null
  ) return;

  if(
    entered.trim()!==c
  ){
    toast(
      'Category name mismatch'
    );
    return;
  }

  const bookId=
    S.currentBookId;

  if(
    !S.categories[bookId] ||
    !S.categories[bookId][type]
  ){
    toast('Category error');
    return;
  }

  S.categories[bookId][type]=
    S.categories[bookId][type]
      .filter(
        item=>item!==c
      );

  saveUserData();
  renderPage();

  toast(
    c+' deleted ✓'
  );
}

function renameCategory(c,type){

  closeAllCatMenus();

  const newName=prompt(
    'Rename category',
    c
  );

  if(
    !newName ||
    !newName.trim()
  ) return;

  const cleanName=
    newName.trim();

  if(cleanName===c)
    return;

  const bookId=
    S.currentBookId;

  if(
    !S.categories[bookId] ||
    !S.categories[bookId][type]
  ){
    toast('Category error');
    return;
  }

  const cats=
    S.categories[bookId][type];

  if(
    cats.includes(cleanName)
  ){
    toast(
      'Category already exists'
    );
    return;
  }

  const index=
    cats.indexOf(c);

  if(index===-1){
    toast('Category not found');
    return;
  }

  cats[index]=cleanName;

  // update old transactions
  S.transactions.forEach(t=>{

    if(
      t.bookId===bookId &&
      t.category===c
    ){
      t.category=
        cleanName;
    }
  });

  saveUserData();
  renderPage();

  toast(
    'Category renamed ✓'
  );
}
function renderProfilePage(){
  const u=S.user;
  const book=currentBook();
  const totalTxns=S.transactions.filter(t=>t.bookId===S.currentBookId).length;
  return`<div class="profile-section">
    <div class="profile-card">
      <div class="profile-head">
        <div class="profile-avatar">${u.initials||u.name.slice(0,2).toUpperCase()}</div>
        <div style="flex:1">
          <div class="profile-name">${u.name||'User'}</div>
          <div class="profile-email">${u.email}</div>
        </div>
        <button onclick="openEditProfileSheet()" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:14px;font-weight:600;padding:6px">Edit</button>
      </div>
      <div class="info-row"><span class="label">Active Book</span><span class="value">${book.emoji} ${book.name}</span></div>
      <div class="info-row"><span class="label">Total books</span><span class="value">${S.books.length}</span></div>
      <div class="info-row"><span class="label">Entries (this book)</span><span class="value">${totalTxns}</span></div>
      <div class="info-row"><span class="label">Backup</span><span class="value"><span class="sync-status"><span class="sync-dot"></span>Saved locally</span></span></div>
    </div>
    <div class="profile-card">
  <div class="section-title" style="margin-bottom:12px">Book Options</div>

  <button class="btn btn-outline" style="margin-bottom:8px" onclick="openShareSheet()">
    👥 Share / Invite Members
  </button>

  <button class="btn btn-outline" style="margin-bottom:8px" onclick="openBooksSheet()">
    📚 Switch / Manage Books
  </button>

  <button class="btn btn-outline" style="margin-bottom:8px" onclick="exportCSV()">
    📤 Export as CSV
  </button>

  <button class="btn btn-primary" onclick="exportPDF()">
    📄 Export as PDF
  </button>
</div>
    <div class="profile-card">
      <button class="btn btn-danger" onclick="confirmLogout()">Sign Out</button>
    </div>
  </div>`;
}

function confirmLogout(){
  if(confirm('Sign out of Fiberplane?'))logout();
}

function openEditProfileSheet(){
  const u=S.user;
  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Edit Profile
      <button class="close-btn" onclick="closeSheetNow()">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input class="form-input" id="editProfileName" placeholder="Your name" value="${u.name||''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input class="form-input" value="${u.email}" disabled style="opacity:0.6" />
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Email cannot be changed</div>
    </div>
    <button class="btn btn-primary" onclick="saveProfileChanges()">Save Changes</button>
  `;
  document.getElementById('sheetBg').classList.add('open');
}

async function saveProfileChanges(){
  const name=document.getElementById('editProfileName').value.trim();
  if(!name){toast('Enter your name');return;}
  S.user.name=name;
  S.user.initials=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('userAvatar').textContent=S.user.initials;
  // Update in Firebase users node
  if(window.db && S.user.id){
    try{
      await window.dbSet(window.dbRef(window.db,'users/'+S.user.id),{name,email:S.user.email});
    }catch(e){}
  }
  // Update in localStorage users list
  const users=getUsers();
  const ui=users.findIndex(u=>u.id===S.user.id);
  if(ui>=0){users[ui].name=name;users[ui].initials=S.user.initials;saveUsers(users);}
  saveUserData();
  toast('Profile updated ✓');
  closeSheetNow();
}

// ═══════════════════════════════════════════════
//  TRANSACTION SHEET
// ═══════════════════════════════════════════════
let _txnType='expense';
let _selCat='';

function openTxnSheet(txnId){
  if(!requireLogin()) return;
  const ex=txnId?S.transactions.find(t=>t.id===txnId):null;
  _txnType=ex?ex.type:'expense';
  _selCat=ex?ex.category:'';
  const cats=bookCats(S.currentBookId);

  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">${ex?'Edit Entry':'Add Entry'}
      <button class="close-btn" onclick="closeSheetNow()">×</button>
    </div>
    <div class="type-toggle">
      <button class="type-btn ${_txnType==='income'?'active-income':''}" id="btnI" onclick="setTxnType('income')">↑ Income</button>
      <button class="type-btn ${_txnType==='expense'?'active-expense':''}" id="btnE" onclick="setTxnType('expense')">↓ Expense</button>
    </div>
    <div class="form-group">
      <label class="form-label">Amount (₹)</label>
      <input class="form-input" id="fAmt" type="number" inputmode="decimal" placeholder="0.00" value="${ex?ex.amount:''}" min="0" step="0.01"/>
    </div>
    <div class="form-group">
      <label class="form-label">Category</label>
      <div class="cat-grid" id="catGrid"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input class="form-input" id="fDate" type="date" value="${ex?ex.date:today()}"/>
    </div>
    <div class="form-group">
      <label class="form-label">Remark <span style="color:var(--text3)">(optional)</span></label>
      <input class="form-input" id="fRemark" type="text" placeholder="Add a note..." value="${ex?ex.remark||'':''}"/>
    </div>
    ${ex?`<button class="btn btn-danger" onclick="deleteTxn('${ex.id}')" style="margin-bottom:8px">Delete Entry</button>`:''}
    <button class="btn btn-primary" onclick="saveTxn('${txnId||''}')">Save Entry</button>
  `;
  renderCatGrid();
  document.getElementById('sheetBg').classList.add('open');
  setTimeout(()=>{try{document.getElementById('fAmt').focus();}catch{}},300);
}

function renderCatGrid(){

  const grid=document.getElementById('catGrid');
  if(!grid) return;

  const cats=bookCats(
    S.currentBookId,
    _txnType
  );

  grid.innerHTML=cats.map(c=>`
    <div class="cat-chip
      ${_selCat===c?'selected':''}"
      onclick="selCat('${c}')">

      ${catEmoji(c)} ${c}
    </div>
  `).join('');
}
function selCat(c){_selCat=c;renderCatGrid();}
function setTxnType(t){

  _txnType=t;

  _selCat='';

  document.getElementById('btnI').className=
    'type-btn'+
    (t==='income'
    ?' active-income'
    :'');

  document.getElementById('btnE').className=
    'type-btn'+
    (t==='expense'
    ?' active-expense'
    :'');

  renderCatGrid();
}

function saveTxn(id){
  if(guestBlocked()) return;
  const amt=parseFloat(document.getElementById('fAmt').value);
  const date=document.getElementById('fDate').value;
  const remark=document.getElementById('fRemark').value.trim();
  if(!amt||amt<=0){toast('Enter a valid amount');return;}
  if(!_selCat){toast('Pick a category');return;}
  if(!date){toast('Pick a date');return;}
  if(id){
    const t=S.transactions.find(t=>t.id===id);
    if(t){Object.assign(t,{amount:amt,type:_txnType,category:_selCat,date,remark});}
  }else{
    S.transactions.push({
      id:uid(),bookId:S.currentBookId,type:_txnType,amount:amt,
      category:_selCat,date,remark,
      createdBy:S.user.id,
      createdByName:S.user.name||S.user.email||'Unknown',
      createdAt:new Date().toISOString()
    });
    const m=monthKey(date);
    if(m!==S.currentMonth){S.currentMonth=m;}
  }
  // For shared books, push immediately to sharedBooks path
  if(isSharedBook(S.currentBookId)){
    saveSharedBookData(S.currentBookId);
  } else {
    saveUserData();
  }
  closeSheetNow();
  toast(id?'Entry updated ✓':'Entry saved ✓');
}

function deleteTxn(id){

  if(guestBlocked()) return;

  if(!confirm('Delete this entry?'))
    return;

  S.transactions=
    S.transactions.filter(
      t=>t.id!==id
    );

  if(isSharedBook(S.currentBookId)){
    saveSharedBookData(S.currentBookId);
  } else {
    saveUserData();
  }
  closeSheetNow();

  toast('Entry deleted');
}

// ═══════════════════════════════════════════════
//  EXPORT CSV
// ═══════════════════════════════════════════════
function exportCSV(){
  const txns=S.transactions.filter(t=>t.bookId===S.currentBookId).sort((a,b)=>a.date.localeCompare(b.date));
  const rows=[['Date','Type','Category','Amount','Remark'],...txns.map(t=>[t.date,t.type,t.category,t.amount,t.remark||''])];
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='fiberplane_'+currentBook().name+'.csv';a.click();
  toast('CSV exported ✓');
}
function exportPDF(){

  const txns=S.transactions
    .filter(t=>t.bookId===S.currentBookId)
    .sort((a,b)=>a.date.localeCompare(b.date));

  if(!txns.length){
    toast('No transactions found');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc=new jsPDF();

  const book=currentBook();

  const totalIncome=txns
    .filter(t=>t.type==='income')
    .reduce((s,t)=>s+t.amount,0);

  const totalExpense=txns
    .filter(t=>t.type==='expense')
    .reduce((s,t)=>s+t.amount,0);

  const balance=totalIncome-totalExpense;

  doc.setFontSize(18);
  doc.text('Fiberplane Expense Report',14,15);

  doc.setFontSize(11);
  doc.text(`Book: ${book.name}`,14,25);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`,14,32);

  const money = n => {
  return 'Rs. ' + Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

doc.text(`Income: ${money(totalIncome)}`, 14, 42);
doc.text(`Expense: ${money(totalExpense)}`, 14, 49);
doc.text(
  `Balance: ${(balance < 0 ? '-' : '')}${money(Math.abs(balance))}`,
  14,
  56
);
  const rows=txns.map(t=>[
    t.date,
    t.type,
    t.category,
 'Rs. ' + Number(t.amount).toLocaleString('en-IN'),
    t.remark || '-'
  ]);

  doc.autoTable({
    startY:65,
    head:[[
      'Date',
      'Type',
      'Category',
      'Amount',
      'Remark'
    ]],
    body:rows,
    styles:{
      fontSize:9
    }
  });

  doc.save(`fiberplane-${book.name}.pdf`);

  toast('PDF exported');
}

// ═══════════════════════════════════════════════
//  SHEET HELPERS
// ═══════════════════════════════════════════════
function closeSheet(e){if(e.target===e.currentTarget)closeSheetNow();}
function closeSheetNow(){
  document.getElementById('sheetBg').classList.remove('open');
  renderMonthTabs();renderPage();
}

// ═══════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════
// ── OFFLINE DETECTION ───────────────────────────────────────
function checkOffline(){
  if(!navigator.onLine){
    let ov=document.getElementById('offlineOverlay');
    if(!ov){
      ov=document.createElement('div');
      ov.id='offlineOverlay';
      ov.innerHTML=`<div style="position:fixed;inset:0;background:var(--bg,#fff);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;gap:12px;text-align:center;padding:32px">
        <div style="font-size:72px">✈️</div>
        <div style="font-size:20px;font-weight:700;color:var(--text,#111)">You're Offline</div>
        <div style="font-size:14px;color:var(--text2,#666);max-width:260px">Sorry, you are not connected to the internet.<br>Please check your network and try again.</div>
        <button onclick="if(navigator.onLine){document.getElementById('offlineOverlay').remove();}else{toast('Still offline...');}" style="margin-top:8px;padding:12px 28px;background:#185FA5;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer">Try Again</button>
      </div>`;
      document.body.appendChild(ov);
    }
    return true;
  } else {
    const ov=document.getElementById('offlineOverlay');
    if(ov) ov.remove();
    return false;
  }
}
window.addEventListener('offline',()=>checkOffline());
window.addEventListener('online',()=>{checkOffline();toast('Back online ✅');});
// Check at startup
document.addEventListener('DOMContentLoaded',()=>checkOffline());

let _toastTimer;
function toast(msg,dur=2200){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(_toastTimer);_toastTimer=setTimeout(()=>el.classList.remove('show'),dur);
}

function showSyncIndicator(state){
  // state: 'syncing' | 'synced' | 'error'
  let dot=document.getElementById('syncDot');
  if(!dot){
    dot=document.createElement('div');
    dot.id='syncDot';
    dot.style.cssText='position:fixed;bottom:72px;right:14px;font-size:11px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:3px 8px;z-index:999;transition:opacity 0.3s';
    document.body.appendChild(dot);
  }
  if(state==='syncing'){dot.textContent='⏳ Syncing...';dot.style.opacity='1';}
  else if(state==='synced'){dot.textContent='✅ Synced';dot.style.opacity='1';setTimeout(()=>{dot.style.opacity='0';},2000);}
  else{dot.textContent='❌ Sync error';dot.style.opacity='1';setTimeout(()=>{dot.style.opacity='0';},3000);}
}

// ═══════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════
// NOTE: We do NOT call loginUser() here from localStorage anymore.
// The Firebase onAuthStateChanged listener (at the bottom) handles session restore.
// This avoids loading stale local data before Firebase has a chance to return fresh data.
// load() is still called to populate S with any cached state for offline fallback.
load();



// ===== FIREBASE OVERRIDES =====
async function saveUserData(){
 if(!S.user) return;

 // Always write local cache so offline / pre-Firebase-init works
 const snapshot={
   books:S.books, currentBookId:S.currentBookId,
   transactions:S.transactions, categories:S.categories, currentMonth:S.currentMonth
 };
 localStorage.setItem('fp_cache_'+S.user.id, JSON.stringify(snapshot));

 if(!window.db) return; // Firebase not ready yet — local cache is enough for now

 showSyncIndicator('syncing');
 try{
   // Save ALL data (personal + shared) to expenseData/{uid} — Firebase is source of truth
   const data={
     books:S.books, currentBookId:S.currentBookId,
     transactions:S.transactions,
     categories:S.categories, currentMonth:S.currentMonth
   };
   await window.dbSet(window.dbRef(window.db,'expenseData/'+S.user.id), data);
   showSyncIndicator('synced');
 }catch(e){
   console.log('saveUserData Firebase error:', e);
   showSyncIndicator('error');
 }

 // Also push shared books to sharedBooks/{bookId} for real-time collaboration
 const sharedBookIds=[...new Set(
   S.books.filter(b=>isSharedBook(b.id)).map(b=>b.id)
 )];
 for(const bid of sharedBookIds){
   await saveSharedBookData(bid);
 }
}

// Override handleAuth + handleGoogleAuth once Firebase is ready
(function waitForFirebase(){
  if(!window.auth || !window.signInWithEmailAndPassword || !window.createUserWithEmailAndPassword){
    setTimeout(waitForFirebase, 100);
    return;
  }

  handleAuth = async function(){
    const email=document.getElementById('fEmail').value.trim();
    const pass=document.getElementById('fPassword').value;
    const name=(document.getElementById('fName')?.value||'').trim();
    const err=document.getElementById('authErr');
    err.style.display='none';
    if(!email||!pass){err.textContent='Please fill in all fields.';err.style.display='block';return;}
    try{
      let fbUser;
      if(authMode==='register'){
        const cred=await window.createUserWithEmailAndPassword(window.auth,email,pass);
        fbUser=cred.user;
        const saveName=name||email.split('@')[0];
        await window.dbSet(window.dbRef(window.db,'users/'+fbUser.uid),{name:saveName,email});
        loginUser({id:fbUser.uid,name:saveName,email:fbUser.email,initials:saveName.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()});
      }else{
        const cred=await window.signInWithEmailAndPassword(window.auth,email,pass);
        fbUser=cred.user;
        let name=fbUser.displayName||'User';
        try{
          const snap=await window.dbGet(window.dbRef(window.db,'users/'+fbUser.uid));
          if(snap.exists()){const p=snap.val();name=p.name||name;}
          const ds=await window.dbGet(window.dbRef(window.db,'expenseData/'+fbUser.uid));
          if(ds.exists()) Object.assign(S, ds.val());
        }catch(e){}
        loginUser({id:fbUser.uid,name,email:fbUser.email,initials:name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()});
      }
    }catch(e){
      err.style.display='block';
      const code=e.code||'';
      if(code==='auth/user-not-found'||code==='auth/invalid-credential')err.textContent='No account found with this email.';
      else if(code==='auth/wrong-password')err.textContent='Incorrect password. Please try again.';
      else if(code==='auth/too-many-requests')err.textContent='Too many attempts. Please wait a moment.';
      else if(code==='auth/email-already-in-use')err.textContent='Email already registered. Please sign in.';
      else if(code==='auth/weak-password')err.textContent='Password must be at least 6 characters.';
      else if(code==='auth/network-request-failed')err.textContent='No internet connection. Check your network.';
      else if(code==='auth/invalid-email')err.textContent='Invalid email address.';
      else err.textContent=e.message||'Login failed. Please try again.';
    }
  };

  handleGoogleAuth = async function(){
    try{
      const result=await window.signInWithPopup(window.auth, new window.GoogleAuthProvider());
      const u=result.user;
      const name=u.displayName||'User';
      await window.dbSet(window.dbRef(window.db,'users/'+u.uid),{name,email:u.email});
      loginUser({id:u.uid,name,email:u.email,initials:name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()});
    }catch(e){
      const code=e.code||'';
      if(code!=='auth/popup-closed-by-user') toast(e.message||'Google sign-in failed.');
    }
  };
})();
window.addEventListener('load',()=>{
 document.body.style.overscrollBehavior='none';
 document.documentElement.style.overscrollBehavior='none';
});
// Register Firebase auth listener immediately to avoid race condition
// where onAuthStateChanged fires before load event
(function registerAuthListener(){
 if(!window.onAuthStateChangedFirebase || !window.auth){
   setTimeout(registerAuthListener,100);
   return;
 }
 window.onAuthStateChangedFirebase(window.auth, async(user)=>{
   if(!user) return;
   if(_userExplicitlySignedOut){
     try{await window.signOutFirebase(window.auth);}catch(e){}
     return;
   }
   if(document.getElementById('mainScreen').classList.contains('active')) return;
   let name=user.displayName||'User';
   try{
     const snap=await window.dbGet(window.dbRef(window.db,'users/'+user.uid));
     if(snap.exists()){ const p=snap.val(); name=p.name||name; }
     const ds=await window.dbGet(window.dbRef(window.db,'expenseData/'+user.uid));
     if(ds.exists()) Object.assign(S, ds.val());
   }catch(e){}
   loginUser({id:user.uid,name,email:user.email,initials:name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()});
 });
})();
