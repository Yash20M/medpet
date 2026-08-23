export type UserRole = 'customer' | 'admin' | 'delivery';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthPayload {
  token: string;
  user: User;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

export interface LoginForm {
  email: string;
  password: string;
}
