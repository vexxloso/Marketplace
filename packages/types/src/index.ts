export type UserRole = "guest" | "host" | "admin";

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
