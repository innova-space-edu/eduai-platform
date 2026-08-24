#!/usr/bin/env node
/*
  Importa un listado de alumnos exportado como .xls HTML desde el libro de clases.

  Uso:
    node scripts/import-student-roster.js ./listado_alumnos.xls "1° Medio A" 2026

  Requiere variables:
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

  La exportación del colegio puede contener alumnos retirados o matriculados en
  otro curso. Esos registros se conservan, pero se guardan con active=false.
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
  // No limitar a 9 caracteres: algunas nóminas institucionales incluyen
  // identificadores extendidos (por ejemplo IPE) con dígito verificador.
  return String(value || '').toUpperCase().replace(/[^0-9K]/g, '')
}

function rowIsInactive(tr) {
  return /class\s*=\s*['"][^'"]*retirado/i.test(tr) ||
    /MATRICULADO\s+EN\s+OTRO\s+CURSO/i.test(tr)
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
          active: !rowIsInactive(tr),
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

  // El archivo representa una fotografía completa del curso: primero deja el
  // curso en estado inactivo y luego reactiva/actualiza únicamente lo que viene
  // en la exportación. Así también se reflejan retiros y traslados posteriores.
  const { error: deactivateError } = await supabase
    .from('student_roster')
    .update({ active: false })
    .eq('school_year', schoolYear)
    .eq('course', course)

  if (deactivateError) throw deactivateError

  const { error } = await supabase
    .from('student_roster')
    .upsert(rows, { onConflict: 'school_year,course,rut_clean' })

  if (error) throw error

  const active = rows.filter((row) => row.active).length
  const inactive = rows.length - active
  console.log(`Importados/actualizados: ${rows.length} estudiantes para ${course} (${schoolYear}) · activos: ${active} · inactivos: ${inactive}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
