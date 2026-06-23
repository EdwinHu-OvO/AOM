import type { Address, Category, Order, Store, User } from "./types.js";

export const users: User[] = [
  { id: "u-1", name: "Mina Chen", phone: "13800001111", password: "demo123" }
];

export const addressesByUser = new Map<string, Address[]>([
  [
    "u-1",
    [
      {
        id: "addr-1",
        label: "Home",
        receiver: "Mina Chen",
        phone: "13800001111",
        detail: "88 Maple Garden, Building 3, Apt 1202"
      },
      {
        id: "addr-2",
        label: "Office",
        receiver: "Mina Chen",
        phone: "13800001111",
        detail: "16 Harbor Road, Tower B, 21F"
      }
    ]
  ]
]);

export const categories: Category[] = [
  { id: "all", name: "All", description: "Every restaurant nearby" },
  { id: "asian", name: "Asian", description: "Noodles, rice bowls, sushi and more" },
  { id: "western", name: "Western", description: "Burgers, pasta and brunch plates" },
  { id: "healthy", name: "Healthy", description: "Salads, light bowls and low-cal meals" },
  { id: "dessert", name: "Dessert", description: "Coffee, tea, cake and sweet treats" }
];

export const stores: Store[] = [
  {
    id: "st-ramen",
    name: "Tokyo Ramen Lab",
    categoryId: "asian",
    rating: 4.8,
    deliveryMinutes: 28,
    deliveryFee: 3,
    image: "linear-gradient(135deg, #ec6f66, #f3a183)",
    tags: ["Ramen", "Hot soup", "Best seller"],
    products: [
      { id: "p-tonkotsu", name: "Tonkotsu Ramen", description: "Pork broth, chashu, egg", price: 13.8, popular: true },
      { id: "p-miso", name: "Spicy Miso Ramen", description: "Miso broth with chili oil", price: 12.9 },
      { id: "p-gyoza", name: "Pan-fried Gyoza", description: "Six pork dumplings", price: 6.5 }
    ]
  },
  {
    id: "st-bistro",
    name: "North Street Bistro",
    categoryId: "western",
    rating: 4.6,
    deliveryMinutes: 34,
    deliveryFee: 4,
    image: "linear-gradient(135deg, #597e52, #c6c06f)",
    tags: ["Pasta", "Burger", "Family meals"],
    products: [
      { id: "p-burger", name: "Classic Beef Burger", description: "Angus patty, cheddar, pickles", price: 14.6, popular: true },
      { id: "p-carbonara", name: "Creamy Carbonara", description: "Bacon, parmesan, black pepper", price: 15.2 },
      { id: "p-fries", name: "Truffle Fries", description: "Crispy fries with truffle salt", price: 7.2 }
    ]
  },
  {
    id: "st-green",
    name: "Green Bowl Club",
    categoryId: "healthy",
    rating: 4.7,
    deliveryMinutes: 22,
    deliveryFee: 2,
    image: "linear-gradient(135deg, #11998e, #38ef7d)",
    tags: ["Salad", "Protein bowls", "Fresh"],
    products: [
      { id: "p-salmon", name: "Salmon Power Bowl", description: "Salmon, quinoa, avocado", price: 16.4, popular: true },
      { id: "p-chicken", name: "Lemon Chicken Salad", description: "Grilled chicken and greens", price: 12.3 },
      { id: "p-smoothie", name: "Berry Smoothie", description: "Blueberry, banana, yogurt", price: 5.8 }
    ]
  },
  {
    id: "st-sweet",
    name: "Cloud Sugar Cafe",
    categoryId: "dessert",
    rating: 4.9,
    deliveryMinutes: 18,
    deliveryFee: 2,
    image: "linear-gradient(135deg, #d299c2, #fef9d7)",
    tags: ["Coffee", "Cake", "Afternoon tea"],
    products: [
      { id: "p-latte", name: "Oat Milk Latte", description: "Double shot, creamy oat milk", price: 5.4 },
      { id: "p-cheesecake", name: "Yuzu Cheesecake", description: "Citrus curd and biscuit base", price: 7.8, popular: true },
      { id: "p-macaron", name: "Macaron Box", description: "Six mixed flavors", price: 11.5 }
    ]
  }
];

export const ordersByUser = new Map<string, Order[]>();
