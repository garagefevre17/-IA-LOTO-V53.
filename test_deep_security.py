import hashlib
import json
import tempfile
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'automation'))
import pipeline
import timestamp

def samples(game, start, end):
    weeks=pipeline.CONFIG[game]['weekdays']; upper=pipeline.CONFIG[game]['limit']; extra=pipeline.CONFIG[game]['extra']
    rows=[]; t=start
    while t<=end:
        if t.weekday() in weeks:
            i=len(rows)
            nums=sorted([1+(i*5+j)%upper for j in range(5)])
            extras=[1+i%extra] if game=='loto' else sorted([1+i%extra,1+(i+3)%extra])
            rows.append({'date':t.isoformat(),'nums':nums,'extras':extras})
        t+=timedelta(days=1)
    return rows

class DeepSecurityTests(unittest.TestCase):
    def test_empty_proof_is_not_prospective(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'loto-2026-11-21.json'
            f={'target':'2026-11-21','grids':[]}
            p.write_text(json.dumps({'forecast':f,'content_sha256':pipeline.digest(f)}))
            with patch.object(timestamp,'PROOFS',Path(tmp)/'proofs'):
                self.assertFalse(pipeline.is_verified_prospectively(p))

    def test_tampered_forecast_cannot_be_evaluated(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'loto-2026-11-21.json'
            f={'target':'2026-11-21'}
            p.write_text(json.dumps({'forecast':{'target':'2026-11-22'},'content_sha256':pipeline.digest(f)}))
            with self.assertRaisesRegex(ValueError,'empreinte'):
                pipeline.validate_prior_forecast(p)

    def test_bad_manifest_cannot_be_trusted(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'loto-2026-11-21.json'; f={'target':'2026-11-21'}
            p.write_text(json.dumps({'forecast':f,'content_sha256':pipeline.digest(f)}))
            proofdir=Path(tmp)/'proofs';proofdir.mkdir()
            (proofdir/(p.stem+'.json')).write_text(json.dumps({'verified':True,'file_sha256':'0'*64}))
            with patch.object(timestamp,'PROOFS',proofdir):
                with self.assertRaisesRegex(RuntimeError,'incohérent'):
                    pipeline.is_verified_prospectively(p)

    def test_unverified_prediction_not_published_as_evaluated_result(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);data={game:samples(game,date(2024,10,1),date(2026,11,19)) for game in pipeline.CONFIG}
            with patch.object(pipeline,'DATA_DIR',root/'donnees'),patch.object(pipeline,'JOURNAL',root/'journal'),patch.object(pipeline,'PUBLIC',root/'tableau.json'),patch.object(pipeline,'STATE',root/'etat.json'),patch.object(timestamp,'PROOFS',root/'proofs'):
                pipeline.run(now=datetime(2026,11,20,10,tzinfo=pipeline.PARIS),histories=data)
                data['euromillions'].append({'date':'2026-11-20','nums':[1,2,3,4,5],'extras':[1,2]})
                second=pipeline.run(now=datetime(2026,11,21,10,tzinfo=pipeline.PARIS),histories=data)
                self.assertFalse((root/'journal'/'resultat-euromillions-2026-11-20.json').exists())
                checks=second['games']['euromillions']['evaluated']
                self.assertTrue(any(x.get('status')=='uncertified_no_result_published' for x in checks))

    def test_authenticated_proof_allows_prospective_evaluation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);data={game:samples(game,date(2024,10,1),date(2026,11,19)) for game in pipeline.CONFIG}
            with patch.object(pipeline,'DATA_DIR',root/'donnees'),patch.object(pipeline,'JOURNAL',root/'journal'),patch.object(pipeline,'PUBLIC',root/'tableau.json'),patch.object(pipeline,'STATE',root/'etat.json'):
                pipeline.run(now=datetime(2026,11,20,10,tzinfo=pipeline.PARIS),histories=data)
                data['euromillions'].append({'date':'2026-11-20','nums':[1,2,3,4,5],'extras':[1,2]})
                with patch.object(pipeline,'is_verified_prospectively',return_value=True):
                    result=pipeline.run(now=datetime(2026,11,21,10,tzinfo=pipeline.PARIS),histories=data)
                entry=json.loads((root/'journal'/'resultat-euromillions-2026-11-20.json').read_text())
                self.assertTrue(entry['prospectively_certified'])
                self.assertEqual(len(entry['forecast_sha256']),64)

    def test_timestamp_rejects_forecast_with_invalid_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'euromillions-2026-11-24.json'
            p.write_text(json.dumps({'forecast':{'target':'2026-11-24'},'content_sha256':'BAD'}))
            with self.assertRaisesRegex(RuntimeError,'corrompue'):
                timestamp.stamp_file(p)

    def test_root_ca_pin_is_mandatory(self):
        with patch.dict('os.environ', {'FREETSA_CA_SHA256':''}):
            with self.assertRaisesRegex(RuntimeError,'non configuré'):
                timestamp.trusted_root_hash()

    def test_checksum_independent_of_json_key_order(self):
        a={'target':'2026-11-24','count':105,'grids':[]}
        b={'grids':[],'count':105,'target':'2026-11-24'}
        self.assertEqual(pipeline.digest(a),pipeline.digest(b))

if __name__=='__main__':unittest.main()

class CollectorOrderingTests(unittest.TestCase):
    def test_old_archive_before_new_does_not_hide_recent_tirages(self):
        import io,zipfile
        end=date(2026,11,19)
        rows=samples('euromillions',date(2025,7,1),end)
        hdr='date_de_tirage;boule_1;boule_2;boule_3;boule_4;boule_5;etoile_1;etoile_2'
        def make_zip(entries):
            lines=[hdr]
            for r in entries:
                dt=date.fromisoformat(r['date']).strftime('%d/%m/%Y')
                lines.append(';'.join(map(str,[dt]+r['nums']+r['extras'])))
            b=io.BytesIO()
            with zipfile.ZipFile(b,'w') as z:z.writestr('data.csv','\n'.join(lines))
            return b.getvalue()
        old='https://www.sto.api.fdj.fr/documentations/ancien'
        recent='https://www.sto.api.fdj.fr/documentations/recent'
        html=(''.join('<a href="'+x+'">ZIP</a>' for x in (old,recent))).encode()
        archives={old:make_zip(rows[:20]),recent:make_zip(rows)}
        with patch.object(pipeline,'get',side_effect=lambda url: html if url.endswith('/historique') else archives[url]):
            data,source=pipeline.fetch_history('euromillions',as_of=date(2026,11,20))
        self.assertEqual(len(data),len(rows))
        self.assertEqual(data[-1]['date'],'2026-11-17')
        self.assertEqual(len(source),2)

    def test_invalid_future_draws_cannot_fill_missing_history(self):
        target=date(2026,11,20)
        data=samples('euromillions',target-timedelta(days=365),target-timedelta(days=1))
        data.pop(3)
        data.append({'date':'2026-11-24','nums':[1,2,3,4,5],'extras':[1,2]})
        with self.assertRaisesRegex(ValueError,'incomplet'):
            pipeline.build_forecast('euromillions',data,target)
