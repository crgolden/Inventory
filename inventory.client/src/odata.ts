export interface ODataResponse<T> {
  value: T[];
}

export interface ODataCountResponse<T> extends ODataResponse<T> {
  '@odata.count'?: number;
}

export function escapeODataLiteral(value: string): string {
  return value.replace(/'/g, "''");
}
