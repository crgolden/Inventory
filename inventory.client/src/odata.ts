export const ODATA_COUNT = '@odata.count';

export interface ODataResponse<T> {
  value: T[];
}

export interface ODataCountResponse<T> extends ODataResponse<T> {
  [ODATA_COUNT]?: number;
}

export function escapeODataLiteral(value: string): string {
  return value.replace(/'/g, "''");
}
