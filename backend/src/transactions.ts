import { z } from 'zod'
import { pool } from './db.js'
import { QueryResult } from 'pg'

export interface Transaction {
  id: number
  created_at: Date
  userId: number
  userName: string
  description: string
  amount_cents: number,
  cumulative_sum: number
}

export interface TransactionInsert {
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
}: TransactionInsert) => {
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
  try {
    const balanceResponse = BalanceResponseSchema.parse(res.rows)
    return (Number(balanceResponse[0].balance) / 100).toFixed(2)
  } catch (e) {
    // The balance conversion fails if no transactions exist.
    // Fail silently and return 0, as this is intended functionality
    return (0).toFixed(2)
  }
}

export const exportTransactions = async () =>  {
  const res = await pool.query(`SELECT * FROM transactions`)
  return res
}

export const exportTransactionsForOneUser = async (userId: number): Promise<QueryResult<Transaction>> => {
  const res = await pool.query(
    `SELECT *,
      SUM(amount_cents) OVER (ORDER BY id) AS cumulative_sum
     FROM transactions
     WHERE user_id = $1
     ORDER BY id`,
    [userId]
  )
  return res
}

const BalanceResponseSchema = z
  .array(
    z.object({
      balance: z.string(),
    })
  )
  .length(1)
