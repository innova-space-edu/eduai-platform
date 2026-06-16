#!/usr/bin/env node
/*
  Importa un listado de alumnos exportado como .xls HTML desde el libro de clases.
  Uso:
    node scripts/import-student-roster.js ./listado_alumnos.xls "1° Medio A" 2026

  Requiere variables:
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
*/
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const file = process.argv[2]
const course = process.argv[3] || '1° Medio A'
const schoolYear = process.argv[4] || '2026'

if (!file) {
  console.error('Falta archivo. Ej: node scripts/import-student-roster.js ./listado_alumnos.xls "1° Medio A" 2026')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeName(value) {
  return String(value || '')
    .replace(/\s+\d{2}\/\d{2}\/\d{4}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function cleanRut(value) {
  return String(value || '').toUpperCase().replace(/[^0-9K]/g, '').slice(0, 9)
}

function parseRows(html) {
  const rows = []
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || []
  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => decodeHtml(m[1]))
    if (cells.length >= 3 && /^\d+$/.test(cells[0]) && /[0-9.]+-[0-9K]/i.test(cells[1])) {
      const studentName = normalizeName(cells[2])
      const rutClean = cleanRut(cells[1])
      if (studentName && rutClean) {
        rows.push({
          school_year: schoolYear,
          course,
          student_name: studentName,
          student_name_normalized: normalizeSearch(studentName),
          rut: cells[1],
          rut_clean: rutClean,
          source: 'import_listado_alumnos',
          active: true,
        })
      }
    }
  }
  return rows
}

async function main() {
  const raw = fs.readFileSync(file)
  const html = raw.toString('latin1')
  const rows = parseRows(html)
  if (!rows.length) {
    throw new Error('No se encontraron estudiantes en el archivo')
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { error } = await supabase
    .from('student_roster')
    .upsert(rows, { onConflict: 'school_year,course,rut_clean' })

  if (error) throw error
  console.log(`Importados/actualizados: ${rows.length} estudiantes para ${course} (${schoolYear})`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
