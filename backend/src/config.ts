import { z } from 'zod'
import 'dotenv/config'

const processEnvSchema = z.object({
  INFO_MESSAGE: z.string(),
  BOT_TOKEN: z.string(),
  CHAT_ID: z.string().transform((val) => Number(val)),
  ADMIN_CHAT_ID: z.string().transform((val) => Number(val)),
  BANK_ACCOUNT_NUMBER: z.string(),
  BANK_ACCOUNT_NAME: z.string(),
  BANK_ACCOUNT_REF: z.string(),
})

const typedProcessEnv = processEnvSchema.parse(process.env)

export const config = {
  infoMessage: typedProcessEnv.INFO_MESSAGE,
  botToken: typedProcessEnv.BOT_TOKEN,
  chatId: typedProcessEnv.CHAT_ID,
  adminChatId: typedProcessEnv.ADMIN_CHAT_ID,
  bankAccount: {
    number: typedProcessEnv.BANK_ACCOUNT_NUMBER,
    name: typedProcessEnv.BANK_ACCOUNT_NAME,
    ref: typedProcessEnv.BANK_ACCOUNT_REF,
  },
}
