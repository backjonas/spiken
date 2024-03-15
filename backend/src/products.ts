import { pool } from './db.js'
import { QueryResult } from 'pg'

interface ProductIn {
  name: string
  description: string
  priceCents: string
}

export interface Product {
  productId: number
  name: string
  description: string
  priceCents: string
}

export const addProduct = async ({
  name,
  description,
  priceCents: amountCents,
}: ProductIn) => {
  await pool.query(
    `INSERT INTO products(
    name,
    description,
    amount_cents
  ) VALUES (
    $1, $2, $3
  )`,
    [name, description, amountCents]
  )
}

export const deleteProduct = async ({ produktId }: { produktId: number }) => {
  await pool.query(
    `DELETE FROM products
    where id = $1`,
    [produktId]
  )
}

export const editProduct = async ({
  productId,
  name,
  description,
  priceCents: amountCents,
}: Product) => {
  await pool.query(
    `UPDATE table_name
    SET name = $2,
        description = $3,
        amount_cents = $4
    WHERE id = $1;`,
    [productId, name, description, amountCents]
  )
}

export const getProducts = async (): Promise<QueryResult<Product>> => {
  const res = await pool.query(`SELECT * FROM products`)
  return res
}
