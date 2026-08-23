import db from '../../shared/config/database';
import { Offer, CreateOfferDto, UpdateOfferDto } from './offers.types';

const COLS = 'id, title, subtitle, badge, code, emoji, color_from, color_to, sort_order, is_active, created_at';

export const OffersService = {
  async list(activeOnly: boolean): Promise<Offer[]> {
    const where = activeOnly ? 'WHERE is_active = true' : '';
    const { rows } = await db.query<Offer>(
      `SELECT ${COLS} FROM offers ${where} ORDER BY sort_order ASC, created_at DESC`
    );
    return rows;
  },

  async create(dto: CreateOfferDto): Promise<Offer> {
    const { rows } = await db.query<Offer>(
      `INSERT INTO offers (title, subtitle, badge, code, emoji, color_from, color_to, sort_order)
       VALUES ($1, COALESCE($2,''), COALESCE($3,'OFFER'), $4, COALESCE($5,'🎁'),
               COALESCE($6,'#E63946'), COALESCE($7,'#A4121A'), COALESCE($8,0))
       RETURNING ${COLS}`,
      [dto.title.trim(), dto.subtitle, dto.badge, dto.code ?? null, dto.emoji,
       dto.color_from, dto.color_to, dto.sort_order]
    );
    return rows[0];
  },

  async update(id: number, dto: UpdateOfferDto): Promise<Offer | null> {
    const { rows } = await db.query<Offer>(
      `UPDATE offers SET
         title      = COALESCE($1, title),
         subtitle   = COALESCE($2, subtitle),
         badge      = COALESCE($3, badge),
         code       = COALESCE($4, code),
         emoji      = COALESCE($5, emoji),
         color_from = COALESCE($6, color_from),
         color_to   = COALESCE($7, color_to),
         sort_order = COALESCE($8, sort_order),
         is_active  = COALESCE($9, is_active)
       WHERE id = $10
       RETURNING ${COLS}`,
      [dto.title?.trim() ?? null, dto.subtitle ?? null, dto.badge ?? null, dto.code ?? null,
       dto.emoji ?? null, dto.color_from ?? null, dto.color_to ?? null,
       dto.sort_order ?? null, dto.is_active ?? null, id]
    );
    return rows[0] ?? null;
  },

  async remove(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM offers WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },
};
