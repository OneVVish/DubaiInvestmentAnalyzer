// Deployed manually (Extensions > Apps Script, in the target Sheet) as a Web
// App — see the "Manual setup" section in the project's plan/README for the
// exact deploy steps. Not part of the Vite build; this file exists purely as
// a version-controlled reference copy of what's pasted into Google's editor.
//
// Sheet header row (row 1), in this exact order:
//   Timestamp | City | Region | Country | IP | UserAgent | ScreenSize | Timezone | Language | ScenarioJSON

const SHEET_NAME = 'Sheet1' // rename here if your tab isn't the default name

// Anonymous, unauthenticated — any visitor's browser can call this. That's
// intentional (it's how every visitor's scenario gets logged). Reads (doGet
// below) are what's actually gated.
function doPost(e) {
  const body = JSON.parse(e.postData.contents)
  const scenario = body.scenario || {}
  const visitor = body.visitor || {}

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
  sheet.appendRow([
    new Date(),
    visitor.city || '',
    visitor.region || '',
    visitor.country || '',
    visitor.ip || '',
    visitor.userAgent || '',
    visitor.screenWidth && visitor.screenHeight ? `${visitor.screenWidth}x${visitor.screenHeight}` : '',
    visitor.timezone || '',
    visitor.language || '',
    JSON.stringify(scenario),
  ])

  return jsonResponse({ ok: true })
}

// Gated by a passphrase stored as a Script Property (Project Settings >
// Script Properties > ADMIN_SECRET) — never in this source file, never in
// the deployed app's client bundle. Wrong or missing secret gets the exact
// same generic error, so a guesser can't tell the endpoint apart from a
// nonexistent one.
function doGet(e) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET')
  const provided = e.parameter.secret
  if (!expected || provided !== expected) {
    return jsonResponse({ ok: false, error: 'unauthorized' })
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
  const rows = sheet.getDataRange().getValues()
  const [, ...dataRows] = rows // drop the header row

  const scenarios = dataRows
    .filter((row) => row[0]) // skip any fully-blank trailing rows
    .map((row, index) => ({
      index,
      timestamp: row[0],
      city: row[1],
      region: row[2],
      country: row[3],
      ip: row[4],
      userAgent: row[5],
      screenSize: row[6],
      timezone: row[7],
      language: row[8],
      scenario: safeParse(row[9]),
    }))

  return jsonResponse({ ok: true, scenarios })
}

function safeParse(json) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON)
}
