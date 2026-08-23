import db from '../../shared/config/database';
import { Pet, PetRow, CreatePetDto, UpdatePetDto } from './pets.types';

// pg returns NUMERIC as strings — normalise to numbers.
const toNum = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

const toPet = (r: PetRow): Pet => ({
  ...r,
  age_years: toNum(r.age_years),
  weight_kg: toNum(r.weight_kg),
});

export const PetsService = {
  async listForUser(userId: number): Promise<Pet[]> {
    const { rows } = await db.query<PetRow>(
      `SELECT * FROM pets WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    return rows.map(toPet);
  },

  async getOne(id: number, userId: number): Promise<Pet | null> {
    const { rows } = await db.query<PetRow>(
      `SELECT * FROM pets WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] ? toPet(rows[0]) : null;
  },

  async create(userId: number, dto: CreatePetDto): Promise<Pet> {
    const { rows } = await db.query<PetRow>(
      `INSERT INTO pets (user_id, name, type, breed, gender, age_years, weight_kg, avatar_url, notes)
       VALUES ($1,$2,$3,COALESCE($4,''),COALESCE($5,'unknown'),$6,$7,$8,COALESCE($9,''))
       RETURNING *`,
      [
        userId, dto.name.trim(), dto.type, dto.breed ?? null, dto.gender ?? null,
        dto.age_years ?? null, dto.weight_kg ?? null, dto.avatar_url ?? null, dto.notes ?? null,
      ]
    );
    return toPet(rows[0]);
  },

  async update(id: number, userId: number, dto: UpdatePetDto): Promise<Pet | null> {
    const { rows } = await db.query<PetRow>(
      `UPDATE pets SET
         name       = COALESCE($1, name),
         type       = COALESCE($2, type),
         breed      = COALESCE($3, breed),
         gender     = COALESCE($4, gender),
         age_years  = COALESCE($5, age_years),
         weight_kg  = COALESCE($6, weight_kg),
         avatar_url = COALESCE($7, avatar_url),
         notes      = COALESCE($8, notes)
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        dto.name?.trim() ?? null, dto.type ?? null, dto.breed ?? null, dto.gender ?? null,
        dto.age_years ?? null, dto.weight_kg ?? null, dto.avatar_url ?? null, dto.notes ?? null,
        id, userId,
      ]
    );
    return rows[0] ? toPet(rows[0]) : null;
  },

  async remove(id: number, userId: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM pets WHERE id = $1 AND user_id = $2', [id, userId]);
    return (rowCount ?? 0) > 0;
  },
};
