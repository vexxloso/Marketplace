export type UserRole = "user" | "admin";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
