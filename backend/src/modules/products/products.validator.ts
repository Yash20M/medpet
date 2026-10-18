import { body, ValidationChain } from 'express-validator';

export const PET_TYPES = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'horse', 'reptile', 'other'];

const accessoryRules: ValidationChain[] = [
  body('is_accessory').optional().isBoolean().withMessage('is_accessory must be boolean.'),
  body('pet_types').optional().isArray({ max: PET_TYPES.length }).withMessage('pet_types must be an array.'),
  body('pet_types.*').optional().isIn(PET_TYPES).withMessage(`pet_types may only contain: ${PET_TYPES.join(', ')}.`),
];

const imageRules: ValidationChain[] = [
  body('image_urls').optional().isArray({ max: 5 }).withMessage('A product can have at most 5 images.'),
  body('image_urls.*').isString().isLength({ min: 1, max: 1000 }).withMessage('Invalid image URL.'),
];

const detailRules: ValidationChain[] = [
  body('manufacturer_details').optional().isString().isLength({ max: 4000 }).withMessage('manufacturer_details too long (max 4000).'),
  body('ingredients').optional().isString().isLength({ max: 4000 }).withMessage('ingredients too long (max 4000).'),
  body('uses').optional().isString().isLength({ max: 4000 }).withMessage('uses too long (max 4000).'),
];

const variantRules: ValidationChain[] = [
  body('variants').optional().isArray({ max: 20 }).withMessage('variants must be an array (max 20).'),
  body('variants.*.id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('variant id must be an integer.'),
  body('variants.*.label').trim().notEmpty().withMessage('Each variant needs a size label (e.g. 10kg).')
    .isLength({ max: 40 }).withMessage('Variant label too long.'),
  body('variants.*.original_price').isInt({ min: 0 }).withMessage('Variant original_price must be a non-negative integer.'),
  body('variants.*.discount_price').isInt({ min: 0 }).withMessage('Variant discount_price must be a non-negative integer.')
    .custom((v, { req, path }) => {
      const i = Number(/\[(\d+)\]/.exec(path)?.[1]);
      return Number(v) <= Number(req.body.variants?.[i]?.original_price);
    }).withMessage('Variant discount_price cannot exceed its original_price.'),
  body('variants.*.stock_quantity').isInt({ min: 0 }).withMessage('Variant stock_quantity must be a non-negative integer.'),
  body('variants').optional().custom((vs: { label?: string }[]) => {
    const labels = vs.map((v) => String(v.label ?? '').trim().toLowerCase());
    return new Set(labels).size === labels.length;
  }).withMessage('Variant sizes must be unique.'),
];

export const createProductValidator: ValidationChain[] = [
  body('name').trim().notEmpty().withMessage('Name is required.')
    .isLength({ max: 160 }).withMessage('Name too long.'),
  body('original_price').isInt({ min: 0 }).withMessage('original_price must be a non-negative integer.'),
  body('discount_price').isInt({ min: 0 }).withMessage('discount_price must be a non-negative integer.')
    .custom((v, { req }) => Number(v) <= Number(req.body.original_price))
    .withMessage('discount_price cannot exceed original_price.'),
  body('category_id').optional({ nullable: true }).isInt().withMessage('category_id must be an integer.'),
  body('brand_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('brand_id must be an integer.'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('rating must be 0–5.'),
  body('reviews_count').optional().isInt({ min: 0 }).withMessage('reviews_count must be a non-negative integer.'),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('stock_quantity must be a non-negative integer.'),
  body('low_stock_threshold').optional().isInt({ min: 0 }).withMessage('low_stock_threshold must be a non-negative integer.'),
  body('in_stock').optional().isBoolean().withMessage('in_stock must be boolean.'),
  body('is_featured').optional().isBoolean().withMessage('is_featured must be boolean.'),
  ...accessoryRules,
  ...variantRules,
  ...imageRules,
  ...detailRules,
];

export const updateProductValidator: ValidationChain[] = [
  body('name').optional().trim().isLength({ min: 1, max: 160 }).withMessage('Invalid name.'),
  body('original_price').optional().isInt({ min: 0 }).withMessage('original_price must be a non-negative integer.'),
  body('discount_price').optional().isInt({ min: 0 }).withMessage('discount_price must be a non-negative integer.'),
  body('category_id').optional({ nullable: true }).isInt().withMessage('category_id must be an integer.'),
  body('brand_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('brand_id must be an integer.'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('rating must be 0–5.'),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('stock_quantity must be a non-negative integer.'),
  body('low_stock_threshold').optional().isInt({ min: 0 }).withMessage('low_stock_threshold must be a non-negative integer.'),
  body('in_stock').optional().isBoolean().withMessage('in_stock must be boolean.'),
  body('is_featured').optional().isBoolean().withMessage('is_featured must be boolean.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
  ...accessoryRules,
  ...variantRules,
  ...imageRules,
  ...detailRules,
];
