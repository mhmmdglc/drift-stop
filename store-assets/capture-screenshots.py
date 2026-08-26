import subprocess, sys, time, re, os, json, pathlib
ADB = os.path.expanduser('~/Library/Android/sdk/platform-tools/adb')
PKG = 'com.driftstop.app'
SP  = pathlib.Path('/private/tmp/claude-501/-Users-mglc-workspace-MyWorkspace-drift-stop/cda81f88-db28-469c-a39c-c533480e5c12/scratchpad')
OUT = SP/'shots'
TR_CHARS = re.compile(r'[ğşıİĞŞÇç]')   # 'ö/ü' Almanca'da da var; Türkçe'ye özgü olanlar

def sh(*a): return subprocess.run([ADB]+list(a), capture_output=True, text=True).stdout
def dump():
    sh('shell','uiautomator','dump','/sdcard/u3.xml')
    return sh('shell','cat','/sdcard/u3.xml')
def texts(xml):
    return [m.group(1) for m in re.finditer(r'text="([^"]+)"', xml)]
def find(xml, t):
    for m in re.finditer(r'<node[^>]*>', xml):
        n=m.group(0); mt=re.search(r'text="([^"]*)"', n)
        if not mt or mt.group(1)!=t: continue
        b=re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if b:
            x1,y1,x2,y2=map(int,b.groups()); return ((x1+x2)//2,(y1+y2)//2)
    return None
def tap(xy,w=1.8): sh('shell','input','tap',str(xy[0]),str(xy[1])); time.sleep(w)
def shot(name):
    d=subprocess.run([ADB,'exec-out','screencap','-p'],capture_output=True).stdout
    (OUT/name).write_bytes(d); print('   OK',name,len(d)//1024,'KB',flush=True)

def quote_ok(xml, loc):
    """Kartta gerçek bir söz var mı ve dili doğru mu?"""
    longs=[t for t in texts(xml) if len(t)>35]
    if not longs: return False                      # boş ekran = başarısız
    if loc.startswith('tr'): return True
    return not any(TR_CHARS.search(t) for t in longs)

def boot(loc, lab):
    sh('shell','am','force-stop',PKG); sh('shell','pm','clear',PKG)
    sh('shell','cmd','locale','set-app-locales',PKG,'--locales',loc)
    sh('shell','pm','grant',PKG,'android.permission.POST_NOTIFICATIONS')
    sh('shell','monkey','-p',PKG,'-c','android.intent.category.LAUNCHER','1')
    time.sleep(12)
    for _ in range(9):
        xml=dump()
        xy=find(xml,lab['last'])
        if xy: tap(xy,6.0); break                   # son sayfa -> Başla
        for k in ('perm','cont'):
            xy=find(xml,lab[k])
            if xy: tap(xy); break
        else: time.sleep(2)
    time.sleep(5)
    return dump()

L=json.loads(sys.argv[1])
for loc in sys.argv[2:]:
    lab=L[loc.split('-')[0]]
    print('---',loc,flush=True)
    for attempt in range(6):
        xml=boot(loc,lab)
        if quote_ok(xml, loc):
            shot(f'{loc}-1-home.png'); break
        print(f'   .. deneme {attempt+1}: söz yok/Türkçe, yeniden',flush=True)
    else:
        print('   !! temiz söz bulunamadı',flush=True); continue
    # kaydır -> geçmiş modu (Önceki/Sonraki)
    for _ in range(6):
        sh('shell','input','swipe','800','1100','280','1100','300'); time.sleep(2.5)
        xml=dump()
        if quote_ok(xml, loc):
            shot(f'{loc}-4-quote.png'); break
print('BITTI3',flush=True)
