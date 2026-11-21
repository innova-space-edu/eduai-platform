import unittest, tempfile, zipfile, os, sys, shutil, stat
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('ooxml_validator',Path(__file__).with_name('inspect-ooxml.py'))
validator=importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
inspect=validator.inspect

MAIN_DOC='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
MAIN_XLS='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
def make_zip(filepath,kind='docx',extra=None,overwrite=None):
    part='word/document.xml' if kind=='docx' else 'xl/workbook.xml'
    content_type=MAIN_DOC if kind=='docx' else MAIN_XLS
    types=('<?xml version="1.0"?>'
       '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
       '<Override PartName="/'+part+'" ContentType="'+content_type+'"/>'
       '</Types>')
    rels=('<?xml version="1.0"?>'
       '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
       '<Relationship Id="rId1" Target="'+part+'" '
       'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"/>'
       '</Relationships>')
    entries={'[Content_Types].xml':types,'_rels/.rels':rels,part:'<root>Demo</root>'}
    if extra: entries.update(extra)
    if overwrite:entries.update(overwrite)
    with zipfile.ZipFile(filepath,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,value in entries.items():z.writestr(name,value)
class Inspector(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory()
  self.root=Path(self.temp.name)
  self.doc=self.root/'doc.docx'
  self.xls=self.root/'sheet.xlsx'
 def tearDown(self):self.temp.cleanup()
 def test_accept_safe_docx(self):
  make_zip(self.doc);self.assertTrue(inspect(self.doc,'docx')['verified'])
 def test_accept_safe_xlsx(self):
  make_zip(self.xls,'xlsx');self.assertTrue(inspect(self.xls,'xlsx')['safeSize'])
 def test_reject_bad_zip(self):
  self.doc.write_bytes(b'PK\x03\x04not-real')
  with self.assertRaisesRegex(ValueError,'OOXML_ZIP_INVALID|OOXML_FILE_INVALID'):inspect(self.doc,'docx')
 def test_reject_macro(self):
  make_zip(self.doc,extra={'word/vbaProject.bin':b'bad'})
  with self.assertRaisesRegex(ValueError,'OOXML_ACTIVE_CONTENT'):inspect(self.doc,'docx')
 def test_reject_external_link(self):
  rel='''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Target="https://evil.invalid" TargetMode="External"/></Relationships>'''
  make_zip(self.doc,extra={'word/_rels/document.xml.rels':rel})
  with self.assertRaisesRegex(ValueError,'OOXML_EXTERNAL_LINK'):inspect(self.doc,'docx')
 def test_reject_ooxml_zip_traversal(self):
  make_zip(self.doc,extra={'../../etc/secret':b'binary'})
  with self.assertRaisesRegex(ValueError,'OOXML_UNSAFE_PATH'):inspect(self.doc,'docx')
 def test_reject_dtype(self):
  make_zip(self.doc,overwrite={'word/document.xml':'<!DOCTYPE root [<!ENTITY a "x">]><root>&a;</root>'})
  with self.assertRaisesRegex(ValueError,'OOXML_XML_DTD'):inspect(self.doc,'docx')
 def test_reject_mime_conflict(self):
  make_zip(self.doc,'xlsx')
  with self.assertRaisesRegex(ValueError,'OOXML_MISSING_PART|OOXML_MIME_CONFLICT'):inspect(self.doc,'docx')
 def test_reject_macro_excel(self):
  make_zip(self.xls,'xlsx',extra={'xl/vbaProject.bin':b'x'})
  with self.assertRaisesRegex(ValueError,'OOXML_ACTIVE_CONTENT'):inspect(self.xls,'xlsx')
 def test_reject_formula_external_link(self):
  make_zip(self.xls,'xlsx',extra={'xl/externalLinks/externalLink1.xml':'<root/>'})
  with self.assertRaisesRegex(ValueError,'OOXML_ACTIVE_CONTENT'):inspect(self.xls,'xlsx')
 def test_reject_bomb_expansion(self):
  make_zip(self.doc,extra={'word/media/large.txt':'A'*500000})
  with self.assertRaisesRegex(ValueError,'OOXML_ZIP_BOMB'):inspect(self.doc,'docx')
 def test_reject_duplicate_filename(self):
  make_zip(self.doc)
  with zipfile.ZipFile(self.doc,'a') as z:
   import warnings
   with warnings.catch_warnings():
    warnings.simplefilter('ignore',UserWarning)
    z.writestr('word/document.xml','<root/>')
  with self.assertRaisesRegex(ValueError,'OOXML_UNSAFE_PATH'):inspect(self.doc,'docx')
 def test_reject_missing_xml(self):
  make_zip(self.doc,overwrite={'word/document.xml':'<root'})
  with self.assertRaisesRegex(ValueError,'OOXML_XML_INVALID'):inspect(self.doc,'docx')
 def test_reject_wrong_extension(self):
  make_zip(self.doc)
  with self.assertRaisesRegex(ValueError,'OOXML_KIND_INVALID'):inspect(self.doc,'zip')
if __name__=='__main__':unittest.main()
