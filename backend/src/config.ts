import { z } from 'zod'
import 'dotenv/config'

const processEnvSchema = z.object({
  BOT_TOKEN: z.string(),
  CHAT_ID: z.string().transform((val) => Number(val)),
  ADMIN_CHAT_ID: z.string().transform((val) => Number(val)),
  BANK_ACCOUNT_NUMMER: z.string(),
  BANK_ACCOUNT_NAME: z.string(),
  BANK_ACCOUNT_REF: z.string(),
})
const typedProcessEnv = processEnvSchema.parse(process.env)
export const config = {
  botToken: typedProcessEnv.BOT_TOKEN,
  chatId: typedProcessEnv.CHAT_ID,
  adminChatId: typedProcessEnv.ADMIN_CHAT_ID,
  bankAccount: {
    number: typedProcessEnv.BANK_ACCOUNT_NUMMER,
    name: typedProcessEnv.BANK_ACCOUNT_NAME,
    ref: typedProcessEnv.BANK_ACCOUNT_REF,
  },
}
