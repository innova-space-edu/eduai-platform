#!/usr/bin/env python3
"""Bounded OOXML validator for Dell Gestion storage. No macros or external links.
Pure stdlib; read-only; fail closed. It is NOT a malware detector (clamd is separate).
No file bodies, PII or paths are emitted on errors.
"""
import json, os, stat, sys, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

MAX_COMPRESSED = 20 * 1024 * 1024
MAX_UNCOMPRESSED = 64 * 1024 * 1024
MAX_ENTRY = 12 * 1024 * 1024
MAX_XML_ENTRY = 6 * 1024 * 1024
MAX_ENTRIES = 512
MAX_RATIO = 250
SUPPORTED = {'docx': 'word/document.xml', 'xlsx': 'xl/workbook.xml'}
FORBIDDEN = ('/externallinks/', '/embeddings/', '/activex/', '/ctrlprops/', '/macros/', '/oleobject')
FORBIDDEN_EXT = ('.bin', '.exe', '.com', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jar', '.msi', '.scr', '.sh')
CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types'
PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
DOCX_MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
XLSX_MAIN = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'

def fail(code):
    raise ValueError(code)

def inspect(path, extension):
    if extension not in SUPPORTED:
        fail('OOXML_KIND_INVALID')
    p = Path(path)
    try:
        st = p.lstat()
    except OSError:
        fail('OOXML_NOT_FOUND')
    if not stat.S_ISREG(st.st_mode) or stat.S_ISLNK(st.st_mode) or st.st_size < 100 or st.st_size > MAX_COMPRESSED:
        fail('OOXML_FILE_INVALID')
    if not zipfile.is_zipfile(p):
        fail('OOXML_ZIP_INVALID')
    try:
        with zipfile.ZipFile(p, 'r') as z:
            entries = z.infolist()
            if len(entries) < 3 or len(entries) > MAX_ENTRIES:
                fail('OOXML_PART_COUNT')
            names = set()
            expanded = 0
            for member in entries:
                name = member.filename
                lower = '/' + name.lower()
                if (not name or name.startswith('/') or name.startswith('\\') or '\\' in name or '\x00' in name
                    or ':' in name or any(v in ('.', '..', '') for v in name.strip('/').split('/'))
                    or name in names):
                    fail('OOXML_UNSAFE_PATH')
                names.add(name)
                if member.flag_bits & 1 or member.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                    fail('OOXML_UNSUPPORTED_ZIP')
                if stat.S_IFMT(member.external_attr >> 16) == stat.S_IFLNK:
                    fail('OOXML_SYMLINK')
                if (any(p in lower for p in FORBIDDEN)
                    or lower.endswith(FORBIDDEN_EXT)
                    or 'vbaproject' in lower or 'macrosheet' in lower):
                    fail('OOXML_ACTIVE_CONTENT')
                if (member.file_size > MAX_ENTRY
                    or (member.file_size > 1000 and member.file_size/max(1, member.compress_size) > MAX_RATIO)):
                    fail('OOXML_ZIP_BOMB')
                expanded += member.file_size
                if expanded > MAX_UNCOMPRESSED:
                    fail('OOXML_ZIP_BOMB')
            for required in ('[Content_Types].xml', '_rels/.rels', SUPPORTED[extension]):
                if required not in names:
                    fail('OOXML_MISSING_PART')
            main_expected = DOCX_MAIN if extension == 'docx' else XLSX_MAIN
            ct = ET.fromstring(z.read('[Content_Types].xml'))
            accepted = False
            for override in ct.findall('{%s}Override' % CONTENT_TYPES):
                if override.get('PartName', '').lstrip('/') == SUPPORTED[extension]:
                    accepted = override.get('ContentType') == main_expected
            if not accepted:
                fail('OOXML_MIME_CONFLICT')
            for info in entries:
                if not (info.filename.endswith('.xml') or info.filename.endswith('.rels')):
                    continue
                if info.file_size > MAX_XML_ENTRY:
                    fail('OOXML_XML_LIMIT')
                body = z.read(info)
                if b'<!DOCTYPE' in body.upper() or b'<!ENTITY' in body.upper():
                    fail('OOXML_XML_DTD')
                try:
                    tree = ET.fromstring(body)
                except ET.ParseError:
                    fail('OOXML_XML_INVALID')
                if info.filename.endswith('.rels'):
                    for link in tree.findall('{%s}Relationship' % PKG_REL):
                        if link.get('TargetMode') == 'External':
                            fail('OOXML_EXTERNAL_LINK')
                del tree
            if z.testzip() is not None:
                fail('OOXML_CRC_INVALID')
    except (zipfile.BadZipFile, zipfile.LargeZipFile, RuntimeError, OSError, ET.ParseError):
        fail('OOXML_ZIP_INVALID')
    return {'verified': True, 'macroFree': True, 'noExternalLinks': True, 'safeSize': True}

def main():
    if len(sys.argv) != 3:
        fail('OOXML_ARGUMENTS_INVALID')
    result = inspect(sys.argv[1], sys.argv[2])
    print(json.dumps(result, separators=(',', ':')))

if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, IndexError, OverflowError):
        print(json.dumps({'verified': False, 'macroFree': False, 'noExternalLinks': False, 'safeSize': False}), flush=True)
        sys.exit(2)
