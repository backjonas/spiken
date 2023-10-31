import { z } from 'zod'
import { pool } from './db.js'

interface Transaction {
  userId: number
  userName: string
  description: string
  amountCents: string
}

export const purchaseItemForMember = async ({
  userId,
  userName,
  description,
  amountCents,
}: Transaction) => {
  await pool.query(
    `INSERT INTO transactions(
    user_id,
    user_name,
    description,
    amount_cents
  ) VALUES (
    $1, $2, $3, $4
  )`,
    [userId, userName, description, amountCents]
  )
}

export const getBalanceForMember = async (userId: number) => {
  const res = await pool.query(
    `SELECT SUM (amount_cents) AS balance FROM transactions WHERE user_id = $1`,
    [userId]
  )
  const balanceResponse = BalanceResponseSchema.parse(res.rows)
  return (Number(balanceResponse[0].balance) / 100).toFixed(2)
}
const BalanceResponseSchema = z
  .array(
    z.object({
      balance: z.string(),
    })
  )
  .length(1)