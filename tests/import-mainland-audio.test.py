"""Import exact approved subsets without changing source bytes or originals."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

MODULE = Path(__file__).parents[1] / 'scripts/import-mainland-audio.py'


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(MODULE.exists(), 'Reviewed subset importer is missing')
        spec = importlib.util.spec_from_file_location('importer', MODULE)
        self.tool = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.tool)

    def fixture(self, temp):
        root = Path(temp);archive = root / 'original.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('tone_perfect/jia3_FV3_MP3.mp3', b'original jia3 recording')
            z.writestr('tone_perfect/jia4_MV3_MP3.mp3', b'original jia4 recording')
        rows = []
        for reading, speaker in [('jia3', 'FV3'), ('jia4', 'MV3')]:
            body = ('original ' + reading + ' recording').encode()
            rows.append({'reading': reading, 'speaker': speaker, 'sourceId': reading+'_'+speaker,
                         'member': 'tone_perfect/'+reading+'_'+speaker+'_MP3.mp3',
                         'sha256': hashlib.sha256(body).hexdigest(),
                         'components': dict.fromkeys(['initial', 'final', 'tone'], 'matches')})
        selection = {'schemaVersion': 1, 'releaseApproved': True, 'methodQualified': True,
                     'frozenMethodSha256': 'a'*64, 'evaluationSha256': 'b'*64,
                     'sourceArchiveSha256': self.tool.file_hash(archive), 'readings': rows}
        return archive, selection

    def test_unapproved_or_unbound_subset_never_writes_public_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            archive, selection = self.fixture(temp);out = Path(temp)/'output'
            for key in ('releaseApproved', 'methodQualified'):
                bad = {**selection, key: False}
                with patch.object(self.tool, 'SOURCE_SHA256', selection['sourceArchiveSha256']):
                    with self.assertRaises(ValueError):self.tool.import_subset(bad, archive, out, {'jia3','jia4'})
                self.assertFalse(out.exists())
            with self.assertRaises(ValueError):self.tool.import_subset(selection, archive, out, {'jia3','jia4'})
            self.assertFalse(out.exists())

    def test_selected_bytes_and_alternates_stay_exact_and_repeat_import_preserves_outputs(self):
        with tempfile.TemporaryDirectory() as temp:
            archive, selection = self.fixture(temp);out = Path(temp)/'output';before=archive.read_bytes()
            with patch.object(self.tool, 'SOURCE_SHA256', selection['sourceArchiveSha256']):
                manifest = self.tool.import_subset(selection, archive, out, {'jia3','jia4'})
                self.tool.import_subset(selection, archive, out, {'jia3','jia4'})
                self.assertEqual(set(manifest['readings']), {'jia3','jia4'})
                for reading,row in manifest['readings'].items():
                    self.assertEqual((out/row['file']).read_bytes(), ('original '+reading+' recording').encode())
                self.assertEqual(archive.read_bytes(), before)
                file = out/manifest['readings']['jia3']['file'];file.write_bytes(b'preserve changed local file')
                with self.assertRaises(ValueError):self.tool.import_subset(selection, archive, out, {'jia3','jia4'})
                self.assertEqual(file.read_bytes(), b'preserve changed local file')

    def test_wrong_component_or_source_reading_fails_before_any_output(self):
        with tempfile.TemporaryDirectory() as temp:
            archive, selection = self.fixture(temp);out=Path(temp)/'output'
            selection['readings'][0]['components']['tone']='abstained'
            with patch.object(self.tool, 'SOURCE_SHA256', selection['sourceArchiveSha256']):
                with self.assertRaises(ValueError):self.tool.import_subset(selection, archive, out, {'jia3','jia4'})
            self.assertFalse(out.exists())

    def test_source_lexical_flags_and_derived_exception_are_never_silently_dropped(self):
        with tempfile.TemporaryDirectory() as temp:
            archive, selection = self.fixture(temp);out = Path(temp)/'output'
            selection['readings'][0]['originalSourceLexicalGap'] = False
            with patch.object(self.tool, 'SOURCE_SHA256', selection['sourceArchiveSha256']):
                manifest = self.tool.import_subset(selection, archive, out, {'jia3','jia4'})
            self.assertIs(manifest['readings']['jia3']['originalSourceLexicalGap'], False)
            selection['readings'][0]['originalSourceLexicalGap'] = True
            with patch.object(self.tool, 'SOURCE_SHA256', selection['sourceArchiveSha256']):
                with self.assertRaises(ValueError):self.tool.import_subset(selection, archive, Path(temp)/'bad', {'jia3','jia4'})

    def test_reviewed_flag_exception_keeps_original_classification_and_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            archive, selection = self.fixture(temp)
            row=selection['readings'][0]
            with zipfile.ZipFile(archive, 'a') as z:z.writestr('tone_perfect/cuo4_FV3_MP3.mp3', b'original jia3 recording')
            row.update(reading='cuo4',sourceId='cuo4_FV3',member='tone_perfect/cuo4_FV3_MP3.mp3',originalSourceLexicalGap=True,
                       lexicalMetadataException={'reading':'cuo4','evidenceSha256':'c'*64,'schoolCharacters':['错']})
            selection['sourceArchiveSha256']=self.tool.file_hash(archive)
            with patch.object(self.tool, 'SOURCE_SHA256', selection['sourceArchiveSha256']):
                manifest=self.tool.import_subset(selection,archive,Path(temp)/'output',{'cuo4','jia4'})
            self.assertIs(manifest['readings']['cuo4']['originalSourceLexicalGap'],True)
            self.assertEqual(manifest['readings']['cuo4']['lexicalMetadataException'],row['lexicalMetadataException'])

    def source_review_selection(self, selection):
        return {**selection, 'acceptanceBasis':'native-source-review', 'methodQualified':False,
                'ownerAuthorizationSha256':'d'*64,
                'sourceReview':{'productionPaperURL':'https://ideah.pubpub.org/pub/hh90jpsu/release/5',
                                'nativeReviewDocumented':True}}

    def test_owner_authorized_source_release_retains_unfinished_checker_status(self):
        with tempfile.TemporaryDirectory() as temp:
            archive, selection=self.fixture(temp);selection=self.source_review_selection(selection)
            selection['readings'][0]['components']['final']='abstained'
            with patch.object(self.tool,'SOURCE_SHA256',selection['sourceArchiveSha256']):
                manifest=self.tool.import_subset(selection,archive,Path(temp)/'output',{'jia3','jia4'})
            self.assertFalse(manifest['verification']['methodQualified'])
            self.assertEqual(manifest['verification']['acceptanceBasis'],'native-source-review')
            self.assertEqual(manifest['readings']['jia3']['automaticCheckStatus'],'pending')
            self.assertEqual(manifest['readings']['jia4']['automaticCheckStatus'],'components-match')
            runtime=(Path(temp)/'output/mainland-pronunciations.js').read_text()
            self.assertIn('pendingReadings',runtime);self.assertIn('jia3',runtime)

    def test_source_release_requires_owner_source_evidence_and_cannot_claim_method_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            archive, selection=self.fixture(temp);selection=self.source_review_selection(selection)
            cases=[{**selection,'ownerAuthorizationSha256':''},{**selection,'sourceReview':{}},
                   {**selection,'methodQualified':True}]
            for i,bad in enumerate(cases):
                with patch.object(self.tool,'SOURCE_SHA256',selection['sourceArchiveSha256']):
                    with self.assertRaises(ValueError):self.tool.import_subset(bad,archive,Path(temp)/str(i),{'jia3','jia4'})
            selection['readings'][0]['components']['final']='mismatch'
            with patch.object(self.tool,'SOURCE_SHA256',selection['sourceArchiveSha256']):
                with self.assertRaises(ValueError):self.tool.import_subset(selection,archive,Path(temp)/'disputed',{'jia3','jia4'})


if __name__ == '__main__':unittest.main()
