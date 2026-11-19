#!/usr/bin/env python3
"""Froids 300: calcul reproductible, échec fermé, aucune prétention de prédiction garantie."""
import collections, csv, datetime as dt, hashlib, io, json, os, pathlib, urllib.request
ROOT=pathlib.Path(__file__).resolve().parent
STATE=ROOT/'v26-state.json'
UTC=dt.timezone.utc

def utcnow(): return dt.datetime.now(UTC)
def load():
    if STATE.exists(): return json.loads(STATE.read_text(encoding='utf-8'))
    return {'schema':'froids300-v26','predictions':[], 'errors':[]}
def save(state): STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
def parse(raw):
    try:
        payload=json.loads(raw)
        draws=payload['draws'] if isinstance(payload,dict) else payload
    except json.JSONDecodeError:
        draws=list(csv.DictReader(io.StringIO(raw)))
    if not isinstance(draws,list): raise ValueError('Format de source invalide')
    unique={}
    for r in draws:
        date=str(r.get('date') or r.get('date_de_tirage') or r.get('date_tirage') or '')[:10]
        day=dt.date.fromisoformat(date)
        if day.weekday() not in (0,2,5): raise ValueError('Date de tirage inattendue: '+date)
        numbers=r.get('numbers') or r.get('numeros')
        if isinstance(numbers,str): numbers=[int(n) for n in numbers.replace(';',' ').replace(',',' ').split()]
        if numbers is None: numbers=[int(r['boule_'+str(i)]) for i in range(1,6)]
        numbers=sorted(int(n) for n in numbers)
        chance=int(r.get('chance') or r.get('numero_chance'))
        if len(numbers)!=5 or len(set(numbers))!=5 or any(n<1 or n>49 for n in numbers) or chance not in range(1,11):
            raise ValueError('Numéros invalides: '+date)
        draw={'date':date,'numbers':numbers,'chance':chance}
        if date in unique and unique[date]!=draw: raise ValueError('Résultats contradictoires: '+date)
        unique[date]=draw
    return sorted(unique.values(),key=lambda d:d['date'])
def next_draw(day):
    d=dt.date.fromisoformat(day)+dt.timedelta(days=1)
    while d.weekday() not in (0,2,5): d+=dt.timedelta(days=1)
    return d.isoformat()
def pick(history):
    if len(history)<300: raise ValueError('300 tirages antérieurs requis')
    main=collections.Counter(n for row in history[-300:] for n in row['numbers'])
    chance=collections.Counter(row['chance'] for row in history[-300:])
    return sorted(sorted(range(1,50),key=lambda n:(main[n],n))[:5]), min(range(1,11),key=lambda n:(chance[n],n))
def main():
    state=load(); state['lastRun']=utcnow().isoformat(); state['schema']='froids300-v26'
    state.setdefault('predictions',[])
    url=os.getenv('FDJ_OFFICIAL_FEED_URL','').strip()
    try:
        if not url.startswith('https://'): raise ValueError('Source HTTPS FDJ non configurée')
        if os.getenv('FDJ_FEED_AUDITED')!='yes': raise ValueError('Provenance officielle de la source non auditée')
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'IA-LOTO-V26/1.0'}),timeout=25) as resp:
            raw=resp.read(12_000_001)
        if len(raw)>12_000_000: raise ValueError('Source trop volumineuse')
        history=parse(raw.decode('utf-8-sig'))
        if len(history)<300: raise ValueError('Historique inférieur à 300 tirages')
        today=utcnow().date()
        if dt.date.fromisoformat(history[-1]['date'])>today: raise ValueError('Source contient un tirage futur')
        if (today-dt.date.fromisoformat(history[-1]['date'])).days>4: raise ValueError('Historique périmé, publication suspendue')
        # Vérification d'intégrité : aucun trou dans les dates attendues des 300 derniers tirages.
        recent=history[-300:]
        for older,newer in zip(recent,recent[1:]):
            if next_draw(older['date']) != newer['date']:
                raise ValueError('Historique incomplet entre '+older['date']+' et '+newer['date'])
        by_date={r['date']:r for r in history}
        for p in state['predictions']:
            if p['date'] in by_date and 'outcome' not in p:
                actual=by_date[p['date']]
                p['outcome']={'numbers':actual['numbers'],'chance':actual['chance'],'matches':len(set(actual['numbers'])&set(p['numbers'])),'chanceMatch':actual['chance']==p['chance']}
                p['prospectiveValidated']=False
                p['proof']='À auditer : publication indépendante antérieure au tirage'
        target=next_draw(history[-1]['date'])
        # Do not generate a retroactive prediction. Date alone is insufficient to prove cutoff.
        # Le tirage cible doit être futur en heure locale française, et jamais le jour même.
        if dt.date.fromisoformat(target)>dt.datetime.now(dt.timezone(dt.timedelta(hours=1))).date() and not any(p['date']==target for p in state['predictions']):
            nums,chance=pick(history)
            state['predictions'].append({'date':target,'numbers':nums,'chance':chance,'calculatedAt':utcnow().isoformat(),'inputLastDraw':history[-1]['date'],'inputCount':300,'method':'froids300-fixed','sourceSha256':hashlib.sha256(raw).hexdigest(),'prospectiveValidated':False,'proof':'Non certifié : vérifier le commit public antérieur au tirage'})
        state['configured']=True
        state['lastOfficialDraw']=history[-1]['date']
        state['message']='Source lue. Prévisions proposées, certification prospective en attente d’audit.'
    except Exception as exc:
        state['configured']=False
        state['message']='VÉRIFICATION IMPOSSIBLE : '+str(exc)
    state['validated']=sum(bool(p.get('prospectiveValidated') and p.get('outcome')) for p in state['predictions'])
    state['examined']=sum('outcome' in p for p in state['predictions'])
    save(state)
if __name__=='__main__': main()
