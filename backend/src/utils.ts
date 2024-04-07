import { QueryResult } from 'pg'

export const createCsv = (queryResult: QueryResult<any>) => {
  const headers = queryResult.fields.map((field) => field.name)
  const rows = queryResult.rows.map((row) => {
    return headers
      .map((header) => {
        return (String(row[header]) ?? '').replace(',', '')
      })
      .join(',')
  })
  return `${headers.join(',')}
  ${rows.join('\n')}`
}

export const formatDateToString = (
  date: Date,
  includeTime: Boolean = false
) => {
  const dateFormated = date.toLocaleDateString('sv-fi', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
  const dayFormated = date.toLocaleDateString('sv-fi', {
    weekday: 'short',
  })
  const timeFormated = includeTime
    ? `kl. ${date.toLocaleTimeString('sv-fi')}`
    : ''
  return `${dateFormated} ${dayFormated} ${timeFormated}`
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
export const formatName = ({
  first_name,
  last_name,
  username,
}: {
  first_name: string
  last_name?: string
  username?: string
}) => {
  const formattedLastName = last_name ? ` ${last_name}` : ``
  const formattedUserName = username ? ` (${username})` : ``
  return `${first_name}${formattedLastName}${formattedUserName}`
}
/**
 * Splits a array into an array of arrays with max n elements per subarray
 *
 * n defaults to 3
 */
export function formatButtonArray<T>(array: T[], n: number = 3): T[][] {
  const result = []
  for (let i = 0; i < array.length; i += n) {
    result.push(array.slice(i, i + n))
  }
  return result
}

export const formatTransaction = (
  user_name: string,
  description: string,
  amount_cents: number,
  created_at: Date = new Date()
) => {
  return (
    `\n${user_name.split(' ').slice(0, -1).join(' ')}, ` +
    `${formatDateToString(created_at)} ${created_at.toLocaleTimeString(
      'sv-fi'
    )}, ` +
    `${centsToEuroString(-amount_cents)}, ` +
    `${description}`
  )
}
