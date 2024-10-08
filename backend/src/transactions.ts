import { z } from 'zod'
import { pool } from './db_setup.js'
import { QueryResult } from 'pg'

export interface Transaction {
  id: number
  created_at: Date
  user_id: number
  user_name: string
  description: string
  amount_cents: number
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

export const getAllBalances = async (): Promise<
  { userId: string; userName: string; balance: number }[]
> => {
  const res = await pool.query(
    `--sql  
    SELECT DISTINCT t.user_id, t.user_name, grouped.balance  
    FROM transactions t, (  
      SELECT user_id, SUM (amount_cents) AS balance  
      FROM transactions  
      GROUP BY user_id  
    ) grouped WHERE t.user_id = grouped.user_id`
  )
  return res.rows.map((row) => {
    return {
      userId: row.user_id,
      userName: row.user_name,
      balance: Number(row.balance) / 100,
    }
  })
}

export const exportTransactions = async (
  limit: number | undefined = undefined
): Promise<QueryResult<Transaction>> => {
  return await pool.query(
    `--sql
      SELECT *
      FROM transactions
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit]
  )
}

export const exportTransactionsForOneUser = async (
  userId: number,
  transactionCount: number
): Promise<QueryResult<Transaction>> => {
  return await pool.query(
    `--sql
      SELECT *
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, transactionCount]
  )
}

export const exportTransactionTemplate = async () => {
  const res = await pool.query(
    `SELECT DISTINCT ON (user_id) user_id, user_name, description, amount_cents
    FROM transactions 
    ORDER BY user_id, created_at DESC;`
  )
  res.rows.forEach((row) => {
    row['description'] = ''
    row['amount_cents'] = 0
  })
  return res
}

const BalanceResponseSchema = z
  .array(
    z.object({
      balance: z.string(),
    })
  )
  .length(1)
