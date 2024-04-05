import { pool } from './db.js'
import { QueryResult } from 'pg'

export interface ProductIn {
  name: string
  description: string
  priceCents: string
}

export interface Product {
  id: number
  name: string
  description: string
  price_cents: string
}

export const addProduct = async ({
  name,
  description,
  priceCents: amountCents,
}: ProductIn): Promise<void> => {
  await pool.query(
    `INSERT INTO products(
    name,
    description,
    price_cents
  ) VALUES (
    $1, $2, $3
  )`,
    [name, description, amountCents]
  )
}

export const deleteProduct = async (id: number): Promise<QueryResult> => {
  return await pool.query(
    `DELETE FROM products
    where id = $1`,
    [id]
  )
}

export const editProduct = async ({
  id,
  name,
  description,
  price_cents: amountCents,
}: Product): Promise<void> => {
  await pool.query(
    `UPDATE products
    SET name = $2,
        description = $3,
        price_cents = $4
    WHERE id = $1;`,
    [id, name, description, amountCents]
  )
}

export const getProducts = async (): Promise<QueryResult<Product>> => {
  return await pool.query(`SELECT * FROM products`)
}

export const getProductById = async (
  id: number
): Promise<QueryResult<Product>> => {
  return await pool.query(`SELECT * FROM products WHERE id = $1;`, [id])
}
