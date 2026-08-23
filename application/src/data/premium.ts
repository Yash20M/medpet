import React from 'react';
import { Ionicons } from '@expo/vector-icons';

// ─── Static content powering the premium Home sections ──────────────────────
// These are presentation-layer fixtures (brands, testimonials, tips, stores);
// everything transactional (products, orders, coupons) still comes from the API.

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface QuickAction {
  id: string;
  icon: IconName;
  label: string;
  colors: [string, string];
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'medicines',    icon: 'medkit',            label: 'Order Medicines',     colors: ['#10B981', '#059669'] },
  { id: 'prescription', icon: 'document-text',     label: 'Upload Prescription', colors: ['#38BDF8', '#0EA5E9'] },
  { id: 'vet',          icon: 'videocam',          label: 'Vet Consultation',    colors: ['#8B5CF6', '#6D28D9'] },
  { id: 'vaccination',  icon: 'shield-checkmark',  label: 'Book Vaccination',    colors: ['#FB923C', '#F97316'] },
  { id: 'emergency',    icon: 'alert-circle',      label: 'Emergency Care',      colors: ['#FB7185', '#E11D48'] },
  { id: 'grooming',     icon: 'cut',               label: 'Pet Grooming',        colors: ['#6366F1', '#4338CA'] },
  { id: 'insurance',    icon: 'umbrella',          label: 'Insurance',           colors: ['#14B8A6', '#0D9488'] },
  { id: 'subscription', icon: 'repeat',            label: 'Subscriptions',       colors: ['#F59E0B', '#D97706'] },
];

export interface Brand {
  id: string;
  name: string;
  emoji: string;
  tint: string;
}

export const BRANDS: Brand[] = [
  { id: 'vetguard',  name: 'Vet Guard',   emoji: '🛡️', tint: '#D1FAE5' },
  { id: 'petcare',   name: 'PetCare Pro', emoji: '🐾', tint: '#E0F2FE' },
  { id: 'nutripet',  name: 'NutriPet',    emoji: '🥩', tint: '#FEF3C7' },
  { id: 'furwell',   name: 'FurWell',     emoji: '✨', tint: '#EDE9FE' },
  { id: 'aqualife',  name: 'AquaLife',    emoji: '🐠', tint: '#CFFAFE' },
  { id: 'birdiez',   name: 'Birdiez',     emoji: '🦜', tint: '#FFE4E6' },
];

export interface Testimonial {
  id: string;
  owner: string;
  petEmoji: string;
  petName: string;
  rating: number;
  text: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1', owner: 'Priya S.', petEmoji: '🐕', petName: 'Bruno', rating: 5,
    text: 'Medicines arrived in 20 minutes when Bruno had an upset tummy. Lifesaver — literally!',
  },
  {
    id: 't2', owner: 'Arjun M.', petEmoji: '🐈', petName: 'Misty', rating: 5,
    text: 'The vet consult was so smooth. Doctor was patient and Misty is doing great now.',
  },
  {
    id: 't3', owner: 'Neha K.', petEmoji: '🐇', petName: 'Coco', rating: 4,
    text: 'Great prices on food and supplements. The subscription saves me a trip every month.',
  },
];

export interface HealthTip {
  id: string;
  icon: IconName;
  tint: [string, string];
  title: string;
  teaser: string;
  readMins: number;
  sections: { heading: string; body: string }[];
}

export const HEALTH_TIPS: HealthTip[] = [
  {
    id: 'daily-care',
    icon: 'sunny',
    tint: ['#FCD34D', '#F59E0B'],
    title: 'Daily Care Essentials',
    teaser: 'Five small habits that keep your pet thriving every single day.',
    readMins: 3,
    sections: [
      { heading: 'Fresh water, always', body: 'Change your pet’s water at least twice a day. Dehydration is one of the most common (and most preventable) causes of vet visits, especially in warmer months.' },
      { heading: 'A consistent routine', body: 'Pets are creatures of habit. Feeding, walking and play at roughly the same times each day lowers anxiety and makes behavioural issues far less likely.' },
      { heading: 'Daily brushing', body: 'Even short-haired breeds benefit from a quick daily brush — it distributes natural oils, reduces shedding, and doubles as a bonding ritual.' },
      { heading: 'Watch the paws', body: 'Check paw pads for cracks, foreign objects or redness after walks. Hot pavement and rough terrain do more damage than most owners realise.' },
      { heading: 'Five minutes of training', body: 'Short, positive training sessions keep your pet’s mind sharp. Five focused minutes beats an occasional hour-long session.' },
    ],
  },
  {
    id: 'nutrition',
    icon: 'nutrition',
    tint: ['#FB923C', '#F97316'],
    title: 'Nutrition Made Simple',
    teaser: 'What to feed, what to avoid, and how much is actually enough.',
    readMins: 4,
    sections: [
      { heading: 'Read the first three ingredients', body: 'The first three ingredients on a food label make up most of the bowl. Look for named meats (chicken, salmon) rather than vague “meat meal”.' },
      { heading: 'Portion by body condition', body: 'Feeding guides on packets are starting points, not rules. You should be able to feel (not see) your pet’s ribs. Adjust portions every few weeks.' },
      { heading: 'Foods to never share', body: 'Chocolate, grapes, onions, garlic and xylitol are toxic to dogs and cats. When in doubt, don’t share from your plate.' },
      { heading: 'Transition foods slowly', body: 'Switching foods overnight is the top cause of upset stomachs. Mix the new food in gradually over 7–10 days.' },
    ],
  },
  {
    id: 'vaccination',
    icon: 'shield-checkmark',
    tint: ['#38BDF8', '#0EA5E9'],
    title: 'Vaccination Schedule Guide',
    teaser: 'The core vaccines every pet needs — and exactly when they need them.',
    readMins: 5,
    sections: [
      { heading: 'Puppies & kittens (6–16 weeks)', body: 'Core vaccinations begin at 6–8 weeks and are boosted every 3–4 weeks until 16 weeks. Keep unvaccinated youngsters away from public spaces until the full course is done.' },
      { heading: 'The annual booster myth', body: 'Many core vaccines now protect for three years. Ask your vet for a titre test before assuming an annual booster is needed.' },
      { heading: 'Rabies is non-negotiable', body: 'Rabies vaccination is legally required in most regions and protects your family as much as your pet. Keep the certificate somewhere you can find it.' },
      { heading: 'Track it in the app', body: 'Add your pet’s profile in MedPet and we’ll remind you before every due date — no more guessing from a crumpled vaccination card.' },
    ],
  },
  {
    id: 'emergency',
    icon: 'alert-circle',
    tint: ['#FB7185', '#E11D48'],
    title: 'Emergency First Aid',
    teaser: 'Know these signs and steps before you ever need them.',
    readMins: 4,
    sections: [
      { heading: 'Know your emergency numbers', body: 'Save your regular vet, the nearest 24-hour clinic and an animal poison helpline in your phone today. Minutes matter in a real emergency.' },
      { heading: 'Signs that can’t wait', body: 'Laboured breathing, repeated vomiting, collapse, seizures, bloated abdomen or an inability to urinate all warrant an immediate trip to the vet — not a wait-and-see.' },
      { heading: 'A basic first-aid kit', body: 'Gauze, self-adhesive bandage, saline, a digital thermometer and your pet’s medical records. Keep a duplicate kit in the car.' },
      { heading: 'Transporting an injured pet', body: 'Injured animals may bite out of pain. Use a blanket as a sling for large dogs and a secure carrier for cats and small pets.' },
    ],
  },
];

export interface NearbyStore {
  id: string;
  name: string;
  distanceKm: number;
  etaMins: number;
  open: boolean;
  area: string;
}

export const NEARBY_STORES: NearbyStore[] = [
  { id: 's1', name: 'MedPet Indiranagar',  distanceKm: 1.2, etaMins: 18, open: true,  area: '100 Ft Road' },
  { id: 's2', name: 'MedPet Koramangala',  distanceKm: 3.8, etaMins: 26, open: true,  area: '5th Block' },
  { id: 's3', name: 'MedPet Whitefield',   distanceKm: 9.5, etaMins: 41, open: false, area: 'Phoenix Mall' },
];

export interface DeliverySlot {
  id: string;
  label: string;
  window: string;
  express: boolean;
}

export const DELIVERY_SLOTS: DeliverySlot[] = [
  { id: 'express',   label: 'Express',  window: 'Within 2 hours',    express: true },
  { id: 'today-eve', label: 'Today',    window: '6:00 PM – 9:00 PM', express: false },
  { id: 'tom-morn',  label: 'Tomorrow', window: '9:00 AM – 12:00 PM', express: false },
  { id: 'tom-eve',   label: 'Tomorrow', window: '6:00 PM – 9:00 PM', express: false },
];

// ─── Product info fixtures (Product Detail tabs) ─────────────────────────────
// Deterministic per product id so the same product always shows the same copy.

const INGREDIENTS_POOL = [
  'Praziquantel 50mg', 'Pyrantel Pamoate 144mg', 'Vitamin B-complex', 'Omega-3 fatty acids',
  'Calcium carbonate', 'Zinc gluconate', 'Taurine', 'Biotin', 'Glucosamine HCl', 'Natural chicken flavour',
];

export interface ProductInfo {
  ingredients: string[];
  usage: string;
  dosage: string;
  sideEffects: string;
}

export const getProductInfo = (productId: string): ProductInfo => {
  const seed = productId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = (offset: number) => INGREDIENTS_POOL[(seed + offset) % INGREDIENTS_POOL.length];
  return {
    ingredients: [pick(0), pick(3), pick(5), pick(7)],
    usage: 'Administer orally with or immediately after food. Suitable for pets over 8 weeks of age. Store below 25°C away from direct sunlight and keep out of reach of children.',
    dosage: 'Small pets (< 5 kg): ½ unit daily. Medium (5–15 kg): 1 unit daily. Large (> 15 kg): 2 units daily, or as directed by your veterinarian. Do not exceed the recommended dose.',
    sideEffects: 'Generally well tolerated. Mild drowsiness or a temporary loss of appetite may occur in sensitive animals. Discontinue and consult your vet if vomiting, swelling, or unusual lethargy is observed.',
  };
};
