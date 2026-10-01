const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const { loadTypeScript } = require('./helpers/loadTypeScript.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));

// Production provider/handlers; React scheduling, native hosts and HTTP are mocked.
function harness(auth, options = {}) {
  const slots = [], effects = [], secure = new Map();
  let cursor = 0, tree, listener;
  const session = { api: {auth}, token: null, loginOAuth: async () => {} };
  const same = (a,b) => a && b && a.length === b.length && a.every((x,i) => Object.is(x,b[i]));
  const react = {
    createContext: () => ({Provider:'Provider'}),
    useState(initial) { const i=cursor++; slots[i]??={value:typeof initial==='function'?initial():initial}; return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}]; },
    useRef(initial) { const i=cursor++; slots[i]??={current:initial}; return slots[i]; },
    useCallback(fn,deps) { const i=cursor++; if(!slots[i]||!same(slots[i].deps,deps)) slots[i]={value:fn,deps}; return slots[i].value; },
    useEffect(fn,deps) { const i=cursor++, old=slots[i]; if(old&&same(old.deps,deps))return; const next={deps}; slots[i]=next; effects.push(()=>{old?.cleanup?.();next.cleanup=fn();}); }
  };
  const jsx=(type,props)=>({type,props});
  const {BrowserAuthProvider}=loadTypeScript('src/auth/BrowserAuthContext.tsx', {
    react, 'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},
    'react-native':{Platform:{OS:'android'},Linking:{getInitialURL:async()=>null,addEventListener:(_event,fn)=>{listener=fn;return {remove(){}};}},Modal:'Modal',View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:x=>x}},
    'expo-crypto':{getRandomBytesAsync:async n=>crypto.randomBytes(n),CryptoDigestAlgorithm:{SHA256:'sha256'},CryptoEncoding:{BASE64:'base64'},digestStringAsync:async(_a,s)=>crypto.createHash('sha256').update(s).digest('base64')},
    'expo-secure-store':{getItemAsync:async k=>options.readPending?options.readPending(k,secure):secure.get(k)??null,setItemAsync:async(k,v)=>secure.set(k,v),deleteItemAsync:async k=>options.deletePending?options.deletePending(k,secure):secure.delete(k)},
    'expo-web-browser':{maybeCompleteAuthSession(){},openAuthSessionAsync:options.openAuthSessionAsync??(async()=>({type:'cancel'}))},
    '../components':Object.fromEntries(['AppScreen','Button','Card','FormField'].map(x=>[x,x])),
    '../context/AuthContext':{useAuth:()=>session},
    '../api':{customerSafeErrorMessage:(_e,fallback)=>fallback},
    '../i18n':{useLocale(){},t:x=>x},
    '../theme/tokens':{colors:{},fonts:{},spacing:{}}
  });
  const render=()=>{cursor=0;tree=BrowserAuthProvider({children:null});while(effects.length)effects.shift()();return tree.props.value;};
  function find(predicate,node=tree){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){if(child==null)continue;const found=find(predicate,child);if(found)return found;}return null;}
  return {render,session,secure,find,link:url=>listener({url})};
}

test('failed provider configuration stays separate from recovery errors and can be retried', async () => {
  let attempts=0;
  const h=harness({browserConfig:async()=>{if(++attempts===1)throw Error('offline');return {providers:[],recovery:true};}});
  h.render(); await tick();
  let state=h.render();
  assert.ok(state.configurationError); assert.equal(state.error,null); assert.equal(state.canRecover,false);
  state.openRecovery(); h.render(); assert.equal(h.find(n=>n.type==='Modal').props.visible,false);
  state.refreshConfiguration(); h.render(); await tick(); state=h.render();
  assert.equal(state.configurationError,null); assert.equal(state.canRecover,true); assert.equal(attempts,2);
  state.openRecovery(); h.render(); assert.equal(h.find(n=>n.type==='Modal').props.visible,true);
});

test('a recovery email response arriving after sign-in cannot reopen the recovery modal', async () => {
  let resolve, requests=0;
  const pending=new Promise(done=>{resolve=done;});
  const h=harness({browserConfig:async()=>({providers:[],recovery:true}),startRecovery:async()=>{requests++;await pending;}});
  h.render(); await tick(); h.render().openRecovery(); h.render();
  h.find(n=>n.type==='FormField').props.onChangeText('qa@example.invalid'); h.render();
  h.find(n=>n.type==='Button'&&n.props.label==='재설정 링크 보내기').props.onPress(); await tick();
  assert.equal(requests,1);
  h.session.token='new-member-session';h.render();await tick();h.render();
  resolve();await tick();h.render();
  assert.equal(h.find(n=>n.type==='Modal').props.visible,false);
  assert.equal(h.render().busy,false);
});

test('password recovery consumes the matching callback without logging in a browsing session', async () => {
  let updates=0, socialLogins=0;
  const h=harness({browserConfig:async()=>({providers:[],recovery:true}),startRecovery:async()=>{},finishRecovery:async()=>{updates++;}});
  h.session.loginOAuth=async()=>{socialLogins++;};
  h.render();await tick();h.render().openRecovery();h.render();
  h.find(n=>n.type==='FormField').props.onChangeText('qa@example.invalid');h.render();
  h.find(n=>n.type==='Button'&&n.props.label==='재설정 링크 보내기').props.onPress();await tick();h.render();
  const flow=JSON.parse(h.secure.get('shc.pendingAuth.v1'));
  h.link(`${flow.redirectUri}?state=${flow.state}&code=test-code`);await tick();h.render();
  h.find(n=>n.type==='FormField'&&n.props.label==='새 비밀번호').props.onChangeText('test-password123');
  h.find(n=>n.type==='FormField'&&n.props.label==='비밀번호 확인').props.onChangeText('test-password123');h.render();
  h.find(n=>n.type==='Button'&&n.props.label==='비밀번호 변경').props.onPress();await tick();h.render();
  assert.equal(updates,1);assert.equal(socialLogins,0);assert.equal(h.session.token,null);
  assert.equal(h.secure.has('shc.pendingAuth.v1'),false);
  assert.ok(h.find(n=>n.type==='Button'&&n.props.label==='로그인 화면으로 돌아가기'));
});

const cancelledMessage = '로그인이 취소되었습니다. 다시 시도할 수 있습니다.';
const pendingKey = 'shc.pendingAuth.v1';
const googleAuth = () => ({browserConfig:async()=>({providers:['google'],recovery:true}),
  startOAuth:async()=>({authorizationUrl:'https://example.supabase.co/auth/v1/authorize'})});
const denialUrl = flow => `${flow.redirectUri}?error=access_denied&error_description=private-provider-detail&state=${flow.state}` +
  '#error=access_denied&error_description=private-provider-detail&sb=';

test('duplicate native denial callbacks show translated cancellation and permit another sign-in', async () => {
  let finishBrowser, launches=0, logins=0;
  const h=harness(googleAuth(), {openAuthSessionAsync:async()=>{
    if (++launches===1) return new Promise(resolve=>{finishBrowser=resolve;});
    return {type:'cancel'};
  }});
  h.session.loginOAuth=async()=>{logins++;};
  h.render();await tick();const start=h.render().startSocial('google');await tick();
  const flow=JSON.parse(h.secure.get(pendingKey)), denied=denialUrl(flow);
  h.link(denied);h.link(denied);await tick();
  assert.equal(h.render().error,cancelledMessage);assert.equal(h.render().busy,false);
  assert.equal(h.secure.has(pendingKey),false);assert.equal(logins,0);
  finishBrowser({type:'success',url:denied});await start;
  assert.equal(h.render().error,cancelledMessage);
  const locale=loadTypeScript('src/i18n/store.ts');
  locale.setLocale('en');assert.equal(locale.t(h.render().error),'Sign-in was cancelled. You can try again.');
  locale.setLocale('ko');assert.equal(locale.t(h.render().error),cancelledMessage);
  await h.render().startSocial('google');assert.equal(launches,2);assert.equal(h.render().error,null);
});

test('a denial duplicate cannot release or overwrite an in-progress successful exchange', async () => {
  let finishBrowser, finishLogin, logins=0;
  const h=harness(googleAuth(), {openAuthSessionAsync:()=>new Promise(resolve=>{finishBrowser=resolve;})});
  h.session.loginOAuth=async()=>{logins++;await new Promise(resolve=>{finishLogin=resolve;});};
  h.render();await tick();const start=h.render().startSocial('google');await tick();
  const flow=JSON.parse(h.secure.get(pendingKey));
  h.link(`${flow.redirectUri}?state=${flow.state}&code=test-code`);await tick();
  assert.equal(logins,1);assert.equal(h.render().busy,true);
  h.link(denialUrl(flow));await tick();
  finishBrowser({type:'success',url:denialUrl(flow)});await start;
  assert.equal(h.render().busy,true);assert.equal(h.render().error,null);assert.equal(logins,1);
  finishLogin();await tick();assert.equal(h.render().busy,false);
});

test('a token-bearing denial remains invalid and does not consume the pending flow', async () => {
  let finishBrowser;
  const h=harness(googleAuth(), {openAuthSessionAsync:()=>new Promise(resolve=>{finishBrowser=resolve;})});
  h.render();await tick();const start=h.render().startSocial('google');await tick();
  const raw=h.secure.get(pendingKey), flow=JSON.parse(raw);
  h.link(`${denialUrl(flow)}&access_token=secret`);await tick();
  assert.equal(h.secure.get(pendingKey),raw);assert.equal(h.render().busy,true);
  assert.notEqual(h.render().error,cancelledMessage);
  assert.doesNotMatch(h.render().error,/private-provider-detail|secret/);
  finishBrowser({type:'cancel'});await start;
});

test('denial cleanup awaiting storage cannot clear a newer generation or release its busy state', async () => {
  let reads=0, finishRead;
  const browsers=[];
  const h=harness(googleAuth(), {
    openAuthSessionAsync:()=>new Promise(resolve=>browsers.push(resolve)),
    readPending:(key,secure)=>++reads===2?new Promise(resolve=>{finishRead=resolve;}):secure.get(key)??null
  });
  h.render();await tick();const first=h.render().startSocial('google');await tick();
  const oldRaw=h.secure.get(pendingKey);h.link(denialUrl(JSON.parse(oldRaw)));await tick();
  assert.equal(typeof finishRead,'function');
  h.session.token='another-member-session';h.render();await tick();
  h.session.token=null;h.render();
  const second=h.render().startSocial('google');await tick();
  const newRaw=h.secure.get(pendingKey);assert.notEqual(newRaw,oldRaw);
  finishRead(oldRaw);await tick();
  assert.equal(h.secure.get(pendingKey),newRaw);assert.equal(h.render().busy,true);assert.equal(h.render().error,null);
  browsers[0]({type:'cancel'});await first;
  assert.equal(h.secure.get(pendingKey),newRaw);assert.equal(h.render().busy,true);
  browsers[1]({type:'cancel'});await second;
});

test('an in-flight native denial deletion completes before a newer flow is persisted', async () => {
  let deletes=0, finishDelete;
  const browsers=[];
  const h=harness(googleAuth(), {
    openAuthSessionAsync:()=>new Promise(resolve=>browsers.push(resolve)),
    deletePending:async(key,secure)=>{
      if (++deletes===1) await new Promise(resolve=>{finishDelete=resolve;});
      secure.delete(key);
    }
  });
  h.render();await tick();const first=h.render().startSocial('google');await tick();
  const oldRaw=h.secure.get(pendingKey);h.link(denialUrl(JSON.parse(oldRaw)));await tick();
  assert.equal(typeof finishDelete,'function');
  h.session.token='another-member-session';h.render();await tick();
  h.session.token=null;h.render();
  const second=h.render().startSocial('google');await tick();
  assert.equal(browsers.length,1);assert.equal(h.render().busy,true);
  finishDelete();await tick();
  const newRaw=h.secure.get(pendingKey);
  assert.ok(newRaw);assert.notEqual(newRaw,oldRaw);assert.equal(browsers.length,2);
  assert.equal(h.render().error,null);assert.equal(h.render().busy,true);
  browsers[0]({type:'cancel'});await first;assert.equal(h.secure.get(pendingKey),newRaw);
  browsers[1]({type:'cancel'});await second;
});
