import { number, z } from 'zod'
import 'dotenv/config'

const processEnvSchema = z.object({
  BOT_TOKEN: z.string(),
  CHAT_ID: z.string().transform((val) => Number(val)),
  ADMIN_CHAT_ID: z.string().transform((val) => Number(val)),
})
const typedProcessEnv = processEnvSchema.parse(process.env)
export const config = {
  botToken: typedProcessEnv.BOT_TOKEN,
  chatId: typedProcessEnv.CHAT_ID,
  adminChatId: typedProcessEnv.ADMIN_CHAT_ID,
}
