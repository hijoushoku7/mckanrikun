export type Role = "admin" | "operator" | "viewer";

export interface PublicUser {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}
