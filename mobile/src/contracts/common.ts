export type UUID = string;
export type ISODateTime = string;

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface PageParams {
  page?: number;
  page_size?: number;
}
