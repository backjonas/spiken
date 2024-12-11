import { config } from './config.js'

export const formattedAccountString =
  '<pre>' +
  `Mottagare: ${config.bankAccount.name}\n` +
  `Kontonummer: ${config.bankAccount.number}\n` +
  `Referensnummer: ${config.bankAccount.ref}\n` +
  '</pre>'
