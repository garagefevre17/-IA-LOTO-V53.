import unittest
import tempfile
from unittest.mock import patch
import json
import io
import zipfile
from datetime import date, timedelta
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'automation'))
from pipeline import build_forecast, evaluate, expected_dates, parse_csv, normalize_date, official_zip_urls, ArchiveLinks


def samples(game, start, end):
    week = {0,2,5} if game == 'loto' else {1,4}
    result=[]
    d=start
    while d<=end:
        if d.weekday() in week:
            nmax=49 if game=='loto' else 50
            a = len(result)
            nums=sorted({((a*7+i) % nmax)+1 for i in range(5)})
            # Avoid cyclic accidental duplicates
            if len(nums)!=5:
                nums=list(range(1,6))
            extras=[(a%10)+1] if game=='loto' else [((a%12)+1), (((a+5)%12)+1)]
            result.append({'date':d.isoformat(),'nums':nums,'extras':sorted(extras)})
        d+=timedelta(days=1)
    return result

class PipelineTests(unittest.TestCase):
    def test_loto_froids_300_fixed_and_no_future_data(self):
        target=date(2026,11,21) # Saturday
        history=samples('loto',date(2024,10,1),target-timedelta(days=1))
        forecast=build_forecast('loto',history,target)
        self.assertEqual(forecast['count'],300)
        self.assertEqual(len(forecast['grids']),1)
        self.assertEqual(len(forecast['grids'][0]['numbers']),5)
        added=history+[{'date':target.isoformat(),'nums':[1,2,3,4,5],'extras':[1]}]
        self.assertEqual(forecast,build_forecast('loto',added,target))

    def test_euromillions_hot_365_three_distinct_grids(self):
        target=date(2026,11,20)
        rows=samples('euromillions',target-timedelta(days=500),target-timedelta(days=1))
        f=build_forecast('euromillions',rows,target)
        self.assertEqual(f['count'],len(expected_dates('euromillions',target-timedelta(days=365),target-timedelta(days=1))))
        self.assertEqual(len(f['grids']),3)
        hot=f['grids'][:3]
        self.assertEqual(len(set(sum([g['numbers'] for g in hot],[]))),15)
        self.assertEqual(len(set(sum([g['extras'] for g in hot],[]))),6)
        for g in hot:
            self.assertEqual(len(g['numbers']),5)
            self.assertEqual(len(g['extras']),2)

    def test_gap_is_blocking(self):
        target=date(2026,11,20)
        rows=samples('euromillions',target-timedelta(days=365),target-timedelta(days=1))
        rows.pop(4)
        with self.assertRaisesRegex(ValueError,'incomplet'):
            build_forecast('euromillions',rows,target)

    def test_invalid_csv_rejected(self):
        with self.assertRaises(ValueError):
            parse_csv(b'date;n1;n2;n3;n4;n5;e1;e2\n2026-11-17;1;1;3;4;5;2;3\n','euromillions')

    def test_evaluation_correct(self):
        p={'grids':[{'method':'A','numbers':[1,2,3,4,5],'extras':[1,2]}]}
        actual={'date':'2026-11-20','nums':[3,5,9,10,11],'extras':[2,9]}
        self.assertEqual(evaluate(p,actual)[0]['number_hits'],2)
        self.assertEqual(evaluate(p,actual)[0]['extra_hits'],1)

    def test_end_to_end_repeat_without_overwrite_and_evaluation(self):
        import pipeline
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            with patch.object(pipeline,'DATA_DIR',root/'donnees'), patch.object(pipeline,'JOURNAL',root/'journal'), patch.object(pipeline,'PUBLIC',root/'tableau.json'), patch.object(pipeline,'STATE',root/'etat.json'):
                today=date(2026,11,20)
                h={g:samples(g,date(2024,10,1),date(2026,11,19)) for g in ('loto','euromillions')}
                first=pipeline.run(today=today,now=__import__('datetime').datetime(2026,11,20,10,tzinfo=pipeline.PARIS),histories=h)
                self.assertEqual(first['status'],'completed')
                e=root/'journal'/'euromillions-2026-11-20.json'
                before=e.read_bytes()
                again=pipeline.run(today=today,now=__import__('datetime').datetime(2026,11,20,11,tzinfo=pipeline.PARIS),histories=h)
                self.assertEqual(before,e.read_bytes())
                self.assertEqual(again['games']['euromillions']['status'],'already_recorded')
                actual={'date':'2026-11-20','nums':[1,2,3,4,5],'extras':[1,2]}
                h['euromillions'].append(actual)
                with patch.object(pipeline,'is_verified_prospectively',return_value=True):
                    later=pipeline.run(today=date(2026,11,21),now=__import__('datetime').datetime(2026,11,21,10,tzinfo=pipeline.PARIS),histories=h)
                self.assertTrue((root/'journal'/'resultat-euromillions-2026-11-20.json').exists())
                self.assertEqual(before,e.read_bytes())
                self.assertEqual(later['games']['euromillions']['status'],'forecast_recorded')

    def test_missing_archive_blocks_forecast_not_fake(self):
        import pipeline
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            with patch.object(pipeline,'DATA_DIR',root/'donnees'), patch.object(pipeline,'JOURNAL',root/'journal'), patch.object(pipeline,'PUBLIC',root/'tableau.json'), patch.object(pipeline,'STATE',root/'etat.json'):
                h={'loto':samples('loto',date(2024,10,1),date(2026,11,19)),
                   'euromillions':samples('euromillions',date(2026,9,1),date(2026,11,19))}
                result=pipeline.run(today=date(2026,11,20),now=__import__('datetime').datetime(2026,11,20,10,tzinfo=pipeline.PARIS),histories=h)
                self.assertEqual(result['games']['euromillions']['status'],'blocked')
                self.assertFalse((root/'journal'/'euromillions-2026-11-20.json').exists())

    def test_official_archive_zip_collector_with_mock_fdj(self):
        import pipeline
        target=date(2026,11,20)
        rows=samples('euromillions',target-timedelta(days=500),target-timedelta(days=1))
        header='date_de_tirage;boule_1;boule_2;boule_3;boule_4;boule_5;etoile_1;etoile_2'
        lines=[header]
        for row in rows:
            d=date.fromisoformat(row['date']).strftime('%d/%m/%Y')
            lines.append(';'.join(map(str,[d]+row['nums']+row['extras'])))
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w') as z:
            z.writestr('euromillions_2020.csv','\n'.join(lines)+'\n')
        page=b'<html><a href="https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/example">ZIP courant</a></html>'
        def fake_get(url):
            return page if url.endswith('/historique') else buf.getvalue()
        with patch.object(pipeline,'get',side_effect=fake_get):
            actual,sources=pipeline.fetch_history('euromillions', as_of=target)
        self.assertEqual(len(actual),len(rows))
        self.assertEqual(actual[-1],rows[-1])
        self.assertEqual(len(sources[0]['zip_sha256']),64)

    def test_html_parser_links(self):
        p=ArchiveLinks();p.feed('<a href="https://www.sto.api.fdj.fr/x">2020 a novembre 2026 ZIP</a>')
        self.assertEqual(p.links[0]['href'],'https://www.sto.api.fdj.fr/x')

if __name__=='__main__': unittest.main()

# Audits de régression supplémentaires: archives multiples et preuve non falsifiable.
class HardeningTests(unittest.TestCase):
    def test_multiple_fdj_archive_ranges_merged(self):
        import pipeline
        target=date(2026,11,20)
        allrows=samples('euromillions',target-timedelta(days=500),target-timedelta(days=1))
        def archive(rows):
            hdr='date_de_tirage;boule_1;boule_2;boule_3;boule_4;boule_5;etoile_1;etoile_2'
            csv_lines=[hdr]+[';'.join([date.fromisoformat(r['date']).strftime('%d/%m/%Y')]+[str(x) for x in r['nums']+r['extras']]) for r in rows]
            f=io.BytesIO()
            with zipfile.ZipFile(f,'w') as z:z.writestr('draws.csv','\n'.join(csv_lines))
            return f.getvalue()
        first='https://www.sto.api.fdj.fr/documentations/new'
        second='https://www.sto.api.fdj.fr/documentations/old'
        page=('<a href="'+first+'">archives nouvelles</a><a href="'+second+'">archives anciennes</a>').encode()
        payload={first:archive(allrows[-40:]),second:archive(allrows[:-40])}
        def fake(url):return page if url.endswith('/historique') else payload[url]
        with patch.object(pipeline,'get',side_effect=fake):
            rows, sources=pipeline.fetch_history('euromillions', as_of=target)
        self.assertEqual(rows,allrows)
        self.assertEqual(len(sources),2)
        self.assertEqual(build_forecast('euromillions',rows,target)['count'],len(expected_dates('euromillions',target-timedelta(days=365),target-timedelta(days=1))))

    def test_conflicting_overlapping_zip_ranges_rejected(self):
        import pipeline
        date_str='17/11/2026'
        header='date_de_tirage;boule_1;boule_2;boule_3;boule_4;boule_5;etoile_1;etoile_2\n'
        def ziprow(nums):
            b=io.BytesIO()
            with zipfile.ZipFile(b,'w') as z:z.writestr('data.csv',header+date_str+';'+nums+';1;2\n')
            return b.getvalue()
        urls=['https://www.sto.api.fdj.fr/documentations/a','https://www.sto.api.fdj.fr/documentations/b']
        page=(''.join('<a href="'+u+'">zip</a>' for u in urls)).encode()
        mapping={urls[0]:ziprow('1;2;3;4;5'),urls[1]:ziprow('6;7;8;9;10')}
        with patch.object(pipeline,'get',side_effect=lambda url: page if url.endswith('/historique') else mapping[url]):
            with self.assertRaisesRegex(ValueError,'contradictoires'):
                pipeline.fetch_history('euromillions')

    def test_expired_forecast_not_timestamped(self):
        import timestamp
        with tempfile.TemporaryDirectory() as td:
            src=Path(td)/'euromillions-2020-11-20.json'
            f={'target':'2020-11-20'}
            src.write_text(json.dumps({'forecast':f,'content_sha256':__import__('pipeline').digest(f)}))
            with patch.object(timestamp,'PROOFS',Path(td)/'preuves'):
                with self.assertRaisesRegex(RuntimeError,'heure limite'):
                    timestamp.stamp_file(src)

    def test_existing_proof_requires_payload_files(self):
        import timestamp
        with tempfile.TemporaryDirectory() as td:
            src=Path(td)/'loto-2026-11-21.json'
            f={'target':'2026-11-21'}
            src.write_text(json.dumps({'forecast':f,'content_sha256':__import__('pipeline').digest(f)}))
            h=__import__('hashlib').sha256(src.read_bytes()).hexdigest()
            dest=Path(td)/'preuves';dest.mkdir()
            (dest/'loto-2026-11-21.json').write_text(json.dumps({'verified':True,'file_sha256':h,'tsa_time_utc':'2026-11-21T10:00:00+00:00'}))
            with patch.object(timestamp,'PROOFS',dest):
                with self.assertRaisesRegex(RuntimeError,'absentes'):
                    timestamp.stamp_file(src)

class AdditionalRegressionTests(unittest.TestCase):
    def test_after_cutoff_targets_next_draw(self):
        import pipeline
        from datetime import datetime
        now=datetime(2026, 11, 20, 19, 5, tzinfo=pipeline.PARIS)
        self.assertEqual(pipeline.next_draw('euromillions',now.date(),now),date(2026,11,24))
        self.assertEqual(pipeline.next_draw('loto',now.date(),now),date(2026,11,21))
        before=datetime(2026, 11, 20, 17, 59, tzinfo=pipeline.PARIS)
        self.assertEqual(pipeline.next_draw('euromillions',before.date(),before),date(2026,11,20))

    def test_history_empty_rejected_cleanly(self):
        with self.assertRaisesRegex(ValueError, 'vide'):
            parse_csv(b'', 'euromillions')

    def test_result_checksum_archive_rotation_does_not_block(self):
        import pipeline
        from datetime import datetime
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            with patch.object(pipeline,'DATA_DIR',root/'donnees'), patch.object(pipeline,'JOURNAL',root/'journal'), patch.object(pipeline,'PUBLIC',root/'tableau.json'), patch.object(pipeline,'STATE',root/'etat.json'):
                records={g:samples(g,date(2024,10,1),date(2026,11,19)) for g in ('loto','euromillions')}
                t=datetime(2026,11,20,10,tzinfo=pipeline.PARIS)
                pipeline.run(today=t.date(),now=t,histories=records)
                records['euromillions'].append({'date':'2026-11-20','nums':[1,2,3,4,5],'extras':[1,2]})
                t=datetime(2026,11,21,10,tzinfo=pipeline.PARIS)
                with patch.object(pipeline,'is_verified_prospectively',return_value=True):
                    pipeline.run(today=t.date(),now=t,histories=records)
                resultfile=root/'journal'/'resultat-euromillions-2026-11-20.json'
                previous=json.loads(resultfile.read_text())
                # A real official archive is rebuilt as new draws are added.
                with patch.object(pipeline,'fetch_history',side_effect=lambda game, **kw:(records[game],[{'zip_sha256':'changed_archive_hash','url':'fixture://rotated'}])):
                    with patch.object(pipeline,'is_verified_prospectively',return_value=True):
                        again=pipeline.run(today=t.date(),now=t)
                self.assertNotEqual(again['games']['euromillions']['status'],'blocked')
                self.assertEqual(previous,json.loads(resultfile.read_text()))

    def test_results_not_evaluated_before_draw_close(self):
        import pipeline
        from datetime import datetime
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            with patch.object(pipeline,'DATA_DIR',root/'donnees'), patch.object(pipeline,'JOURNAL',root/'journal'), patch.object(pipeline,'PUBLIC',root/'tableau.json'), patch.object(pipeline,'STATE',root/'etat.json'):
                records={g:samples(g,date(2024,10,1),date(2026,11,19)) for g in ('loto','euromillions')}
                pipeline.run(now=datetime(2026,11,20,10,tzinfo=pipeline.PARIS),histories=records)
                records['euromillions'].append({'date':'2026-11-20','nums':[1,2,3,4,5],'extras':[1,2]})
                pipeline.run(now=datetime(2026,11,20,12,tzinfo=pipeline.PARIS),histories=records)
                self.assertFalse((root/'journal'/'resultat-euromillions-2026-11-20.json').exists())

    def test_manifest_signed_time_mismatch_blocked(self):
        import timestamp
        from datetime import datetime, timezone
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            src=root/'loto-2026-11-21.json'
            f={'target':'2026-11-21'}
            src.write_text(json.dumps({'forecast':f,'content_sha256':__import__('pipeline').digest(f)}))
            dest=root/'proofs'/'loto-2026-11-21';dest.parent.mkdir()
            import hashlib
            def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
            for suffix in ('.tsq','.tsr','.ca.pem','.tsa.crt'):
                dest.with_suffix(suffix).write_text('test')
            manifest=dest.with_suffix('.json')
            manifest.write_text(json.dumps({'verified':True,'file_sha256':h(src),'tsq_sha256':h(dest.with_suffix('.tsq')),
                'tsr_sha256':h(dest.with_suffix('.tsr')),'ca_sha256':h(dest.with_suffix('.ca.pem')),
                'tsa_cert_sha256':h(dest.with_suffix('.tsa.crt')),'tsa_time_utc':'2026-11-21T10:00:00+00:00'}))
            with patch.object(timestamp,'run_cmd',return_value='Verification: OK'), patch.object(timestamp,'extract_signed_time',return_value=datetime(2026,11,21,19,tzinfo=timezone.utc)), patch.dict('os.environ',{'FREETSA_CA_SHA256':h(dest.with_suffix('.ca.pem'))}):
                with self.assertRaisesRegex(RuntimeError,'différente'):
                    timestamp.check_existing(src,dest,manifest,datetime(2026,11,21,18,tzinfo=timestamp.PARIS))
