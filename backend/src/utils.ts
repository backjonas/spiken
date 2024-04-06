import { QueryResult } from 'pg'

export const createCsv = (queryResult: QueryResult<any>) => {
  const headers = queryResult.fields.map((field) => field.name)
  const rows = queryResult.rows.map((row) => {
    return headers
      .map((header) => {
        return (String(row[header]) ?? '').replace(',', '')
      })
      .join(', ')
  })
  return `${headers.join(', ')}
  ${rows.join('\n')}`
}

export const formatDateToString = (date: Date) => {
  return `${date.toLocaleDateString('sv-fi', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })} ${date.toLocaleDateString('sv-fi', { weekday: 'short' })}`
}

/**
 * Formats from number of cent to a string in euro. I.e. -350 becomes "-3.5€"
 * @param amountInCents
 * @returns
 */
export const centsToEuroString = (amountInCents: number): string => {
  var euro = (amountInCents / -100).toFixed(2).toString()
  if (euro[0] !== '-') {
    euro = ' ' + euro
  }
  return euro + '€'
}
