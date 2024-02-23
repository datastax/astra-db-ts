export type SomeDoc = Record<string, any>;

export interface VectorDoc {
  $vector?: number[],
  $vectorize?: string,
}
