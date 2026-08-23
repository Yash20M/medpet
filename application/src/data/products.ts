import { Product, Category, QuickLink } from '../types/product.types';

const IMG = (id: string): string => `https://images.unsplash.com/${id}?w=600&q=80`;

export const CATEGORIES: Category[] = [
  { id: '1', icon: '🐕', label: 'Dogs',    color: '#FDE8EA', iconBg: '#F8B7BE', imageUrl: IMG('photo-1583337130417-3346a1be7dee') },
  { id: '2', icon: '🐈', label: 'Cats',    color: '#FEF3E8', iconBg: '#FDDCB5', imageUrl: IMG('photo-1514888286974-6c03e2ca1dba') },
  { id: '3', icon: '🐦', label: 'Birds',   color: '#EEF2FF', iconBg: '#C7D2FE', imageUrl: IMG('photo-1452570053594-1b985d6ea890') },
  { id: '4', icon: '🐟', label: 'Fish',    color: '#E0F7FA', iconBg: '#B2EBF2', imageUrl: IMG('photo-1524704796725-9fc3044a58b2') },
  { id: '5', icon: '🐇', label: 'Rabbit',  color: '#FCE4EC', iconBg: '#F8BBD0', imageUrl: IMG('photo-1535241749838-299277b6305f') },
  { id: '6', icon: '🦎', label: 'Reptile', color: '#F1F8E9', iconBg: '#DCEDC8', imageUrl: IMG('photo-1517331156700-3c241d2b4d83') },
];

export const QUICK_LINKS: QuickLink[] = [
  { id: '1', icon: 'medkit-outline',    label: 'Medicines', color: '#E63946', bg: '#FDE8EA' },
  { id: '2', icon: 'nutrition-outline', label: 'Nutrition', color: '#FF6B35', bg: '#FFF0EB' },
  { id: '3', icon: 'cut-outline',       label: 'Grooming',  color: '#6366F1', bg: '#EEF2FF' },
  { id: '4', icon: 'heart-outline',     label: 'Wellness',  color: '#F59E0B', bg: '#FFFBEB' },
];

export const PRODUCTS: Product[] = [
  {
    id: '1', name: 'Deworming Tablets', brand: 'Vet Guard', price: 149, originalPrice: 200,
    emoji: '💊', imageUrl: IMG('photo-1584308666744-24d5c474f2ae'), rating: '4.8', reviews: '2.3k', category: 'Dogs', inStock: true,
    description: 'Broad-spectrum deworming tablets effective against roundworms, hookworms and tapeworms. Vet-recommended for monthly use. Easy to administer with food.',
  },
  {
    id: '2', name: 'Flea & Tick Spray', brand: 'PetCare Pro', price: 299, originalPrice: 399,
    emoji: '🧴', imageUrl: IMG('photo-1556228453-efd6c1ff04f6'), rating: '4.6', reviews: '1.1k', category: 'Dogs', inStock: true,
    description: 'Fast-acting spray that kills fleas and ticks on contact and protects for up to 30 days. Gentle, non-greasy formula safe for regular use.',
  },
  {
    id: '3', name: 'Vitamin Supplement', brand: 'NutriPet', price: 450, originalPrice: 599,
    emoji: '🌿', imageUrl: IMG('photo-1550572017-edd951b55104'), rating: '4.9', reviews: '3.5k', category: 'Cats', inStock: true,
    description: 'Daily multivitamin chews packed with Omega-3, biotin and essential minerals for a shiny coat, strong joints and a healthy immune system.',
  },
  {
    id: '4', name: 'Dental Chews', brand: 'SmileVet', price: 189, originalPrice: 249,
    emoji: '🦴', imageUrl: IMG('photo-1601758228041-f3b2795255f1'), rating: '4.7', reviews: '890', category: 'Dogs', inStock: true,
    description: 'Tasty dental chews that reduce plaque and tartar while freshening breath. Designed to support gum health with daily chewing.',
  },
  {
    id: '5', name: 'Premium Dog Food', brand: 'NutriPet', price: 1299, originalPrice: 1599,
    emoji: '🥫', imageUrl: IMG('photo-1589924691995-400dc9ecc119'), rating: '4.8', reviews: '5.2k', category: 'Dogs', inStock: true,
    description: 'Grain-free, high-protein dry food crafted by vet nutritionists. Real chicken first ingredient with no artificial colours or preservatives.',
  },
  {
    id: '6', name: 'Cat Litter (5kg)', brand: 'FreshPaws', price: 549, originalPrice: 699,
    emoji: '🪣', imageUrl: IMG('photo-1543852786-1cf6624b9987'), rating: '4.5', reviews: '2.0k', category: 'Cats', inStock: true,
    description: 'Clumping, dust-free litter with superior odour control. Forms tight clumps for easy scooping and lasts longer than ordinary litter.',
  },
  {
    id: '7', name: 'Eye Drops', brand: 'Vet Guard', price: 179, originalPrice: 229,
    emoji: '💧', imageUrl: IMG('photo-1584017911766-d451b3d0e843'), rating: '4.4', reviews: '640', category: 'Cats', inStock: true,
    description: 'Soothing sterile eye drops that relieve irritation, redness and tear staining. Safe for daily cleaning around the eyes.',
  },
  {
    id: '8', name: 'Bird Vitamin Drops', brand: 'AviCare', price: 219, originalPrice: 299,
    emoji: '🐦', imageUrl: IMG('photo-1452570053594-1b985d6ea890'), rating: '4.6', reviews: '410', category: 'Birds', inStock: true,
    description: 'Water-soluble multivitamin drops for cage and aviary birds. Supports feather condition, breeding health and overall vitality.',
  },
  {
    id: '9', name: 'Aquarium Water Conditioner', brand: 'AquaSafe', price: 159, originalPrice: 199,
    emoji: '🐟', imageUrl: IMG('photo-1524704796725-9fc3044a58b2'), rating: '4.7', reviews: '1.3k', category: 'Fish', inStock: true,
    description: 'Instantly removes chlorine and chloramine and neutralises heavy metals, making tap water safe for fish in seconds.',
  },
  {
    id: '10', name: 'Rabbit Pellet Feed', brand: 'NutriPet', price: 399, originalPrice: 499,
    emoji: '🥕', imageUrl: IMG('photo-1535241749838-299277b6305f'), rating: '4.5', reviews: '720', category: 'Rabbit', inStock: true,
    description: 'High-fibre timothy-hay based pellets for digestive health and proper dental wear. Fortified with vitamins for active rabbits.',
  },
  {
    id: '11', name: 'Calcium Supplement', brand: 'ReptiCare', price: 249, originalPrice: 329,
    emoji: '🦴', imageUrl: IMG('photo-1517331156700-3c241d2b4d83'), rating: '4.6', reviews: '380', category: 'Reptile', inStock: true,
    description: 'Calcium with D3 powder for reptiles to prevent metabolic bone disease. Dust over feeder insects or food at every feeding.',
  },
  {
    id: '12', name: 'Pet Grooming Kit', brand: 'SmileVet', price: 899, originalPrice: 1199,
    emoji: '✂️', imageUrl: IMG('photo-1581888227599-779811939961'), rating: '4.8', reviews: '1.8k', category: 'Dogs', inStock: true,
    description: 'Complete grooming set with low-noise clippers, scissors, comb and nail trimmer. Cordless and rechargeable for stress-free grooming at home.',
  },
  {
    id: '13', name: 'Joint Care Tablets', brand: 'Vet Guard', price: 549, originalPrice: 699,
    emoji: '💊', imageUrl: IMG('photo-1584308666744-24d5c474f2ae'), rating: '4.9', reviews: '2.7k', category: 'Dogs', inStock: false,
    description: 'Glucosamine and chondroitin tablets that support joint mobility and ease stiffness in senior and large-breed pets.',
  },
  {
    id: '14', name: 'Catnip Treats', brand: 'FreshPaws', price: 129, originalPrice: 169,
    emoji: '🌿', imageUrl: IMG('photo-1592194996308-7b43878e84a6'), rating: '4.7', reviews: '960', category: 'Cats', inStock: true,
    description: 'Crunchy treats infused with premium catnip for playful enrichment. Low-calorie and great for training rewards.',
  },
];

export const getProductById = (id: string): Product | undefined =>
  PRODUCTS.find((p) => p.id === id);

export const getProductsByCategory = (label?: string): Product[] =>
  !label ? PRODUCTS : PRODUCTS.filter((p) => p.category === label);
